import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';

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

const readStoredDraft = (submissionId) => {
  if (!submissionId || typeof window === 'undefined') {
    return null;
  }

  try {
    const storedDraft = window.localStorage.getItem(getDraftStorageKey(submissionId));
    if (!storedDraft) {
      return null;
    }

    const parsedDraft = JSON.parse(storedDraft);
    return parsedDraft && typeof parsedDraft === 'object' ? parsedDraft : null;
  } catch (error) {
    console.error('Unable to restore saved review draft', error);
    return null;
  }
};

const writeStoredDraft = (submissionId, draftPayload) => {
  if (!submissionId || typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getDraftStorageKey(submissionId), JSON.stringify(draftPayload));
};

const clearStoredDraft = (submissionId) => {
  if (!submissionId || typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(getDraftStorageKey(submissionId));
};

const normalizeItemDrafts = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => ({
    item_id: item?.item_id ?? null,
    item_no: item?.item_no ?? index + 1,
    question_content: item?.question_content ?? '',
    max_score: Number(item?.max_score ?? 0),
    score_earned:
      item?.score_earned === null || item?.score_earned === undefined || item?.score_earned === ''
        ? ''
        : Number(item.score_earned),
    ai_feedback: item?.ai_feedback ?? '',
    is_manual_override: Boolean(item?.is_manual_override),
  }));
};

const normalizeAiGeneration = (generation, submission) => {
  const payload = generation && typeof generation === 'object' ? generation : {};
  const itemSource = Array.isArray(payload.item_scores)
    ? payload.item_scores
    : Array.isArray(payload.items)
      ? payload.items
      : submission?.items;

  return {
    model: payload.model ?? '',
    overall_score:
      payload.overall_score ?? payload.total_score_earned ?? payload.score ?? null,
    overall_feedback:
      payload.overall_feedback ?? payload.ai_feedback ?? payload.feedback ?? '',
    item_scores: normalizeItemDrafts(itemSource),
    raw_response: payload.raw_response ?? payload,
  };
};

