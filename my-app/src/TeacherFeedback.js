import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const TeacherFeedback = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = storedTeacher?.user_id ?? storedTeacher?.teacher_id ?? storedTeacher?.id ?? null;

  const [records, setRecords] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const assessmentOptions = useMemo(() => {
    const grouped = new Map();

    records.forEach((record) => {
      const key = String(record.exercise_id ?? record.assessment_title ?? '');
      if (!key) return;
      if (!grouped.has(key)) {
        grouped.set(key, {
          value: key,
          label: record.assessment_title || 'Untitled Assessment',
          subject: record.subject_name || 'Assessment',
          count: 0,
        });
      }

      grouped.get(key).count += 1;
    });

    return Array.from(grouped.values());
  }, [records]);

  const compactAssessmentLabel = (subject, label) => {
    const subjectText = String(subject || '').trim();
    const labelText = String(label || '').trim();
    if (!subjectText) return labelText;
    const repeatedPrefix = `${subjectText} - ${subjectText} - `;
    if (labelText.startsWith(repeatedPrefix)) {
      return `${subjectText} - ${labelText.slice(repeatedPrefix.length)}`;
    }
    return `${subjectText} - ${labelText}`;
  };

  const filteredRecords = useMemo(
    () => records.filter((record) => String(record.exercise_id ?? record.assessment_title ?? '') === selectedAssessment),
    [records, selectedAssessment]
  );

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadFeedback = async () => {
      if (!teacherId) {
        if (isMounted) {
          setLoading(false);
          setRecords([]);
          setErrorMessage('Log in as a teacher to view graded submissions.');
        }
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams({ teacher_id: String(teacherId) });

        const response = await fetch(`${API_BASE_URL}/get_teacher_feedback.php?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'Unable to load graded submissions.');
        }

        if (!isMounted) return;

        const nextRecords = Array.isArray(payload.records) ? payload.records : [];
        setRecords(nextRecords);
        setSelectedRecord((current) => nextRecords.find((record) => record.score_id === current?.score_id) || nextRecords[0] || null);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        if (isMounted) {
          setRecords([]);
          setSelectedRecord(null);
          setErrorMessage(error.message || 'Unable to load graded submissions.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadFeedback();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [teacherId]);

  useEffect(() => {
    if (assessmentOptions.length === 0) {
      setSelectedAssessment('');
      return;
    }

    setSelectedAssessment((current) => {
      const stillValid = assessmentOptions.some((assessment) => assessment.value === current);
      return stillValid ? current : assessmentOptions[0].value;
    });
  }, [assessmentOptions]);

  useEffect(() => {
    if (filteredRecords.length === 0) {
      setSelectedRecord(null);
      setDetailsModalOpen(false);
      return;
    }

    setSelectedRecord((current) => {
      const stillVisible = filteredRecords.find((record) => record.score_id === current?.score_id);
      return stillVisible || filteredRecords[0];
    });
  }, [filteredRecords]);

  const openDetailsModal = (record) => {
    setSelectedRecord(record);
    setDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setDetailsModalOpen(false);
  };

  return (
    <div className="h-full min-h-0 overflow-hidden px-4 py-4 md:px-6 md:py-5">
      <div className="mx-auto flex h-full min-h-0 max-w-[1440px] flex-col gap-10 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="teacher-eyebrow">Feedback</p>
            <h1 className="teacher-heading">Results & Feedback</h1>
            <p className="text-sm text-slate-500">
              Review every submission that already has a saved grade and teacher feedback.
            </p>
          </div>
          <div className="teacher-status-pill bg-blue-50 text-blue-700">
            {loading ? 'Loading...' : `${filteredRecords.length} graded submissions`}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-500">Filter by Assessment</label>
            <select
              value={selectedAssessment}
              onChange={(event) => setSelectedAssessment(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {assessmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {compactAssessmentLabel(option.subject, option.label)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-md font-semibold text-slate-900">Students</p>
                <p className="text-sm text-slate-500">
                  {loading ? 'Loading graded submissions...' : `${filteredRecords.length} student submission(s) found`}
                </p>
              </div>
              {selectedRecord && (
                <span className="teacher-status-pill bg-blue-50 text-blue-700">
                  Selected
                </span>
              )}
            </div>
            {errorMessage && <p className="mb-3 text-xs text-red-600">{errorMessage}</p>}

            <div className="teacher-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-3 pb-2 max-h-[calc(100vh-330px)] md:max-h-[calc(100vh-300px)]">
              {!loading && filteredRecords.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No graded submissions yet. Save a result from Grade Submissions first.
                </div>
              ) : (
                filteredRecords.map((record) => {
                  const isActive = selectedRecord?.score_id === record.score_id;
                  return (
                      <button
                        key={record.score_id}
                        type="button"
                        onClick={() => openDetailsModal(record)}
                        className={`relative w-full overflow-hidden rounded-[1.3rem] border border-slate-900/10 bg-slate-100/70 p-3.5 text-left shadow-[0_14px_32px_rgba(148,163,184,0.14)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_36px_rgba(148,163,184,0.18)] ${
                          isActive
                            ? 'border-blue-300 bg-blue-50'
                            : ''
                        }`}
                      >
                        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[1.05rem] font-bold text-slate-900">{record.student_name}</p>
                            <p className="mt-1 text-sm text-slate-500">{record.assessment_title}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span>{record.submission_date}</span>
                              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
                              <span className="truncate">{record.subject_name}</span>
                            </div>
                          </div>
                          <span className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-center text-xs font-semibold text-emerald-700 shadow-sm">
                            {record.score}%
                          </span>
                        </div>
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>

      {detailsModalOpen && selectedRecord && typeof document !== 'undefined' && createPortal((
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md">
          <div className="mx-auto flex max-h-[88vh] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] ring-1 ring-white/70">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Student Review</p>
                <h2 className="text-lg font-semibold text-slate-900">{selectedRecord.student_name}</h2>
                <p className="text-xs text-slate-500">{selectedRecord.assessment_title}</p>
              </div>
              <button
                type="button"
                onClick={closeDetailsModal}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="teacher-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="rounded-2xl bg-blue-50 p-4">
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student</p>
                    <p className="font-semibold text-slate-900">{selectedRecord.student_name}</p>
                    <p className="text-xs text-slate-500">Assessment: {selectedRecord.assessment_title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student ID</p>
                    <p className="font-semibold text-slate-900">{selectedRecord.student_id || 'Unavailable'}</p>
                    <p className="text-xs text-slate-500">Submitted: {selectedRecord.submission_date || 'Unavailable'}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Saved Grade</p>
                  <p className="mt-1 text-3xl font-black text-blue-700">
                    {selectedRecord.score !== null && selectedRecord.score !== undefined ? `${selectedRecord.score}%` : 'N/A'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Subject</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedRecord.subject_name || 'No subject'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Scored At</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedRecord.date_scored ? new Date(selectedRecord.date_scored).toLocaleString() : 'Recently saved'}
                  </p>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.35em] text-blue-400">Generated Result</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                    Saved result
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Feedback</p>
                  <div className="teacher-scrollbar mt-3 max-h-64 overflow-y-auto pr-2">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {selectedRecord.ai_feedback || 'No saved feedback for this submission.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};

export default TeacherFeedback;
