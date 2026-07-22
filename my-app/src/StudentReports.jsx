import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';
import Select from './components/Select';

const getDisplayName = (user) => {
  if (!user) return 'Student';

  const firstName = user.firstName ?? user.first_Name ?? '';
  const middleName = user.middleName ?? user.middle_Name ?? '';
  const lastName = user.lastName ?? user.last_Name ?? '';
  const combinedName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

  if (combinedName) {
    return combinedName;
  }

  if (typeof user.name === 'string' && user.name.trim()) {
    return user.name.trim();
  }

  return 'Student';
};

const formatExactScore = (record) => {
  const rawScore = record?.raw_score_earned;
  const maxScore = record?.max_score_possible;

  if (rawScore === null || rawScore === undefined || maxScore === null || maxScore === undefined) {
    return 'Exact score unavailable';
  }

  return `${Number(rawScore).toFixed(2)} / ${Number(maxScore).toFixed(2)} pts`;
};

const resultVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const StudentReports = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const currentUser = currentEmail ? findLocalUser(currentEmail) : null;
  const studentId = currentUser?.user_id ?? currentUser?.student_id ?? null;
  const studentName = getDisplayName(currentUser);

  const [records, setRecords] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const loadResults = useCallback(
    async (signal) => {
      if (!studentId) {
        setRecords([]);
        setLoading(false);
        setErrorMessage('Log in as a student to view your returned results.');
        setLastUpdated('');
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(`${API_BASE_URL}/get_student_results.php?student_id=${studentId}`, {
          credentials: 'include',
          signal,
        });
        const payload = await response.json();

        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'Unable to load your results.');
        }

        setRecords(Array.isArray(payload.records) ? payload.records : []);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      } catch (error) {
        if (signal?.aborted) return;
        setRecords([]);
        setErrorMessage(error.message || 'Unable to load your results.');
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [studentId]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadResults(controller.signal);
    return () => controller.abort();
  }, [loadResults]);

  useEffect(() => {
    if (!studentId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadResults();
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [loadResults, studentId]);

  const subjectOptions = useMemo(() => {
    const groups = new Map();

    records.forEach((record) => {
      const key = String(record.subject_id ?? record.subject_name ?? 'unknown');
      if (!groups.has(key)) {
        groups.set(key, {
          value: key,
          label: record.subject_name || 'Unassigned Subject',
          code: record.subject_code || '',
          subject_id: record.subject_id ?? null,
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (!selectedSubjectId) {
      return [];
    }

    return records
      .filter((record) => String(record.subject_id ?? record.subject_name ?? 'unknown') === selectedSubjectId)
      .sort((a, b) => {
        const dateA = new Date(a.date_scored ?? 0).getTime();
        const dateB = new Date(b.date_scored ?? 0).getTime();
        return dateB - dateA;
      });
  }, [records, selectedSubjectId]);

  const selectedRecord = useMemo(() => {
    if (!selectedAssessmentId) {
      return filteredRecords[0] ?? null;
    }

    return filteredRecords.find((record) => String(record.score_id) === selectedAssessmentId) ?? filteredRecords[0] ?? null;
  }, [filteredRecords, selectedAssessmentId]);

  useEffect(() => {
    if (subjectOptions.length === 0) {
      setSelectedSubjectId('');
      return;
    }

    setSelectedSubjectId((current) => {
      const stillValid = subjectOptions.some((subject) => subject.value === current);
      return stillValid ? current : subjectOptions[0].value;
    });
  }, [subjectOptions]);

  useEffect(() => {
    if (filteredRecords.length === 0) {
      setSelectedAssessmentId('');
      return;
    }

    setSelectedAssessmentId((current) => {
      const stillValid = filteredRecords.some((record) => String(record.score_id) === current);
      return stillValid ? current : String(filteredRecords[0].score_id);
    });
  }, [filteredRecords]);

  const stats = useMemo(() => {
    const scoredRecords = records.filter((record) => record.score !== null && record.score !== undefined);
    const averageScore =
      scoredRecords.length > 0
        ? Math.round(
          scoredRecords.reduce((total, record) => total + Number(record.score || 0), 0) /
          scoredRecords.length
        )
        : null;

    return {
      returned: records.length,
      subjects: subjectOptions.length,
      averageScore: averageScore !== null ? `${averageScore}%` : 'TBD',
    };
  }, [records, subjectOptions.length]);

  const openDetailsModal = (record) => {
    if (!record?.score_id) return;
    setSelectedAssessmentId(String(record.score_id));
    setDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setDetailsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Returned Results</p>
        <h1 className="text-3xl font-bold text-slate-900">Scores & Feedback</h1>
        <p className="text-sm text-slate-500">
          View the scores and feedback that your teacher has returned for your own account only.
        </p>
        <p className="text-xs text-slate-400">Signed in as {studentName}</p>
      </section>

      {lastUpdated && !loading && !errorMessage && (
        <p className="text-right text-xs text-slate-400">Last updated {lastUpdated}</p>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Returned</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{stats.returned}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-100 bg-emerald-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Subjects</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{stats.subjects}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-100 bg-amber-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Average Score</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{stats.averageScore}</p>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Loading your returned results...
        </div>
      ) : errorMessage ? (
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-lg font-semibold text-slate-900">No returned results yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Once your teacher returns an assessment, the score and feedback will appear here.
          </p>
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Filter by Subject</p>
            <Select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              placeholder="All subjects"
            >
              {subjectOptions.map((subject) => (
                <option key={subject.value} value={subject.value}>
                  {subject.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-slate-400">
              {subjectOptions.length} subject{subjectOptions.length === 1 ? '' : 's'} available
            </p>
          </section>

          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-md font-semibold text-slate-900">Assessments</p>
                <p className="text-sm text-slate-500">
                  {filteredRecords.length} returned assessment{filteredRecords.length === 1 ? '' : 's'} found
                </p>
              </div>
              {selectedRecord && (
                <span className="teacher-status-pill bg-blue-50 text-blue-700">
                  Selected
                </span>
              )}
            </div>

            {filteredRecords.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No returned assessments were found for this subject yet.
              </div>
            ) : (
              <div className="teacher-scrollbar max-h-[calc(100vh-420px)] space-y-4 overflow-y-auto pr-2 pb-6">
                {filteredRecords.map((record) => {
                  const isActive = String(record.score_id) === selectedAssessmentId && detailsModalOpen;
                  return (
                    <motion.button
                      key={record.score_id}
                      type="button"
                      onClick={() => openDetailsModal(record)}
                      className={`relative w-full overflow-hidden rounded-[1.6rem] border border-slate-900/10 bg-slate-100/70 p-4 text-left shadow-[0_14px_32px_rgba(148,163,184,0.14)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_36px_rgba(148,163,184,0.18)] ${isActive ? 'border-blue-300 bg-blue-50' : ''
                        }`}
                      variants={resultVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[1.05rem] font-bold text-slate-900">{record.assessment_title}</p>
                          <p className="mt-2 text-sm text-slate-500">{record.subject_name}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>{record.submission_date}</span>
                            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
                            <span>{formatExactScore(record)}</span>
                          </div>
                        </div>
                        <span className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700 shadow-sm">
                          {record.score !== null && record.score !== undefined ? `${record.score}%` : 'N/A'}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {detailsModalOpen && selectedRecord && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md">
          <div className="mx-auto flex max-h-[88vh] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] ring-1 ring-white/70">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Assessment</p>
                <h2 className="text-lg font-semibold text-slate-900">{selectedRecord.assessment_title}</h2>
                <p className="text-xs text-slate-500">{selectedRecord.subject_name}</p>
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
              <div className="rounded-[1.75rem] bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Assessment</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedRecord.assessment_title}</h2>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{selectedRecord.subject_name}</span>
                  <span>Submitted {selectedRecord.submission_date}</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Returned Grade</p>
                  <p className="mt-3 text-4xl font-black text-slate-900">
                    {selectedRecord.score !== null && selectedRecord.score !== undefined ? `${selectedRecord.score}%` : 'N/A'}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Exact Score</p>
                  <p className="mt-3 text-2xl font-bold text-blue-700">{formatExactScore(selectedRecord)}</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Returned At</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {selectedRecord.returned_at ? new Date(selectedRecord.returned_at).toLocaleString() : 'Recently returned'}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Feedback</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Review the teacher-approved score details and AI feedback for this assessment.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-600 shadow-sm">
                    Returned
                  </span>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-slate-700">
                  {selectedRecord.ai_feedback || 'No AI feedback was saved for this submission.'}
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StudentReports;
