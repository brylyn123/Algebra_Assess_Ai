import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';
import { apiFetch } from './fetchClient';
import Select from './components/Select';

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

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
};

const statusConfig = {
  graded: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Graded' },
  pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Pending' },
  'needs review': { color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', label: 'Needs Review' },
  'ready to return': { color: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500', label: 'Ready to Return' },
};

const getStatusConfig = (status) => {
  const key = String(status || 'pending').toLowerCase();
  return statusConfig[key] || statusConfig.pending;
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
  const [manualOcrText, setManualOcrText] = useState('');
  const [ocrFailed, setOcrFailed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (location.state?.exerciseId) {
      setSelectedAssessment(String(location.state.exerciseId));
    }
  }, [location.state]);

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
    setOcrFailed(false);
    setManualOcrText('');

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
    const response = await apiFetch('/save_submission_grade.php', {
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
      const response = await apiFetch('/return_assessment_results.php', {
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

    const bodyPayload = {
      teacher_id: teacherId,
      solution_id: submission.id,
    };

    if (options.ocrTextOverride) {
      bodyPayload.ocr_text_override = options.ocrTextOverride;
    }

    const response = await apiFetch('/generate_submission_grade.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') {
      const error = new Error(payload.message || 'Unable to generate AI draft.');
      error.code = payload.code || null;
      throw error;
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
    setSaveMessage('Running AI grading on the selected submission...');
    setPageMessage('');
    setOcrFailed(false);
    setManualOcrText('');

    try {
      await generateDraftForSubmission(selectedSubmission);
      setSaveMessage('AI grading finished. Review and edit the draft before saving it.');
    } catch (error) {
      console.error(error);
      if (error.code === 'ocr_failed') {
        setOcrFailed(true);
        setSaveMessage('Could not read the submission automatically. Type or paste the student\'s answer below, then click "Grade with this text".');
      } else {
        setSaveMessage(error.message || 'Unable to generate draft score.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateWithManualText = async () => {
    if (!selectedSubmission || !manualOcrText.trim()) return;
    setGenerating(true);
    setSaveMessage('Grading with your manually entered text...');
    setPageMessage('');
    setOcrFailed(false);

    try {
      await generateDraftForSubmission(selectedSubmission, { ocrTextOverride: manualOcrText.trim() });
      setSaveMessage('AI grading finished. Review and edit the draft before saving it.');
    } catch (error) {
      console.error(error);
      setSaveMessage(error.message || 'Unable to generate draft with manual text.');
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
    setSaveMessage(`Running AI grading for ${remainingBatchSubmissions.length} student submission(s)...`);

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
      label: `${assessment.title} (${assessment.count})`,
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
    <div className="h-full min-h-0 overflow-hidden px-4 py-3 md:px-6 md:py-4">
      <div className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col gap-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="teacher-eyebrow">Grading</p>
            <h1 className="teacher-heading">Generate Score</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review submissions, run AI grading, and save results.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 md:mt-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Total {submissionSummary.total}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Pending {submissionSummary.pending}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Graded {submissionSummary.graded}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              Review {submissionSummary.review}
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
          <div className="flex min-w-0 flex-col gap-3 lg:w-[340px] lg:shrink-0">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Select Assessment
              </label>
              <Select
                value={selectedAssessment}
                onChange={(e) => setSelectedAssessment(e.target.value)}
                placeholder="Select an assessment"
              >
                {assessmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={returnAssessmentResults}
                disabled={!canReturnAssessment || loading}
                className="teacher-secondary-btn flex-1 text-xs"
              >
                Return Results
              </button>
              <button
                type="button"
                onClick={() => openGradingModal(pendingSubmissions[0], 'batch')}
                disabled={pendingSubmissions.length === 0 || loading}
                className="teacher-primary-btn flex-1 text-xs"
              >
                Select All Ungraded
              </button>
            </div>

            {pageMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
                {pageMessage}
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Student Submissions</p>
                <span className="text-xs font-medium text-slate-400">{visibleSubmissions.length} visible</span>
              </div>
              {errorMessage && <p className="mb-2 text-xs text-red-600">{errorMessage}</p>}

              <div className="teacher-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="relative">
                      <div className="h-8 w-8 rounded-full border-[3px] border-blue-200 border-t-blue-500 animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      </div>
                    </div>
                    <span className="ml-3 text-sm font-medium text-slate-500">Loading submissions...</span>
                  </div>
                )}
                {!loading && visibleSubmissions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-8 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-600">No submissions yet</p>
                    <p className="mt-1 text-xs text-slate-400">Submissions appear here once students turn in work.</p>
                    <a
                      href="/teacher/assessments/view"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                    >
                      View Assessments
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </a>
                  </div>
                )}

                {visibleSubmissions.map((submission) => {
                  const isActive = selectedSubmission?.id === submission.id;
                  const st = getStatusConfig(submission.status);
                  return (
                    <button
                      key={submission.id}
                      type="button"
                      onClick={() => openGradingModal(submission, 'single')}
                      className={`teacher-list-card w-full text-left ${isActive ? '!border-blue-300 !bg-blue-50/80' : ''}`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                          {getInitials(submission.student_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-slate-900">
                                {submission.student_name}
                              </h3>
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                {submission.assessment_title}
                              </p>
                            </div>
                            <span className={`teacher-status-pill shrink-0 border ${st.color}`}>
                              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                              </svg>
                              {submission.submission_date}
                            </span>
                            <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                            <span className="truncate">{submission.subject_display || 'No subject'}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="hidden min-h-0 flex-1 lg:flex lg:flex-col lg:items-center lg:justify-center">
            {gradingModalOpen && (selectedSubmission || batchCompleted) && typeof document !== 'undefined' && createPortal((
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                <div
                  className={`mx-auto flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_40px_100px_rgba(15,23,42,0.25)] ring-1 ring-black/5 ${gradingMode === 'batch'
                    ? 'max-h-[90vh] w-[min(1200px,calc(100vw-2rem))]'
                    : 'max-h-[88vh] w-[min(860px,calc(100vw-2rem))]'
                    }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
                        {getInitials(batchCompleted ? batchAssessmentTitle : selectedSubmission?.student_name)}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          {batchCompleted ? 'Batch Complete' : gradingMode === 'batch' ? 'Select All Ungraded' : 'Student Review'}
                        </p>
                        <h2 className="text-base font-bold text-slate-900">
                          {batchCompleted ? 'Assessment Ready to Return' : selectedSubmission?.student_name}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {batchCompleted ? batchAssessmentTitle : selectedSubmission?.assessment_title}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeGradingModal}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {gradingMode === 'batch' && (
                    <div className="border-b border-slate-100 px-6 py-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Selected Students</p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {batchPendingSubmissions.map((submission) => (
                          <button
                            key={submission.id}
                            type="button"
                            onClick={() => setSelectedSubmission(submission)}
                            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${selectedSubmission?.id === submission.id
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
                  <div className="teacher-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
                    {batchCompleted ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
                          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">All Done!</h3>
                        <p className="mt-2 max-w-sm text-sm text-slate-500">
                          All students in this assessment have been generated, reviewed, and saved.
                        </p>
                        <button
                          type="button"
                          onClick={closeGradingModal}
                          className="teacher-primary-btn mt-6"
                        >
                          Return Assessment
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Student</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{selectedSubmission?.student_name}</p>
                            <p className="text-xs text-slate-500">{selectedSubmission?.assessment_title}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Submitted</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{selectedSubmission?.student_id}</p>
                            <p className="text-xs text-slate-500">{selectedSubmission?.submission_date}</p>
                          </div>
                        </div>

                        {selectedSubmission?.rubric_name && (
                          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                                <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-500">Rubric</p>
                                <p className="mt-0.5 text-sm font-semibold text-slate-900">{selectedSubmission.rubric_name}</p>
                                {selectedSubmission.rubric_criteria && (
                                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{selectedSubmission.rubric_criteria}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 0 0 1.5-1.5V4.5a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v15a1.5 1.5 0 0 0 1.5 1.5Z" />
                            </svg>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Submitted Work</p>
                          </div>
                          {submissionFiles.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                              <p className="text-sm text-slate-400">No files uploaded</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex gap-1.5">
                                {submissionFiles.map((file, index) => {
                                  const isActive = activeFile?.id === file.id;
                                  return (
                                    <button
                                      key={file.id}
                                      type="button"
                                      onClick={() => setSelectedFileIndex(index)}
                                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${isActive
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
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
                                className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-blue-300 hover:shadow-sm"
                              >
                                {activeFile?.type === 'pdf' ? (
                                  <div className="flex h-36 items-center justify-center bg-slate-50">
                                    <div className="text-center">
                                      <svg className="mx-auto h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                      </svg>
                                      <p className="mt-1 text-xs font-medium text-slate-500">PDF - Click to preview</p>
                                    </div>
                                  </div>
                                ) : (
                                  <img
                                    src={activeFile?.url}
                                    alt={`${selectedSubmission?.student_name} submission ${selectedFileIndex + 1}`}
                                    className="h-36 w-full object-contain bg-slate-50"
                                  />
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {shouldShowGeneratePanel ? (
                          <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5">
                            {ocrFailed ? (
                              <>
                                <div className="flex items-start gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                                    <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">Manual Input Required</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                      Could not read the submission automatically. Type or paste the student's answer below.
                                    </p>
                                  </div>
                                </div>
                                <textarea
                                  value={manualOcrText}
                                  onChange={(event) => setManualOcrText(event.target.value)}
                                  rows={6}
                                  className="teacher-input !border-amber-200 focus:!border-blue-400 focus:!ring-blue-100"
                                  placeholder="Type or paste the student's answer here..."
                                  disabled={generating}
                                />
                                <div className="flex gap-3">
                                  <button
                                    type="button"
                                    onClick={handleGenerateWithManualText}
                                    disabled={!selectedSubmission || generating || !manualOcrText.trim()}
                                    className="teacher-primary-btn flex-1"
                                  >
                                    {generating ? (
                                      <span className="flex items-center gap-2">
                                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Grading...
                                      </span>
                                    ) : 'Grade with this text'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setOcrFailed(false); setManualOcrText(''); handleGenerateAIGrade(); }}
                                    disabled={!selectedSubmission || generating}
                                    className="teacher-secondary-btn"
                                  >
                                    Retry
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-start gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Ready to Grade</p>
                                    <p className="mt-1 text-sm text-slate-600">
                                      {gradingMode === 'batch'
                                        ? 'Click Generate All to create AI drafts for the selected batch.'
                                        : 'Click the button below to run AI grading on this submission.'}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={gradingMode === 'batch' ? handleGenerateAll : handleGenerateAIGrade}
                                  disabled={!selectedSubmission || generating || bulkGenerating || returning}
                                  className="teacher-primary-btn w-full"
                                >
                                  {generating && !bulkGenerating ? (
                                    <span className="flex items-center gap-2">
                                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                      Running AI...
                                    </span>
                                  ) : gradingMode === 'batch'
                                    ? 'Generate All'
                                    : 'Generate Score & Feedback'}
                                </button>
                              </>
                            )}
                            {saveMessage && (
                              <p className={`text-xs font-medium ${saveMessage.toLowerCase().includes('unable') || saveMessage.toLowerCase().includes('error') || saveMessage.toLowerCase().includes('failed') ? 'text-red-600' : 'text-emerald-600'}`}>
                                {saveMessage}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4 rounded-2xl border border-blue-200/60 bg-blue-50/30 p-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                                  <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                  </svg>
                                </div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">Generated Result</p>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-blue-600 shadow-sm">
                                {selectedSubmission?.status === 'Ready to Return' ? 'Saved' : reviewMode ? 'Ready to save' : 'Draft'}
                              </span>
                            </div>

                            <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Score</p>
                              <p className="mt-2 text-4xl font-black text-blue-600">
                                {draftScore !== null && draftScore !== undefined && draftScore !== '' ? `${draftScore}%` : '—'}
                              </p>
                            </div>

                            <label className="block">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Feedback</span>
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
                                rows={4}
                                className="teacher-input mt-2"
                                placeholder="Overall feedback for the student..."
                                disabled={!selectedSubmission}
                              />
                            </label>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Item Scores</p>
                                <span className="text-[11px] font-medium text-slate-400">
                                  Max {draftMaxScore > 0 ? draftMaxScore.toFixed(2) : '0.00'}
                                </span>
                              </div>
                              {draftItemScores.length === 0 ? (
                                <p className="py-4 text-center text-sm text-slate-400">No item records yet.</p>
                              ) : (
                                <div className="space-y-3">
                                  {draftItemScores.map((item) => (
                                    <div
                                      key={item.item_id ?? item.item_no}
                                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                            Item {item.item_no}
                                          </p>
                                          <p className="mt-0.5 text-sm font-medium text-slate-700 line-clamp-2">{item.question_content}</p>
                                        </div>
                                        <div className="w-20 shrink-0">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            max={item.max_score || undefined}
                                            value={item.score_earned}
                                            onChange={(event) => updateDraftItemScore(item.item_id, 'score_earned', event.target.value)}
                                            className="teacher-input !rounded-lg !px-2.5 !py-1.5 text-center text-sm"
                                          />
                                          <p className="mt-0.5 text-center text-[10px] text-slate-400">of {Number(item.max_score || 0).toFixed(2)}</p>
                                        </div>
                                      </div>
                                      <textarea
                                        value={item.ai_feedback}
                                        onChange={(event) => updateDraftItemScore(item.item_id, 'ai_feedback', event.target.value)}
                                        rows={2}
                                        className="teacher-input mt-2 !rounded-lg !px-2.5 !py-1.5 text-xs"
                                        placeholder="Step-by-step feedback..."
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={gradingMode === 'batch' ? handleSaveAllResults : handleSaveResult}
                                disabled={!selectedSubmission || returning || generating || bulkGenerating || !hasDraftResult}
                                className="teacher-primary-btn flex-1"
                                style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 55%, #34d399 100%)' }}
                              >
                                {returning ? (
                                  <span className="flex items-center gap-2">
                                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Saving...
                                  </span>
                                ) : gradingMode === 'batch' ? 'Save All Results' : 'Save Result'}
                              </button>
                            </div>
                            {saveMessage && (
                              <p className={`text-xs font-medium ${saveMessage.toLowerCase().includes('unable') ? 'text-red-600' : 'text-emerald-600'}`}>
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

            {gradingModalOpen && (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-100/80">
                  <svg className="h-10 w-10 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-400">Select a student to begin grading</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isPreviewOpen && activeFile && typeof document !== 'undefined' && createPortal((
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="relative flex h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_40px_120px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 0 0 1.5-1.5V4.5a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v15a1.5 1.5 0 0 0 1.5 1.5Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{activeFile.name}</p>
                  <p className="text-xs text-slate-500">
                    {info?.student_name ?? 'Student'} &middot; {info?.assessment_title ?? 'Assessment'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {submissionFiles.length > 1 && (
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                    {selectedFileIndex + 1} / {submissionFiles.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {submissionFiles.length > 1 && (
              <div className="flex gap-1.5 border-b border-slate-100 px-6 py-2.5">
                {submissionFiles.map((file, index) => {
                  const isActive = activeFile.id === file.id;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setSelectedFileIndex(index)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                      Page {index + 1}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden bg-slate-100 p-4">
              <div className="relative flex h-full items-center justify-center">
                {submissionFiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFileIndex((current) => (current - 1 + submissionFiles.length) % submissionFiles.length)}
                    className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-lg transition hover:bg-white hover:text-blue-600"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                )}

                {activeFile.type === 'pdf' ? (
                  <iframe
                    title={activeFile.name}
                    src={activeFile.url}
                    className="h-full w-full rounded-2xl border border-slate-200 bg-white"
                  />
                ) : (
                  <img
                    src={activeFile.url}
                    alt={`${info?.student_name ?? 'Student'} submission ${selectedFileIndex + 1}`}
                    className="h-full rounded-2xl border border-slate-200 bg-white object-contain shadow-lg"
                  />
                )}

                {submissionFiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFileIndex((current) => (current + 1) % submissionFiles.length)}
                    className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-lg transition hover:bg-white hover:text-blue-600"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
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
