import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const statusStyle = {
  Pending: 'bg-amber-100 text-amber-700',
  Graded: 'bg-emerald-100 text-emerald-700',
  'Needs Review': 'bg-cyan-100 text-cyan-700',
};

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const toAbsoluteFileUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = String(path).replace(/^\/+/, '');
  return `${API_BASE_URL}/${normalizedPath}`;
};

const normalizeSubmissionFiles = (submission) => {
  if (!Array.isArray(submission?.files)) {
    return [];
  }

  return submission.files
    .map((file, index) => {
      const path = file?.path ?? '';
      const name = file?.name ?? `File ${index + 1}`;
      const extension = String(name).split('.').pop()?.toLowerCase() ?? '';
      const type = file?.type ?? (extension === 'pdf' ? 'pdf' : 'image');

      return {
        id: `${submission.id}-${index}-${name}`,
        name,
        path,
        url: toAbsoluteFileUrl(path),
        type,
      };
    })
    .filter((file) => file.path && file.url);
};

const getDraftStorageKey = (submissionId) => `grade-draft:${submissionId}`;

const GradeSubmissions = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const teacherUser = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = teacherUser?.teacher_id ?? teacherUser?.user_id ?? teacherUser?.id ?? null;
  const [submissions, setSubmissions] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [aiScore, setAiScore] = useState(null);
  const [draftScore, setDraftScore] = useState(null);
  const [draftFeedback, setDraftFeedback] = useState('');
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [returning, setReturning] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [gradingModalOpen, setGradingModalOpen] = useState(false);
  const [gradingMode, setGradingMode] = useState('single');
  const [saveMessage, setSaveMessage] = useState('');
  const [bulkGenerating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchSubmissions = async () => {
      if (!teacherId) {
        if (isMounted) {
          setErrorMessage('Log in as a teacher to view submissions.');
          setLoading(false);
          setSubmissions([]);
        }
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(`${API_BASE_URL}/grade_submissions.php?teacher_id=${teacherId}`, {
          signal: controller.signal,
        });
        const text = await response.text();

        if (!response.ok) {
          throw new Error(text || 'Unable to load submissions.');
        }

        let payload;
        try {
          payload = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to decode grade submissions payload:', text);
          throw new Error('Received invalid data from the server.');
        }

        if (payload.status !== 'success' || !Array.isArray(payload.submissions)) {
          throw new Error(payload.message || 'Unable to load submissions.');
        }

        if (!isMounted) return;

        setSubmissions(payload.submissions);

        setSelectedSubmission((previous) => {
          if (payload.submissions.length === 0) {
            return null;
          }
          const stillVisible = payload.submissions.find((submission) => submission.id === previous?.id);
          return stillVisible || payload.submissions[0];
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        if (isMounted) {
          setErrorMessage(error.message || 'Unable to load submissions.');
          setSubmissions([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSubmissions();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [teacherId]);

  useEffect(() => {
    setSelectedAssessment('all');
  }, [teacherId]);

  useEffect(() => {
    setAiScore(selectedSubmission?.score ?? null);
    setDraftScore(selectedSubmission?.score ?? null);
    setDraftFeedback(selectedSubmission?.ai_feedback ?? '');
    setReviewSaved(false);
    setReviewMode(false);
    setGenerating(false);
    setReturning(false);
    setSelectedFileIndex(0);
    setIsPreviewOpen(false);
    setSaveMessage('');

    if (!selectedSubmission?.id) {
      return;
    }

    try {
      const storedDraft = localStorage.getItem(getDraftStorageKey(selectedSubmission.id));
      if (!storedDraft) {
        return;
      }

      const parsedDraft = JSON.parse(storedDraft);
      if (parsedDraft && typeof parsedDraft === 'object') {
        if (parsedDraft.aiScore !== undefined && parsedDraft.aiScore !== null) {
          setAiScore(parsedDraft.aiScore);
        }
        if (parsedDraft.draftScore !== undefined && parsedDraft.draftScore !== null) {
          setDraftScore(parsedDraft.draftScore);
        }
        if (parsedDraft.draftFeedback !== undefined && parsedDraft.draftFeedback !== null) {
          setDraftFeedback(parsedDraft.draftFeedback);
        }
        setReviewSaved(Boolean(parsedDraft.reviewSaved));
      }
    } catch (error) {
      console.error('Unable to restore saved review draft', error);
    }
  }, [selectedSubmission?.id, selectedSubmission?.score, selectedSubmission?.ai_feedback]);

  const buildGeneratedGrade = (submission, offset = 0) => {
    const base = 84 + ((submission?.exercise_id ?? submission?.id ?? 0) % 11);
    const score = Math.max(0, Math.min(100, base + offset));
    const rubricLabel = submission?.rubric_name || 'the saved rubric';

    return {
      score,
      feedback: `Auto-generated feedback for ${submission?.student_name || 'this student'} using ${rubricLabel}.`,
    };
  };

  const persistSubmissionGrade = async (submission, scoreValue, feedbackValue) => {
    if (!submission || !teacherId) return null;

    const response = await fetch(`${API_BASE_URL}/save_submission_grade.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacher_id: teacherId,
        solution_id: submission.id,
        total_score_earned: scoreValue,
        ai_feedback: feedbackValue,
      }),
    });

    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') {
      throw new Error(payload.message || 'Unable to save grade.');
    }

    const nextSubmission = {
      ...submission,
      status: 'Graded',
      score_id: payload.score_id,
      score: payload.score,
      ai_feedback: payload.ai_feedback,
    };

    setSubmissions((current) =>
      current.map((submission) =>
        submission.id === nextSubmission.id ? nextSubmission : submission
      )
    );
    if (selectedSubmission?.id === nextSubmission.id) {
      setSelectedSubmission(nextSubmission);
    }
    return payload;
  };

  const handleGenerateAIGrade = async () => {
    if (!selectedSubmission) return;
    setGenerating(true);
    setSaveMessage('');

    try {
      const generated = buildGeneratedGrade(selectedSubmission);
      await new Promise((resolve) => setTimeout(resolve, 900));
      setAiScore(generated.score);
      setDraftScore(generated.score);
      setDraftFeedback(generated.feedback);
      setReviewMode(true);
      setReviewSaved(false);
      setSaveMessage('Draft generated. Review the score and feedback before saving it.');
    } catch (error) {
      console.error(error);
      setSaveMessage(error.message || 'Unable to generate draft score.');
    } finally {
      setGenerating(false);
    }
  };

  const openGradingModal = (submission, mode = 'single') => {
    if (!submission) return;
    setSelectedSubmission(submission);
    setGradingMode(mode);
    setGradingModalOpen(true);
  };

  const closeGradingModal = () => {
    setGradingModalOpen(false);
  };

  const handleSaveReview = () => {
    if (!selectedSubmission || draftScore === null || draftScore === undefined || draftScore === '') return;

    try {
      localStorage.setItem(
        getDraftStorageKey(selectedSubmission.id),
        JSON.stringify({
          aiScore,
          draftScore,
          draftFeedback,
          reviewSaved: true,
          updatedAt: new Date().toISOString(),
        })
      );
      setReviewSaved(true);
      setSaveMessage('Review saved. You can return the result to the student now.');
      setGradingModalOpen(false);
    } catch (error) {
      console.error(error);
      setSaveMessage('Unable to save review draft.');
    }
  };

  const handleReturnResult = async () => {
    const numericDraftScore = draftScore === '' || draftScore === null || draftScore === undefined
      ? null
      : Number(draftScore);

    if (!selectedSubmission || numericDraftScore === null || Number.isNaN(numericDraftScore)) return;

    setReturning(true);
    setSaveMessage('');

    try {
      await persistSubmissionGrade(selectedSubmission, numericDraftScore, draftFeedback);
      localStorage.removeItem(getDraftStorageKey(selectedSubmission.id));
      setAiScore(numericDraftScore);
      setSaveMessage('Result returned to the student and saved in Results & Feedback.');
      setReviewMode(false);
      setReviewSaved(false);
      setGradingModalOpen(false);
    } catch (error) {
      console.error(error);
      setSaveMessage(error.message || 'Unable to return result.');
    } finally {
      setReturning(false);
    }
  };

  const assessmentOptions = useMemo(() => {
    const grouped = new Map();

    submissions.forEach((submission) => {
      if (submission.status === 'Graded') {
        return;
      }

      const key = String(submission.exercise_id ?? '');
      if (!key) {
        return;
      }

      const current = grouped.get(key) ?? {
        value: key,
        title: submission.assessment_title || 'Untitled Assessment',
        subject: submission.subject_display || 'Unassigned Subject',
        count: 0,
      };

      current.count += 1;
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).map((assessment) => ({
      value: assessment.value,
      label: assessment.title,
    }));
  }, [submissions]);

  useEffect(() => {
    if (assessmentOptions.length === 0) {
      setSelectedAssessment('');
      return;
    }

    setSelectedAssessment((previous) => {
      const stillValid = assessmentOptions.some((option) => option.value === previous);
      return stillValid ? previous : assessmentOptions[0].value;
    });
  }, [assessmentOptions]);

  const visibleSubmissions = useMemo(() => {
    const ungraded = submissions.filter((submission) => submission.status !== 'Graded');

    return ungraded.filter((submission) => String(submission.exercise_id ?? '') === selectedAssessment);
  }, [selectedAssessment, submissions]);

  useEffect(() => {
    if (visibleSubmissions.length === 0) {
      setSelectedSubmission(null);
      return;
    }

    setSelectedSubmission((previous) => {
      const stillVisible = visibleSubmissions.find((submission) => submission.id === previous?.id);
      return stillVisible || visibleSubmissions[0];
    });
  }, [visibleSubmissions]);

  const info = selectedSubmission;
  const submissionFiles = useMemo(
    () => normalizeSubmissionFiles(selectedSubmission),
    [selectedSubmission]
  );
  const activeFile = submissionFiles[selectedFileIndex] ?? submissionFiles[0] ?? null;
  const hasDraftResult = draftScore !== null && draftScore !== undefined && draftScore !== '';

  return (
    <div className="space-y-6 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Generate Score</h1>

        <div className="space-y-6">
          <div className="rounded-[2rem] bg-white p-8 border border-slate-100 shadow-lg space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-slate-500 mb-2">Select Assessment</p>
                <select
                  value={selectedAssessment}
                  onChange={(e) => setSelectedAssessment(e.target.value)}
                  className="w-full rounded-2xl border border-blue-500 px-4 py-3 text-slate-700 font-medium focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {assessmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAssessment(assessmentOptions[0]?.value ?? '')}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Show First Assessment
                </button>
                <button
                  type="button"
                  onClick={() => openGradingModal(visibleSubmissions[0], 'batch')}
                  disabled={visibleSubmissions.length === 0 || loading}
                  className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  Select All Ungraded
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-8 border border-slate-100 shadow-lg space-y-6">
            <div className="space-y-1">
              <p className="text-md font-semibold text-slate-900">Student Submissions</p>
              <p className="text-sm text-slate-500">
                {loading ? 'Loading submissions...' : `${visibleSubmissions.length} submission(s) found`}
              </p>
              {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
            </div>

            <div className="teacher-scrollbar max-h-[calc(100vh-14rem)] space-y-4 overflow-y-auto pr-2">
              {visibleSubmissions.length === 0 && !loading && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-500">No ungraded submissions match that assessment yet.</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Created assessments will appear on the dashboard and in the assessment list first. They move into this grading queue once students submit work.
                  </p>
                  <a
                    href="/teacher/assessments/view"
                    className="mt-3 inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    View Created Assessments
                  </a>
                </div>
              )}

              {visibleSubmissions.map((submission) => {
                const isActive = selectedSubmission?.id === submission.id;
                return (
                  <button
                    key={submission.id}
                    type="button"
                    onClick={() => openGradingModal(submission, 'single')}
                    className={`w-full text-left rounded-[1rem] border px-4 py-3 shadow-sm transition ${isActive
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-semibold text-slate-900">{submission.student_name}</p>
                          <span className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${statusStyle[submission.status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {submission.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-500">{submission.assessment_title}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {submission.subject_display}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span>Date: {submission.submission_date}</span>
                      {submission.subject_meta && <span>{submission.subject_meta}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {gradingModalOpen && selectedSubmission && typeof document !== 'undefined' && createPortal((
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 p-0 backdrop-blur-md">
          <div className="mx-auto flex max-h-[88vh] w-[min(1180px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] ring-1 ring-white/70">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  {gradingMode === 'batch' ? 'Select All Ungraded' : 'Student Review'}
                </p>
                <h2 className="text-xl font-semibold text-slate-900">{selectedSubmission.student_name}</h2>
                <p className="text-sm text-slate-500">{selectedSubmission.assessment_title}</p>
              </div>
              <button
                type="button"
                onClick={closeGradingModal}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            {gradingMode === 'batch' && (
              <div className="border-b border-slate-100 px-6 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Selected Students</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {visibleSubmissions.map((submission) => (
                    <button
                      key={submission.id}
                      type="button"
                      onClick={() => setSelectedSubmission(submission)}
                      className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        selectedSubmission?.id === submission.id
                          ? 'border-blue-300 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                      }`}
                    >
                      {submission.student_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="space-y-4">
                <div className="rounded-2xl bg-blue-50 p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student</p>
                      <p className="font-semibold text-slate-900">{selectedSubmission.student_name}</p>
                      <p className="text-xs text-slate-500">Assessment: {selectedSubmission.assessment_title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student ID</p>
                      <p className="font-semibold text-slate-900">{selectedSubmission.student_id}</p>
                      <p className="text-xs text-slate-500">Submitted: {selectedSubmission.submission_date}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800">
                  <p className="font-semibold">Assessment Rubric</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{selectedSubmission.rubric_name || 'No rubric attached'}</p>
                  {selectedSubmission.rubric_criteria && (
                    <p className="mt-1 text-xs text-slate-600">{selectedSubmission.rubric_criteria}</p>
                  )}
                  {selectedSubmission.rubric_ai_instructions && (
                    <p className="mt-2 text-xs text-slate-600">{selectedSubmission.rubric_ai_instructions}</p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900 mb-2">Submitted Work</p>
                  {submissionFiles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-400">
                      No uploaded files were found for this submission.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {submissionFiles.map((file, index) => {
                          const isActive = activeFile?.id === file.id;
                          return (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => setSelectedFileIndex(index)}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                isActive
                                  ? 'border-blue-300 bg-blue-100 text-blue-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                              }`}
                            >
                              {submissionFiles.length > 1 ? `Page ${index + 1}` : 'View File'}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-blue-300"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{activeFile?.name}</p>
                            <p className="text-xs text-slate-500">Click the preview to open the full file.</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            {activeFile?.type}
                          </span>
                        </div>
                        {activeFile?.type === 'pdf' ? (
                          <div className="flex h-56 items-center justify-center bg-slate-50 px-6 text-center">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">PDF submission</p>
                              <p className="mt-1 text-xs text-slate-500">Click to inspect this file without leaving the page.</p>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={activeFile?.url}
                            alt={`${selectedSubmission.student_name} submission ${selectedFileIndex + 1}`}
                            className="h-56 w-full object-contain bg-slate-50"
                          />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {!hasDraftResult ? (
                  <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Ready for generation</p>
                      <p className="mt-2 text-sm text-slate-600">
                        Click Generate Score &amp; Feedback to create the AI draft for the selected student.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateAIGrade}
                      disabled={!selectedSubmission || generating || bulkGenerating || returning}
                      className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:bg-blue-400"
                    >
                      {generating && !bulkGenerating ? 'Generating...' : 'Generate Score & Feedback'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.35em] text-blue-400">Generated Result</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                        {reviewMode ? 'Ready to save' : 'Draft loaded'}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Score</p>
                      <p className="mt-1 text-3xl font-black text-blue-700">
                        {draftScore !== null && draftScore !== undefined && draftScore !== '' ? `${draftScore}%` : 'Awaiting generation'}
                      </p>
                    </div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                      Feedback
                      <textarea
                        value={draftFeedback}
                        onChange={(event) => setDraftFeedback(event.target.value)}
                        rows={5}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="Generated feedback will appear here"
                        disabled={!selectedSubmission}
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleSaveReview}
                        disabled={!selectedSubmission || generating || bulkGenerating || returning || !hasDraftResult}
                        className="rounded-2xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold uppercase tracking-wide text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reviewSaved ? 'Review Saved' : 'Save Review'}
                      </button>
                      <button
                        type="button"
                        onClick={handleReturnResult}
                        disabled={!selectedSubmission || returning || generating || bulkGenerating || !hasDraftResult || !reviewSaved}
                        className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow hover:bg-emerald-700 transition disabled:cursor-not-allowed disabled:bg-emerald-300"
                      >
                        {returning ? 'Returning...' : 'Return Result'}
                      </button>
                    </div>
                    {saveMessage && (
                      <p className={`text-xs ${saveMessage.toLowerCase().includes('unable') ? 'text-red-600' : 'text-emerald-600'}`}>
                        {saveMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {isPreviewOpen && activeFile && typeof document !== 'undefined' && createPortal((
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="relative flex h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_35px_100px_rgba(15,23,42,0.45)] ring-1 ring-white/70">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-base font-semibold text-slate-900">{activeFile.name}</p>
                <p className="text-xs text-slate-500">
                  {info?.student_name ?? 'Student'} • {info?.assessment_title ?? 'Assessment'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-3">
              <div className="flex flex-wrap gap-2">
                {submissionFiles.map((file, index) => {
                  const isActive = activeFile.id === file.id;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setSelectedFileIndex(index)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        isActive
                          ? 'border-blue-300 bg-blue-100 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                      }`}
                    >
                      {submissionFiles.length > 1 ? `Page ${index + 1}` : 'File'}
                    </button>
                  );
                })}
              </div>
              {submissionFiles.length > 1 && (
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  {selectedFileIndex + 1} / {submissionFiles.length}
                </p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden bg-slate-100 p-4">
              <div className="relative flex h-full items-center justify-center">
                {submissionFiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFileIndex((current) => (current - 1 + submissionFiles.length) % submissionFiles.length)}
                    className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg transition hover:border-blue-200 hover:text-blue-700"
                    aria-label="Previous file"
                  >
                    Prev
                  </button>
                )}

                {activeFile.type === 'pdf' ? (
                  <iframe
                    title={activeFile.name}
                    src={activeFile.url}
                    className="h-[78vh] w-[min(100%,72rem)] rounded-2xl border border-slate-200 bg-white shadow-lg"
                  />
                ) : (
                  <img
                    src={activeFile.url}
                    alt={`${info?.student_name ?? 'Student'} submission ${selectedFileIndex + 1}`}
                    className="h-[78vh] w-auto max-w-full rounded-2xl border border-slate-200 bg-white object-contain shadow-lg"
                  />
                )}

                {submissionFiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFileIndex((current) => (current + 1) % submissionFiles.length)}
                    className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg transition hover:border-blue-200 hover:text-blue-700"
                    aria-label="Next file"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};

export default GradeSubmissions;
