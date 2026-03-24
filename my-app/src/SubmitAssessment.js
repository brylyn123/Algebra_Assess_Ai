import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const formatDateTime = (value) => {
  if (!value) return 'Not submitted yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const SubmitAssessment = () => {
  const { enrolledSubjects = [], loadingSubjects = false, subjectsError = '' } = useOutletContext() ?? {};
  const currentEmail = getCurrentLocalUserEmail();
  const currentUser = currentEmail ? findLocalUser(currentEmail) : null;
  const studentId = currentUser?.student_id ?? currentUser?.user_id ?? null;

  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [availableAssessments, setAvailableAssessments] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [assessmentsError, setAssessmentsError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchAssessments = async () => {
      if (!studentId) {
        if (isMounted) {
          setAvailableAssessments([]);
          setAssessmentsError('');
          setLoadingAssessments(false);
        }
        return;
      }

      setLoadingAssessments(true);
      setAssessmentsError('');

      try {
        const response = await fetch(`${API_BASE_URL}/get_student_assessments.php?student_id=${studentId}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (payload.status !== 'success') {
          throw new Error(payload.message || 'Unable to load assessments.');
        }

        if (!isMounted) return;
        setAvailableAssessments(Array.isArray(payload.assessments) ? payload.assessments : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isMounted) {
          setAssessmentsError(error.message || 'Unable to load assessments.');
          setAvailableAssessments([]);
        }
      } finally {
        if (isMounted) {
          setLoadingAssessments(false);
        }
      }
    };

    fetchAssessments();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [studentId]);

  const subjectOptions = useMemo(() => {
    const fromContext = enrolledSubjects.map((subject) => ({
      value: String(subject.subject_id),
      label: subject.subject_name,
    }));

    if (fromContext.length > 0) {
      return [{ value: 'all', label: 'All enrolled subjects' }, ...fromContext];
    }

    const fallbackMap = new Map();
    availableAssessments.forEach((assessment) => {
      const key = String(assessment.subject_id ?? '');
      if (key && !fallbackMap.has(key)) {
        fallbackMap.set(key, assessment.subject_name ?? 'Untitled Subject');
      }
    });

    return [
      { value: 'all', label: 'All enrolled subjects' },
      ...Array.from(fallbackMap.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [availableAssessments, enrolledSubjects]);

  const filteredAssessments = useMemo(() => {
    if (selectedSubject === 'all') {
      return availableAssessments;
    }

    return availableAssessments.filter(
      (assessment) => String(assessment.subject_id ?? '') === selectedSubject
    );
  }, [availableAssessments, selectedSubject]);

  useEffect(() => {
    if (filteredAssessments.length === 0) {
      setSelectedAssessmentId('');
      return;
    }

    setSelectedAssessmentId((current) => {
      const stillExists = filteredAssessments.some(
        (assessment) => String(assessment.exercise_id) === String(current)
      );
      return stillExists ? current : String(filteredAssessments[0].exercise_id);
    });
  }, [filteredAssessments]);

  const selectedAssessment = useMemo(
    () =>
      filteredAssessments.find(
        (assessment) => String(assessment.exercise_id) === String(selectedAssessmentId)
      ) ?? null,
    [filteredAssessments, selectedAssessmentId]
  );

  const fileLabel = useMemo(() => {
    if (selectedFiles.length === 0) return 'Drop files here or click to browse';
    return `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} ready to upload`;
  }, [selectedFiles.length]);

  const handleFiles = (event) => {
    const fileList = Array.from(event.target.files || []);
    if (fileList.length === 0) return;
    setSelectedFiles((current) => [...current, ...fileList]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const fileList = Array.from(event.dataTransfer.files || []);
    if (fileList.length === 0) return;
    setSelectedFiles((current) => [...current, ...fileList]);
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setSubmitMessage('');
  };

  const preventDefault = (event) => event.preventDefault();

  const handleSubmit = async () => {
    if (!studentId) {
      setSubmitMessage('Please log in as a student to submit work.');
      return;
    }

    if (!selectedAssessment) {
      setSubmitMessage('Choose an assessment first.');
      return;
    }

    if (selectedFiles.length === 0) {
      setSubmitMessage('Upload at least one file before submitting.');
      return;
    }

    setSubmitLoading(true);
    setSubmitMessage('');

    try {
      const formData = new FormData();
      formData.append('student_id', String(studentId));
      formData.append('exercise_id', String(selectedAssessment.exercise_id));
      selectedFiles.forEach((file) => {
        formData.append('files[]', file);
      });

      const response = await fetch(`${API_BASE_URL}/submit_assessment.php`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to submit assessment.');
      }

      setSubmitMessage('Assessment submitted successfully. Your teacher can now see it in Grade Submissions.');
      setSelectedFiles([]);

      setAvailableAssessments((current) =>
        current.map((assessment) =>
          assessment.exercise_id === selectedAssessment.exercise_id
            ? {
                ...assessment,
                already_submitted: true,
                latest_submission_at: new Date().toISOString(),
              }
            : assessment
        )
      );
    } catch (error) {
      setSubmitMessage(error.message || 'Unable to submit assessment.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent py-8">
      <div className="mx-auto max-w-6xl space-y-6 px-4 md:px-6">
        <div className="space-y-2 px-2">
          <h1 className="text-3xl font-bold text-slate-900">Submit Assessment</h1>
          <p className="text-sm text-slate-500">
            Choose one of your enrolled subjects, pick an available assessment, then upload your completed handwritten work.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-slate-900">Choose Assessment</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(event) => setSelectedSubject(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {subjectOptions.map((subject) => (
                    <option key={subject.value} value={subject.value}>
                      {subject.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Assessment
                </label>
                <select
                  value={selectedAssessmentId}
                  onChange={(event) => setSelectedAssessmentId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={filteredAssessments.length === 0}
                >
                  {filteredAssessments.length === 0 ? (
                    <option value="">No assessments available</option>
                  ) : (
                    filteredAssessments.map((assessment) => (
                      <option key={assessment.exercise_id} value={assessment.exercise_id}>
                        {assessment.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {loadingSubjects || loadingAssessments ? (
                  <p>Loading your enrolled subjects and assessments...</p>
                ) : subjectsError ? (
                  <p className="text-red-600">{subjectsError}</p>
                ) : assessmentsError ? (
                  <p className="text-red-600">{assessmentsError}</p>
                ) : selectedAssessment ? (
                  <div className="space-y-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Assessment</p>
                        <p className="font-semibold text-slate-900">{selectedAssessment.title}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Subject</p>
                        <p className="font-semibold text-slate-900">{selectedAssessment.subject_name}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Topic</p>
                        <p className="font-semibold text-slate-900">{selectedAssessment.topic || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Items</p>
                        <p className="font-semibold text-slate-900">{selectedAssessment.item_count || 0}</p>
                      </div>
                    </div>
                    {selectedAssessment.description && (
                      <p>{selectedAssessment.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      {selectedAssessment.difficulty && <span>Difficulty: {selectedAssessment.difficulty}</span>}
                      {selectedAssessment.subject_meta && <span>{selectedAssessment.subject_meta}</span>}
                      <span>
                        {selectedAssessment.already_submitted
                          ? `Last submitted: ${formatDateTime(selectedAssessment.latest_submission_at)}`
                          : 'Not submitted yet'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p>No assessment is available for the selected subject yet.</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-slate-900">Upload Handwritten Solutions</h2>
            <p className="mt-1 text-sm text-slate-500">
              Take photos or scan your handwritten solutions and upload them here. Each file can be up to 10MB.
            </p>

            <label
              onDragOver={preventDefault}
              onDragEnter={preventDefault}
              onDragLeave={preventDefault}
              onDrop={handleDrop}
              className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center transition hover:border-blue-400 hover:bg-blue-50"
            >
              <input onChange={handleFiles} type="file" multiple accept=".jpg,.jpeg,.png,.pdf" className="hidden" />
              <span className="text-3xl">Upload</span>
              <p className="text-sm font-semibold text-slate-700">{fileLabel}</p>
              <p className="text-xs text-slate-500">Supported formats: JPG, PNG, PDF</p>
              <span className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow">
                Choose Files
              </span>
            </label>

            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                {selectedFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-2">
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                ))}
              </div>
            )}

            {submitMessage && (
              <p className={`mt-4 text-sm ${submitMessage.includes('successfully') ? 'text-emerald-600' : 'text-rose-600'}`}>
                {submitMessage}
              </p>
            )}
          </section>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={clearFiles}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
          >
            Clear Files
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:bg-blue-400"
            disabled={submitLoading || selectedFiles.length === 0 || !selectedAssessment}
          >
            {submitLoading ? 'Submitting...' : 'Submit Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmitAssessment;
