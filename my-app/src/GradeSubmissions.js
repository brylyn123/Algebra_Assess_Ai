import React, { useEffect, useMemo, useState } from 'react';
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

const GradeSubmissions = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const teacherUser = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = teacherUser?.teacher_id ?? teacherUser?.user_id ?? teacherUser?.id ?? null;
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [aiScore, setAiScore] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [rubrics, setRubrics] = useState([]);
  const [rubricLoading, setRubricLoading] = useState(false);
  const [rubricError, setRubricError] = useState('');
  const [selectedRubric, setSelectedRubric] = useState('');
  const [createdAssessments, setCreatedAssessments] = useState([]);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState('');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [teacherFeedback, setTeacherFeedback] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchSubjects = async () => {
      if (!teacherId) {
        if (isMounted) {
          setAvailableSubjects([]);
          setSubjectError('');
        }
        return;
      }

      try {
        setSubjectError('');
        const response = await fetch(`${API_BASE_URL}/get_subjects.php?teacher_id=${teacherId}`, {
          signal: controller.signal,
        });
        const text = await response.text();

        if (!response.ok) {
          throw new Error(text || 'Unable to load subjects.');
        }

        let payload;
        try {
          payload = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to decode subjects payload:', text);
          throw new Error('Received invalid subject data from the server.');
        }

        const rawSubjects = Array.isArray(payload?.subjects)
          ? payload.subjects
          : Array.isArray(payload)
            ? payload
            : [];

        if (!isMounted) return;

        const normalizedSubjects = rawSubjects
          .map((subject) => ({
            value: String(subject.subject_id ?? subject.id ?? ''),
            label: subject.subject_name ?? subject.name ?? 'Untitled Subject',
          }))
          .filter((subject) => subject.value);

        setAvailableSubjects(normalizedSubjects);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        if (isMounted) {
          setSubjectError(error.message || 'Unable to load subjects.');
          setAvailableSubjects([]);
        }
      }
    };

    fetchSubjects();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [teacherId]);

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
        const params = new URLSearchParams();
        params.set('teacher_id', teacherId);
        if (selectedSubject !== 'all') {
          params.set('subject_id', selectedSubject);
        }

        const response = await fetch(`${API_BASE_URL}/grade_submissions.php?${params.toString()}`, {
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
  }, [teacherId, selectedSubject]);

  useEffect(() => {
    setSelectedSubject('all');
  }, [teacherId]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchAssessments = async () => {
      if (!teacherId) {
        if (isMounted) {
          setCreatedAssessments([]);
          setAssessmentLoading(false);
          setAssessmentError('');
        }
        return;
      }

      setAssessmentLoading(true);
      setAssessmentError('');

      try {
        const response = await fetch(`${API_BASE_URL}/get_assessments.php?teacher_id=${teacherId}`, {
          signal: controller.signal,
        });
        const text = await response.text();

        if (!response.ok) {
          throw new Error(text || 'Unable to load created assessments.');
        }

        let payload;
        try {
          payload = JSON.parse(text);
        } catch (parseError) {
          console.error('Failed to decode assessments payload:', text);
          throw new Error('Received invalid assessment data from the server.');
        }

        if (payload.status !== 'success' || !Array.isArray(payload.assessments)) {
          throw new Error(payload.message || 'Unable to load created assessments.');
        }

        if (!isMounted) return;
        setCreatedAssessments(payload.assessments);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        if (isMounted) {
          setAssessmentError(error.message || 'Unable to load created assessments.');
          setCreatedAssessments([]);
        }
      } finally {
        if (isMounted) {
          setAssessmentLoading(false);
        }
      }
    };

    fetchAssessments();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [teacherId]);

  useEffect(() => {
    if (!teacherId) {
      setRubrics([]);
      setSelectedRubric('');
      setRubricError('');
      setRubricLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setRubricLoading(true);
    setRubricError('');

    const loadRubrics = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/get_rubric_sets.php?teacher_id=${teacherId}`, {
          signal: controller.signal,
        });
        const text = await response.text();
        if (!response.ok) {
          throw new Error(text || 'Unable to load rubrics.');
        }
        const payload = JSON.parse(text);
        if (payload.status !== 'success' || !Array.isArray(payload.rubrics)) {
          throw new Error(payload.message || 'Unable to load rubrics.');
        }
        if (isMounted) {
          setRubrics(payload.rubrics);
          setSelectedRubric(payload.rubrics[0]?.rubric_set_id?.toString() ?? '');
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        if (isMounted) {
          setRubricError(error.message || 'Unable to load rubrics.');
          setRubrics([]);
          setSelectedRubric('');
        }
      } finally {
        if (isMounted) {
          setRubricLoading(false);
        }
      }
    };

    loadRubrics();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [teacherId]);

  const subjectOptions = useMemo(
    () => [{ value: 'all', label: 'All Subjects' }, ...availableSubjects],
    [availableSubjects]
  );

  const visibleSubmissions = useMemo(() => {
    if (selectedSubject === 'all') {
      return submissions;
    }

    return submissions.filter(
      (submission) => String(submission.subject_id ?? 'unassigned') === selectedSubject
    );
  }, [selectedSubject, submissions]);

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

  useEffect(() => {
    setAiScore(selectedSubmission?.score ?? null);
    setGenerating(false);
    setSelectedFileIndex(0);
    setIsPreviewOpen(false);
    setTeacherFeedback(selectedSubmission?.teacher_feedback ?? '');
    setSaveMessage('');
  }, [selectedSubmission?.id]);

  const handleRubricChange = (event) => {
    setSelectedRubric(event.target.value);
  };

  const persistSubmissionGrade = async (scoreValue, feedbackValue) => {
    if (!selectedSubmission || !teacherId) return null;

    const response = await fetch(`${API_BASE_URL}/save_submission_grade.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacher_id: teacherId,
        solution_id: selectedSubmission.id,
        total_score_earned: scoreValue,
        teacher_feedback: feedbackValue,
      }),
    });

    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') {
      throw new Error(payload.message || 'Unable to save grade.');
    }

    const nextSubmission = {
      ...selectedSubmission,
      status: 'Graded',
      score_id: payload.score_id,
      score: payload.score,
      teacher_feedback: payload.teacher_feedback,
    };

    setSubmissions((current) =>
      current.map((submission) =>
        submission.id === selectedSubmission.id ? nextSubmission : submission
      )
    );
    setSelectedSubmission(nextSubmission);
    return payload;
  };

  const handleGenerateAIGrade = async () => {
    if (!selectedSubmission) return;
    setGenerating(true);
    setSaveMessage('');

    try {
      const simulatedScore = Math.floor(85 + Math.random() * 10);
      await new Promise((resolve) => setTimeout(resolve, 900));
      await persistSubmissionGrade(simulatedScore, teacherFeedback);
      setAiScore(simulatedScore);
      setSaveMessage('Grade saved to Results & Feedback.');
    } catch (error) {
      console.error(error);
      setSaveMessage(error.message || 'Unable to save grade.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveFeedback = async () => {
    if (!selectedSubmission || aiScore === null || aiScore === undefined) {
      setSaveMessage('Generate or load a grade before saving feedback.');
      return;
    }

    try {
      setGenerating(true);
      setSaveMessage('');
      const numericScore = Number(aiScore);
      await persistSubmissionGrade(numericScore, teacherFeedback);
      setSaveMessage('Feedback updated successfully.');
    } catch (error) {
      console.error(error);
      setSaveMessage(error.message || 'Unable to update feedback.');
    } finally {
      setGenerating(false);
    }
  };

  const visibleCreatedAssessments = useMemo(() => {
    if (selectedSubject === 'all') {
      return createdAssessments;
    }

    return createdAssessments.filter(
      (assessment) => String(assessment.subject_id ?? 'unassigned') === selectedSubject
    );
  }, [createdAssessments, selectedSubject]);

  const info = selectedSubmission;
  const submissionFiles = useMemo(
    () => normalizeSubmissionFiles(selectedSubmission),
    [selectedSubmission]
  );
  const activeFile = submissionFiles[selectedFileIndex] ?? submissionFiles[0] ?? null;

  return (
    <div className="space-y-8 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <h1 className="text-3xl font-bold text-slate-900">Grade Submissions</h1>

        <div className="grid gap-8 lg:grid-cols-[1.05fr,1fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] bg-white p-6 border border-slate-100 shadow-lg space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500 mb-2">Select Subject</p>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full rounded-2xl border border-blue-500 px-4 py-3 text-slate-700 font-medium focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {subjectOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSubject('all')}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Select All Subjects
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-6 border border-slate-100 shadow-lg space-y-6">
              <div className="space-y-1">
                <p className="text-md font-semibold text-slate-900">Created Assessments</p>
                <p className="text-sm text-slate-500">
                  {assessmentLoading ? 'Loading assessments...' : `${visibleCreatedAssessments.length} assessment(s) ready for submissions`}
                </p>
                {assessmentError && <p className="text-xs text-red-600">{assessmentError}</p>}
              </div>

              <div className="teacher-scrollbar max-h-[320px] space-y-4 overflow-y-auto pr-2">
                {visibleCreatedAssessments.length === 0 && !assessmentLoading && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">No created assessments match that subject yet.</p>
                    <a
                      href="/teacher/assessments"
                      className="mt-3 inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      Create Assessment
                    </a>
                  </div>
                )}

                {visibleCreatedAssessments.map((assessment) => (
                  <div
                    key={assessment.exercise_id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{assessment.title}</p>
                        <p className="text-sm text-slate-500">
                          {assessment.subject || 'Unassigned Subject'}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          statusStyle[assessment.assessment_status] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {assessment.assessment_status || assessment.status || 'Draft'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>Topic: {assessment.topic || '-'}</span>
                      <span>Items: {assessment.item_count ?? assessment.items?.length ?? 0}</span>
                      {assessment.difficulty && <span>Difficulty: {assessment.difficulty}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-6 border border-slate-100 shadow-lg space-y-6">
              <div className="space-y-1">
                <p className="text-md font-semibold text-slate-900">Student Submissions</p>
                <p className="text-sm text-slate-500">
                  {loading ? 'Loading submissions...' : `${visibleSubmissions.length} submission(s) found`}
                </p>
                {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
                {subjectError && <p className="text-xs text-red-600">{subjectError}</p>}
              </div>

              <div className="teacher-scrollbar max-h-[420px] space-y-4 overflow-y-auto pr-2">
                {visibleSubmissions.length === 0 && !loading && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">No submissions match that subject yet.</p>
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
                      onClick={() => setSelectedSubmission(submission)}
                      className={`w-full text-left flex flex-col gap-2 rounded-2xl border p-4 shadow-sm transition ${isActive
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/40'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{submission.student_name}</p>
                          <p className="text-sm text-slate-500">{submission.assessment_title}</p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle[submission.status] ?? 'bg-slate-100 text-slate-600'
                            }`}
                        >
                          {submission.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                        <span>Date: {submission.submission_date}</span>
                        <span>Subject: {submission.subject_display}</span>
                        {submission.subject_meta && <span>{submission.subject_meta}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-lg space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Score Generation</h2>
              <div className="rounded-2xl bg-blue-50 p-4">
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student</p>
                    <p className="font-semibold text-slate-900">{info?.student_name ?? 'Select a submission'}</p>
                    <p className="text-xs text-slate-500">Assessment: {info?.assessment_title ?? '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student ID</p>
                    <p className="font-semibold text-slate-900">{info?.student_id ?? '-'}</p>
                    <p className="text-xs text-slate-500">
                      Submitted: {info?.submission_date ?? '-'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800">
                <p className="font-semibold">Select Grading Rubric</p>
                {rubricLoading ? (
                  <p className="text-xs text-slate-600 mt-2">Loading rubrics...</p>
                ) : (
                  <>
                    <select
                      value={selectedRubric}
                      onChange={handleRubricChange}
                      className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="">Choose a rubric</option>
                      {rubrics.map((rubric) => (
                        <option key={rubric.rubric_set_id} value={rubric.rubric_set_id}>
                          {rubric.rubric_name}
                        </option>
                      ))}
                    </select>
                    {rubricError ? (
                      <p className="text-xs text-red-600 mt-2">{rubricError}</p>
                    ) : rubrics.length === 0 ? (
                      <p className="text-xs text-slate-600 mt-2">
                        No rubrics available. Create one from Manage Assessments.
                      </p>
                    ) : null}
                    {selectedRubric && (
                      <p className="text-xs text-slate-600 mt-2">
                        {rubrics.find((rubric) => String(rubric.rubric_set_id) === selectedRubric)
                          ?.ai_instructions || 'Rubric selected.'}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-700">AI Generated Grade</p>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-lg font-semibold text-slate-900">
                {aiScore !== null && aiScore !== undefined ? `${aiScore}%` : 'Awaiting generation'}
              </div>
              <button
                type="button"
                onClick={handleGenerateAIGrade}
                disabled={!selectedSubmission || generating}
                className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {generating ? 'Generating...' : 'Generate AI Grade'}
              </button>
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="teacher-feedback">
                  Teacher Feedback
                </label>
                <textarea
                  id="teacher-feedback"
                  value={teacherFeedback}
                  onChange={(event) => setTeacherFeedback(event.target.value)}
                  rows={4}
                  placeholder="Add notes the teacher should see in Results & Feedback."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveFeedback}
                  disabled={!selectedSubmission || generating}
                  className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Save Feedback
                </button>
                {saveMessage && (
                  <p className={`text-xs ${saveMessage.toLowerCase().includes('unable') ? 'text-red-600' : 'text-emerald-600'}`}>
                    {saveMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900 mb-2">Submitted Work</p>
              {!selectedSubmission ? (
                <div className="h-40 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-xs text-slate-400">
                  Select a student submission to preview the files.
                </div>
              ) : submissionFiles.length === 0 ? (
                <div className="h-40 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-xs text-slate-400">
                  No uploaded files were found for this submission.
                </div>
              ) : (
                <div className="space-y-4">
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
                        <p className="text-sm font-semibold text-slate-900">{activeFile.name}</p>
                        <p className="text-xs text-slate-500">
                          Click the preview to open the full file.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {activeFile.type}
                      </span>
                    </div>

                    {activeFile.type === 'pdf' ? (
                      <div className="flex h-72 items-center justify-center bg-slate-50 px-6 text-center">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">PDF submission</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Click to inspect this file without leaving the page.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={activeFile.url}
                        alt={`${info?.student_name ?? 'Student'} submission ${selectedFileIndex + 1}`}
                        className="h-72 w-full object-contain bg-slate-50"
                      />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isPreviewOpen && activeFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
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

            <div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-3">
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

            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
              {activeFile.type === 'pdf' ? (
                <iframe
                  title={activeFile.name}
                  src={activeFile.url}
                  className="h-[70vh] w-full rounded-2xl border border-slate-200 bg-white"
                />
              ) : (
                <img
                  src={activeFile.url}
                  alt={`${info?.student_name ?? 'Student'} submission ${selectedFileIndex + 1}`}
                  className="mx-auto max-h-[70vh] w-auto max-w-full rounded-2xl border border-slate-200 bg-white object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeSubmissions;