const GradeSubmissions = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const teacherUser = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = teacherUser?.user_id ?? teacherUser?.teacher_id ?? teacherUser?.id ?? null;
  const [submissions, setSubmissions] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [, setAiScore] = useState(null);
  const [draftScore, setDraftScore] = useState(null);
  const [draftFeedback, setDraftFeedback] = useState('');
  const [draftItemScores, setDraftItemScores] = useState([]);
  const [draftAiGeneration, setDraftAiGeneration] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [, setReviewSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [returning, setReturning] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [gradingModalOpen, setGradingModalOpen] = useState(false);
  const [gradingMode, setGradingMode] = useState('single');
  const [batchSubmissionIds, setBatchSubmissionIds] = useState([]);
  const [saveMessage, setSaveMessage] = useState('');
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [pageMessage, setPageMessage] = useState('');

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
      setPageMessage('');

      try {
        const response = await fetch(`${API_BASE_URL}/grade_submissions.php?teacher_id=${teacherId}`, {
          credentials: 'include',
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

  const applyDraftToState = (submission, generation, saved = false) => {
    const normalizedGeneration = normalizeAiGeneration(generation, submission);
    setAiScore(normalizedGeneration.overall_score);
    setDraftScore(normalizedGeneration.overall_score);
    setDraftFeedback(normalizedGeneration.overall_feedback);
    setDraftItemScores(normalizedGeneration.item_scores);
    setDraftAiGeneration(normalizedGeneration);
    setReviewMode(true);
    setReviewSaved(saved);
    return normalizedGeneration;
  };

  const saveDraftSnapshot = (submission, generation, saved = false) => {
    const normalizedGeneration = normalizeAiGeneration(generation, submission);
    const draftPayload = {
      aiScore: normalizedGeneration.overall_score,
      draftScore: normalizedGeneration.overall_score,
      draftFeedback: normalizedGeneration.overall_feedback,
      draftItemScores: normalizedGeneration.item_scores,
      draftAiGeneration: normalizedGeneration,
      reviewSaved: saved,
      updatedAt: new Date().toISOString(),
    };

    writeStoredDraft(submission.id, draftPayload);
    return draftPayload;
  };

  const markSubmissionWithDraft = (submissionId, generation) => {
    setSubmissions((current) =>
      current.map((submission) =>
        submission.id === submissionId
          ? {
              ...submission,
              status: 'Needs Review',
              score: generation.overall_score ?? submission.score,
              ai_feedback: generation.overall_feedback ?? submission.ai_feedback,
              items: normalizeItemDrafts(generation.item_scores ?? submission.items),
            }
          : submission
      )
    );
  };

  useEffect(() => {
    const normalizedExistingGeneration = normalizeAiGeneration(
      {
        overall_score: selectedSubmission?.score ?? null,
        overall_feedback: selectedSubmission?.ai_feedback ?? '',
        item_scores: selectedSubmission?.items ?? [],
      },
      selectedSubmission
    );
    setAiScore(selectedSubmission?.score ?? null);
    setDraftScore(selectedSubmission?.score ?? null);
    setDraftFeedback(selectedSubmission?.ai_feedback ?? '');
    setDraftItemScores(normalizedExistingGeneration.item_scores);
    setDraftAiGeneration(normalizedExistingGeneration);
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

    const parsedDraft = readStoredDraft(selectedSubmission.id);
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
      if (Array.isArray(parsedDraft.draftItemScores)) {
        setDraftItemScores(normalizeItemDrafts(parsedDraft.draftItemScores));
      }
      if (parsedDraft.draftAiGeneration && typeof parsedDraft.draftAiGeneration === 'object') {
        setDraftAiGeneration(normalizeAiGeneration(parsedDraft.draftAiGeneration, selectedSubmission));
      }
      setReviewMode(true);
      setReviewSaved(Boolean(parsedDraft.reviewSaved));
    }
  }, [selectedSubmission?.id, selectedSubmission?.score, selectedSubmission?.ai_feedback, selectedSubmission?.items]);

  const persistSubmissionGrade = async (submission, scoreValue, feedbackValue, itemScores, aiGeneration) => {
    if (!submission || !teacherId) return null;

    const normalizedGeneration = normalizeAiGeneration(aiGeneration, submission);
    const response = await fetch(`${API_BASE_URL}/save_submission_grade.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacher_id: teacherId,
        solution_id: submission.id,
        total_score_earned: scoreValue,
        ai_feedback: feedbackValue,
        item_scores: itemScores,
        ai_generation: {
          ...normalizedGeneration,
          overall_score: scoreValue,
          overall_feedback: feedbackValue,
          item_scores: itemScores,
        },
        ai_model: normalizedGeneration.model,
        ai_raw_response: normalizedGeneration.raw_response,
      }),
    });

    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') {
      throw new Error(payload.message || 'Unable to save grade.');
    }

    const nextSubmission = {
      ...submission,
      status: 'Ready to Return',
      score_id: payload.score_id,
      score: payload.score,
      ai_feedback: payload.ai_feedback,
      returned_at: null,
      items: normalizeItemDrafts(itemScores).map((item) => ({
        ...item,
        score_earned:
          item.score_earned === '' || item.score_earned === null || item.score_earned === undefined
            ? null
            : Number(item.score_earned),
      })),
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

  const returnAssessmentResults = async () => {
    if (!teacherId || !selectedAssessment || visibleSubmissions.length === 0) {
      return;
    }

    setLoading(true);
    setPageMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/return_assessment_results.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          exercise_id: Number(selectedAssessment),
        }),
      });

      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to return assessment results.');
      }

      setSubmissions((current) =>
        current.map((submission) => (
          String(submission.exercise_id ?? '') === selectedAssessment
            ? { ...submission, status: 'Graded', returned_at: new Date().toISOString() }
            : submission
        ))
      );
      setPageMessage('All saved student results for this assessment were returned.');
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || 'Unable to return assessment results.');
    } finally {
      setLoading(false);
    }
  };

  const generateDraftForSubmission = async (submission, options = {}) => {
    if (!submission) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/generate_submission_grade.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacher_id: teacherId,
        solution_id: submission.id,
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') {
      throw new Error(payload.message || 'Unable to generate AI draft.');
    }

    const generated = normalizeAiGeneration(payload.ai_generation, submission);
    saveDraftSnapshot(submission, generated, false);
    markSubmissionWithDraft(submission.id, generated);

    if (!options.skipUiUpdate && selectedSubmission?.id === submission.id) {
      applyDraftToState(submission, generated, false);
    }

    return generated;
  };

  const handleGenerateAIGrade = async () => {
    if (!selectedSubmission) return;
    setGenerating(true);
    setSaveMessage('Running OCR and AI grading on the selected submission...');
    setPageMessage('');

    try {
      await generateDraftForSubmission(selectedSubmission);
      setSaveMessage('OCR and AI grading finished. Review and edit the draft before saving it.');
    } catch (error) {
      console.error(error);
      setSaveMessage(error.message || 'Unable to generate draft score.');
    } finally {
      setGenerating(false);
    }
  };

  const openGradingModal = (submission, mode = 'single') => {
    if (!submission) return;
    setBatchSubmissionIds(
      mode === 'batch'
        ? pendingSubmissions.map((item) => item.id)
        : []
    );
    setSelectedSubmission(submission);
    setGradingMode(mode);
    setGradingModalOpen(true);
  };

  const closeGradingModal = () => {
    setGradingModalOpen(false);
    setBatchSubmissionIds([]);
    setGradingMode('single');
  };

  const updateDraftItemScore = (itemId, field, value) => {
    setDraftItemScores((current) => {
      const nextItems = current.map((item) =>
        item.item_id === itemId
          ? {
              ...item,
              [field]: value,
              is_manual_override: true,
            }
          : item
      );

      setDraftAiGeneration((currentGeneration) => ({
        ...normalizeAiGeneration(currentGeneration, selectedSubmission),
        overall_score: draftScore,
        overall_feedback: draftFeedback,
        item_scores: nextItems,
      }));

      return nextItems;
    });
    setReviewSaved(false);
  };

  const handleGenerateAll = async () => {
    if (gradingMode !== 'batch') {
      return;
    }

    const remainingBatchSubmissions = submissions.filter(
      (submission) =>
        batchSubmissionIds.includes(submission.id)
        && submission.status !== 'Graded'
        && !submission.score_id
        && !readStoredDraft(submission.id)
    );

    if (remainingBatchSubmissions.length === 0) {
      setSaveMessage('All ungraded students in this assessment already have generated drafts.');
      return;
    }

    setBulkGenerating(true);
    setSaveMessage(`Running OCR and AI grading for ${remainingBatchSubmissions.length} student submission(s)...`);

    try {
      for (const submission of remainingBatchSubmissions) {
        const shouldUpdateCurrent = selectedSubmission?.id === submission.id;
        await generateDraftForSubmission(submission, { skipUiUpdate: !shouldUpdateCurrent });
      }

      if (selectedSubmission && readStoredDraft(selectedSubmission.id)) {
        const currentDraft = readStoredDraft(selectedSubmission.id);
        if (currentDraft?.draftAiGeneration) {
          applyDraftToState(selectedSubmission, currentDraft.draftAiGeneration, Boolean(currentDraft.reviewSaved));
        }
      }

      setSaveMessage('AI drafts are ready for the students in this assessment. Review and save each student result.');
    } catch (error) {
      console.error(error);
      setSaveMessage(error.message || 'Unable to generate drafts for all students.');
    } finally {
      setBulkGenerating(false);
    }
  };

  const handleSaveResult = async () => {
    const numericDraftScore = draftScore === '' || draftScore === null || draftScore === undefined
      ? null
      : Number(draftScore);

    if (!selectedSubmission || numericDraftScore === null || Number.isNaN(numericDraftScore)) return;

    setReturning(true);
    setSaveMessage('');
    setPageMessage('');

    try {
      await persistSubmissionGrade(
        selectedSubmission,
        numericDraftScore,
        draftFeedback,
        draftItemScores,
        {
          ...normalizeAiGeneration(draftAiGeneration, selectedSubmission),
          overall_score: numericDraftScore,
          overall_feedback: draftFeedback,
          item_scores: draftItemScores,
        }
      );
      clearStoredDraft(selectedSubmission.id);
      setAiScore(numericDraftScore);
      setReviewSaved(true);
      setReviewMode(false);

      if (gradingMode === 'batch') {
        const remainingBatchSubmissions = submissions.filter(
          (submission) =>
            batchSubmissionIds.includes(submission.id)
            && submission.id !== selectedSubmission.id
            && !submission.score_id
        );

        if (remainingBatchSubmissions.length > 0) {
          setSelectedSubmission(remainingBatchSubmissions[0]);
          setSaveMessage('Student result saved. Continue reviewing the remaining students in this assessment.');
        } else {
          setSaveMessage('All student results in this assessment have been saved. Close this card and use Return Results on the main page.');
          closeGradingModal();
          setPageMessage('All visible students in this assessment are saved and ready to return.');
        }
      } else {
        setSaveMessage('Student result saved. You can return this student now or close the card.');
      }
    } catch (error) {
      console.error(error);
      setSaveMessage(error.message || 'Unable to save result.');
    } finally {
      setReturning(false);
    }
  };

  const handleSaveAllResults = async () => {
    if (gradingMode !== 'batch') {
      return;
    }

    const submissionsToSave = batchPendingSubmissions.filter((submission) => !submission.score_id);
    if (submissionsToSave.length === 0) {
      setSaveMessage('All student results in this assessment are already saved.');
      setPageMessage('All visible students in this assessment are saved and ready to return.');
      return;
    }

    setReturning(true);
    setSaveMessage('');
    setPageMessage('');

    try {
      for (const submission of submissionsToSave) {
        let generation;

        if (selectedSubmission?.id === submission.id && hasDraftResult) {
          generation = {
            ...normalizeAiGeneration(draftAiGeneration, submission),
            overall_score: Number(draftScore),
            overall_feedback: draftFeedback,
            item_scores: draftItemScores,
          };
        } else {
          const storedDraft = readStoredDraft(submission.id);
          if (!storedDraft?.draftAiGeneration) {
            throw new Error(`Missing generated draft for ${submission.student_name}. Generate all drafts before saving.`);
          }

          generation = {
            ...normalizeAiGeneration(storedDraft.draftAiGeneration, submission),
            overall_score: storedDraft.draftScore ?? storedDraft.aiScore ?? storedDraft.draftAiGeneration.overall_score,
            overall_feedback: storedDraft.draftFeedback ?? storedDraft.draftAiGeneration.overall_feedback ?? '',
            item_scores: normalizeItemDrafts(
              storedDraft.draftItemScores ?? storedDraft.draftAiGeneration.item_scores ?? submission.items
            ),
          };
        }

        const numericScore = generation.overall_score === '' || generation.overall_score === null || generation.overall_score === undefined
          ? null
          : Number(generation.overall_score);

        if (numericScore === null || Number.isNaN(numericScore)) {
          throw new Error(`Missing score for ${submission.student_name}.`);
        }

        await persistSubmissionGrade(
          submission,
          numericScore,
          generation.overall_feedback ?? '',
          generation.item_scores ?? [],
          generation
        );

        clearStoredDraft(submission.id);
      }

      setReviewMode(false);
      setSaveMessage('All generated student results in this assessment have been saved.');
      setPageMessage('All visible students in this assessment are saved and ready to return.');
      closeGradingModal();
    } catch (error) {
      console.error(error);
      setSaveMessage(error.message || 'Unable to save all student results.');
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
  const pendingSubmissions = useMemo(
    () => visibleSubmissions.filter((submission) => String(submission.status || '').toLowerCase() === 'pending'),
    [visibleSubmissions]
  );

  const batchPendingSubmissions = useMemo(() => {
    if (batchSubmissionIds.length === 0) {
      return [];
    }

    return batchSubmissionIds
      .map((submissionId) => submissions.find((submission) => submission.id === submissionId))
      .filter((submission) => submission && String(submission.status || '').toLowerCase() === 'pending');
  }, [batchSubmissionIds, submissions]);
  const batchRemainingToSave = useMemo(
    () => batchPendingSubmissions.filter((submission) => !submission.score_id),
    [batchPendingSubmissions]
  );

  const submissionSummary = useMemo(() => {
    return submissions.reduce(
      (acc, submission) => {
        const status = String(submission.status || 'Pending').toLowerCase();
        acc.total += 1;
        if (status === 'graded') acc.graded += 1;
        else if (status === 'pending') acc.pending += 1;
        else acc.review += 1;
        return acc;
      },
      { total: 0, pending: 0, graded: 0, review: 0 }
    );
  }, [submissions]);

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
  const draftMaxScore = useMemo(
    () => draftItemScores.reduce((sum, item) => sum + (Number(item.max_score) || 0), 0),
    [draftItemScores]
  );
  const activeFile = submissionFiles[selectedFileIndex] ?? submissionFiles[0] ?? null;
  const hasDraftResult = draftScore !== null && draftScore !== undefined && draftScore !== '';
  const selectedSubmissionDraft = selectedSubmission ? readStoredDraft(selectedSubmission.id) : null;
  const shouldShowGeneratePanel = gradingMode === 'batch'
    ? !(selectedSubmissionDraft || selectedSubmission?.score_id || hasDraftResult)
    : !hasDraftResult;
  const batchCompleted = gradingMode === 'batch' && gradingModalOpen && batchSubmissionIds.length > 0 && batchRemainingToSave.length === 0;
  const canReturnAssessment = visibleSubmissions.length > 0 && visibleSubmissions.every((submission) => submission.status === 'Ready to Return');
  const batchAssessmentTitle = useMemo(() => {
    const batchSource = submissions.find((submission) => batchSubmissionIds.includes(submission.id));
    return batchSource?.assessment_title ?? '';
  }, [batchSubmissionIds, submissions]);

  return (
    <div className="h-full min-h-0 overflow-hidden px-4 py-4 md:px-6 md:py-5">
      <div className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col gap-6 pb-6">
        <div className="space-y-2">
          <p className="teacher-eyebrow">Grading</p>
          <h1 className="teacher-heading">Generate Score</h1>
          <p className="text-sm text-slate-500">
            Review the original submission first, then run OCR and AI grading when you are ready.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
            Total {submissionSummary.total}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold text-amber-700 shadow-sm">
            Pending {submissionSummary.pending}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm">
            Graded {submissionSummary.graded}
          </span>
          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-semibold text-cyan-700 shadow-sm">
            Review {submissionSummary.review}
          </span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-semibold text-blue-700 shadow-sm">
            Visible {visibleSubmissions.length}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Select Assessment</p>
              <select
                value={selectedAssessment}
                onChange={(e) => setSelectedAssessment(e.target.value)}
                className="w-full max-w-[420px] rounded-2xl border border-blue-500 px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {assessmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={returnAssessmentResults}
                disabled={!canReturnAssessment || loading}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                Return Results
              </button>
              <button
                type="button"
                onClick={() => openGradingModal(pendingSubmissions[0], 'batch')}
                disabled={pendingSubmissions.length === 0 || loading}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                Select All Ungraded
              </button>
            </div>
          </div>
          {pageMessage && <p className="text-sm text-emerald-600">{pageMessage}</p>}

          <div className="flex min-h-0 flex-1 flex-col space-y-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-md font-semibold text-slate-900">Student Submissions</p>
                <span className="teacher-status-pill bg-slate-100 text-slate-700">
                  {visibleSubmissions.length} visible
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {loading ? 'Loading submissions...' : `${visibleSubmissions.length} submission(s) found`}
              </p>
              {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
            </div>

            <div className="teacher-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-3 pb-2 max-h-[calc(100vh-430px)] md:max-h-[calc(100vh-390px)]">
              {visibleSubmissions.length === 0 && !loading && (
                <div className="rounded-[1.3rem] border border-slate-900/10 bg-slate-100/70 px-5 py-6 text-sm text-slate-500 shadow-[0_14px_32px_rgba(148,163,184,0.14)] backdrop-blur-sm">
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
                const submissionStatus = String(submission.status || 'Pending');
                const statusTone =
                  submissionStatus.toLowerCase() === 'graded'
                    ? 'bg-emerald-50 text-emerald-700'
                    : submissionStatus.toLowerCase() === 'pending'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-cyan-50 text-cyan-700';
                return (
                  <button
                    key={submission.id}
                    type="button"
                    onClick={() => openGradingModal(submission, 'single')}
                    className={`relative w-full overflow-hidden rounded-[1.3rem] border border-slate-900/10 bg-slate-100/70 p-3.5 text-left shadow-[0_14px_32px_rgba(148,163,184,0.14)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_36px_rgba(148,163,184,0.18)] ${
                      isActive
                        ? 'border-blue-300 bg-blue-50'
                        : ''
                    }`}
                  >
                    <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="truncate text-[1.02rem] font-bold text-slate-900">
                          {submission.student_name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {submission.assessment_title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span>Submission date: {submission.submission_date}</span>
                          <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
                          <span className="truncate">{submission.subject_display || 'No subject'}</span>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-center text-xs text-slate-500 shadow-sm">
                        <p className={`text-[11px] font-semibold capitalize ${statusTone}`}>
                          {submissionStatus}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {gradingModalOpen && (selectedSubmission || batchCompleted) && typeof document !== 'undefined' && createPortal((
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 p-0 backdrop-blur-md">
          <div
            className={`mx-auto flex flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] ring-1 ring-white/70 ${
              gradingMode === 'batch'
                ? 'max-h-[88vh] w-[min(1180px,calc(100vw-2rem))]'
                : 'max-h-[82vh] w-[min(900px,calc(100vw-2rem))]'
            }`}
          >
            <div className={`flex items-center justify-between border-b border-slate-200 ${gradingMode === 'batch' ? 'px-6 py-4' : 'px-5 py-3.5'}`}>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  {gradingMode === 'batch' ? 'Select All Ungraded' : 'Student Review'}
                </p>
                <h2 className={`${gradingMode === 'batch' ? 'text-xl' : 'text-lg'} font-semibold text-slate-900`}>
                  {batchCompleted ? 'Assessment Ready to Return' : selectedSubmission.student_name}
                </h2>
                <p className={`${gradingMode === 'batch' ? 'text-sm' : 'text-xs'} text-slate-500`}>
                  {batchCompleted ? batchAssessmentTitle : selectedSubmission.assessment_title}
                </p>
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
                  {batchPendingSubmissions.map((submission) => (
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
            <div className={`min-h-0 flex-1 overflow-y-auto ${gradingMode === 'batch' ? 'p-5' : 'p-4'}`}>
              {batchCompleted ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                    <p className="text-xs uppercase tracking-[0.35em] text-emerald-500">Batch Complete</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-900">All students in this assessment have been generated, reviewed, and saved.</p>
                    <p className="mt-2 text-sm text-emerald-800">
                      Returning now will close this batch and the assessment will disappear from the ungraded queue because there are no ungraded students left.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={closeGradingModal}
                      className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow hover:bg-emerald-700 transition"
                    >
                      Return Assessment
                    </button>
                  </div>
                </div>
              ) : (
              <div className={`${gradingMode === 'batch' ? 'space-y-4' : 'space-y-3'}`}>
                <div className={`rounded-2xl bg-blue-50 ${gradingMode === 'batch' ? 'p-4' : 'p-3.5'}`}>
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

                <div className={`rounded-2xl border border-amber-200 bg-amber-50/70 ${gradingMode === 'batch' ? 'p-4' : 'p-3.5'} text-sm text-amber-800`}>
                  <p className="font-semibold">Assessment Rubric</p>
                  <p className={`${gradingMode === 'batch' ? 'mt-2 text-sm' : 'mt-1.5 text-sm'} font-semibold text-slate-900`}>
                    {selectedSubmission.rubric_name || 'No rubric attached'}
                  </p>
                  {selectedSubmission.rubric_criteria && (
                    <p className="mt-1 text-xs text-slate-600">{selectedSubmission.rubric_criteria}</p>
                  )}
                  {selectedSubmission.rubric_ai_instructions && (
                    <p className="mt-2 text-xs text-slate-600">{selectedSubmission.rubric_ai_instructions}</p>
                  )}
                </div>

                <div className={`rounded-2xl border border-slate-100 bg-white ${gradingMode === 'batch' ? 'p-4' : 'p-3.5'} text-sm text-slate-600`}>
                  <p className="mb-2 font-semibold text-slate-900">Submitted Work</p>
                  {submissionFiles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-400">
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
                        <div className={`flex items-center justify-between border-b border-slate-100 ${gradingMode === 'batch' ? 'px-4 py-3' : 'px-3.5 py-2.5'}`}>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{activeFile?.name}</p>
                            <p className="text-xs text-slate-500">Click the preview to open the full file.</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            {activeFile?.type}
                          </span>
                        </div>
                        {activeFile?.type === 'pdf' ? (
                          <div className={`flex items-center justify-center bg-slate-50 px-6 text-center ${gradingMode === 'batch' ? 'h-56' : 'h-44'}`}>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">PDF submission</p>
                              <p className="mt-1 text-xs text-slate-500">Click to inspect this file without leaving the page.</p>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={activeFile?.url}
                            alt={`${selectedSubmission.student_name} submission ${selectedFileIndex + 1}`}
                            className={`w-full object-contain bg-slate-50 ${gradingMode === 'batch' ? 'h-56' : 'h-44'}`}
                          />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {shouldShowGeneratePanel ? (
                  <div className={`space-y-4 rounded-2xl border border-slate-100 bg-slate-50 ${gradingMode === 'batch' ? 'p-5' : 'p-4'}`}>
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Ready for OCR and grading</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {gradingMode === 'batch'
                          ? 'Click Generate All to run OCR and create AI drafts for the selected batch.'
                          : 'Click Generate Score &amp; Feedback to scan the submitted work, then create the AI draft for the selected student.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={gradingMode === 'batch' ? handleGenerateAll : handleGenerateAIGrade}
                      disabled={!selectedSubmission || generating || bulkGenerating || returning}
                      className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:bg-blue-400"
                    >
                      {generating && !bulkGenerating
                        ? 'Running OCR + AI...'
                        : gradingMode === 'batch'
                          ? 'Generate All'
                          : 'Generate Score & Feedback'}
                    </button>
                  </div>
                ) : (
                  <div className={`space-y-4 rounded-2xl border border-blue-100 bg-blue-50/70 ${gradingMode === 'batch' ? 'p-5' : 'p-4'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.35em] text-blue-400">Generated Result</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                        {selectedSubmission?.status === 'Ready to Return'
                          ? 'Saved'
                          : reviewMode ? 'Ready to save' : 'Draft loaded'}
                      </span>
                    </div>
                    <div className={`rounded-2xl border border-slate-200 bg-white ${gradingMode === 'batch' ? 'p-4' : 'p-3.5'}`}>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Score</p>
                      <p className={`mt-1 font-black text-blue-700 ${gradingMode === 'batch' ? 'text-3xl' : 'text-2xl'}`}>
                        {draftScore !== null && draftScore !== undefined && draftScore !== '' ? `${draftScore}%` : 'Awaiting generation'}
                      </p>
                    </div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                      Feedback
                      <textarea
                        value={draftFeedback}
                        onChange={(event) => {
                          const nextFeedback = event.target.value;
                          setDraftFeedback(nextFeedback);
                          setDraftAiGeneration((currentGeneration) => ({
                            ...normalizeAiGeneration(currentGeneration, selectedSubmission),
                            overall_score: draftScore,
                            overall_feedback: nextFeedback,
                            item_scores: draftItemScores,
                          }));
                          setReviewSaved(false);
                        }}
                        rows={5}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="Generated feedback will appear here"
                        disabled={!selectedSubmission}
                      />
                    </label>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Item Feedback</p>
                        <span className="text-[11px] font-semibold text-slate-500">
                          Max score {draftMaxScore > 0 ? draftMaxScore.toFixed(2) : '0.00'}
                        </span>
                      </div>
                      {draftItemScores.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">No item records are attached to this submission yet.</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {draftItemScores.map((item) => (
                            <div
                              key={item.item_id ?? item.item_no}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                                    Item {item.item_no}
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.question_content}</p>
                                </div>
                                <div className="w-24">
                                  <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                    Score
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    max={item.max_score || undefined}
                                    value={item.score_earned}
                                    onChange={(event) => updateDraftItemScore(item.item_id, 'score_earned', event.target.value)}
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                  />
                                  <p className="mt-1 text-[11px] text-slate-500">of {Number(item.max_score || 0).toFixed(2)}</p>
                                </div>
                              </div>
                              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                Step-by-step Feedback
                                <textarea
                                  value={item.ai_feedback}
                                  onChange={(event) => updateDraftItemScore(item.item_id, 'ai_feedback', event.target.value)}
                                  rows={3}
                                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                  placeholder="Explain the student's work for this item."
                                />
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={gradingMode === 'batch' ? handleSaveAllResults : handleSaveResult}
                        disabled={!selectedSubmission || returning || generating || bulkGenerating || !hasDraftResult}
                        className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow hover:bg-emerald-700 transition disabled:cursor-not-allowed disabled:bg-emerald-300"
                      >
                        {returning ? 'Saving...' : gradingMode === 'batch' ? 'Save All Results' : 'Save Result'}
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
              )}
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
