import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

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

const formatDate = (value) => {
  if (!value) return 'Not available';
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
  const studentId = currentUser?.student_id ?? currentUser?.user_id ?? null;
  const studentName = getDisplayName(currentUser);

  const [records, setRecords] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
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

  const assessmentOptions = useMemo(() => {
    return filteredRecords.map((record) => ({
      value: String(record.score_id),
      label: record.assessment_title || 'Untitled Assessment',
      subjectLabel: record.subject_name || 'Unassigned Subject',
      score: record.score,
      record,
    }));
  }, [filteredRecords]);

  const selectedRecord = useMemo(() => {
    if (!selectedAssessmentId) {
      return assessmentOptions[0]?.record ?? null;
    }

    return assessmentOptions.find((option) => option.value === selectedAssessmentId)?.record ?? assessmentOptions[0]?.record ?? null;
  }, [assessmentOptions, selectedAssessmentId]);

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
    if (assessmentOptions.length === 0) {
      setSelectedAssessmentId('');
      return;
    }

    setSelectedAssessmentId((current) => {
      const stillValid = assessmentOptions.some((option) => option.value === current);
      return stillValid ? current : assessmentOptions[0].value;
    });
  }, [assessmentOptions]);

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

  useEffect(() => {
    setShowFilters(false);
  }, [selectedSubjectId, selectedAssessmentId]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Returned Results</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Scores & Feedback</h1>
        <p className="mt-2 text-sm text-slate-500">
          View the scores and feedback that your teacher has returned for your own account only.
        </p>
        <p className="mt-1 text-xs text-slate-400">Signed in as {studentName}</p>
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
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              className="flex w-full items-center justify-between rounded-[1.5rem] border border-slate-100 bg-white px-5 py-4 text-left shadow-sm"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Filters</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Subject and assessment</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                {showFilters ? 'Hide' : 'Show'}
              </span>
            </button>
          </div>

          {showFilters && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-[80] lg:hidden">
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setShowFilters(false)}
                className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
              />
              <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-hidden rounded-t-[2rem] border border-slate-100 bg-white shadow-[0_-18px_60px_rgba(15,23,42,0.22)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Filters</p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">Pick subject and assessment</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm"
                  >
                    Close
                  </button>
                </div>
                <div className="teacher-scrollbar max-h-[calc(80vh-4.5rem)] space-y-4 overflow-y-auto px-5 py-5 pb-8">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Filter by Subject</p>
                    <label className="mt-3 block text-sm font-semibold text-slate-500">Subject</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(event) => setSelectedSubjectId(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      {subjectOptions.map((subject) => (
                        <option key={subject.value} value={subject.value}>
                          {subject.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-500">Assessment</label>
                    <select
                      value={selectedAssessmentId}
                      onChange={(event) => setSelectedAssessmentId(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      disabled={assessmentOptions.length === 0}
                    >
                      {assessmentOptions.length === 0 ? (
                        <option value="">No assessments available</option>
                      ) : (
                        assessmentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {assessmentOptions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quick Switch</p>
                      <div className="space-y-2">
                        {assessmentOptions.map((option) => {
                          const isActive = option.value === selectedAssessmentId;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setSelectedAssessmentId(option.value)}
                              className={`w-full rounded-[1.25rem] border px-4 py-3 text-left transition ${
                                isActive
                                  ? 'border-blue-300 bg-blue-50 shadow-sm'
                                  : 'border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/50'
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {option.score !== null && option.score !== undefined ? `${option.score}%` : 'No score'}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}

          <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <aside className="sticky top-6 hidden self-start space-y-4 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm lg:block">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Filter by Subject</p>
              <label className="mt-3 block text-sm font-semibold text-slate-500">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={(event) => setSelectedSubjectId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {subjectOptions.map((subject) => (
                  <option key={subject.value} value={subject.value}>
                    {subject.label}
                  </option>
                ))}
              </select>
              {subjectOptions.length > 0 && (
                <p className="mt-2 text-xs text-slate-400">{subjectOptions.length} subject{subjectOptions.length === 1 ? '' : 's'} available</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-500">Assessment</label>
              <select
                value={selectedAssessmentId}
                onChange={(event) => setSelectedAssessmentId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                disabled={assessmentOptions.length === 0}
              >
                {assessmentOptions.length === 0 ? (
                  <option value="">No assessments available</option>
                ) : (
                  assessmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                )}
              </select>
              {assessmentOptions.length > 0 && (
                <p className="mt-2 text-xs text-slate-400">{assessmentOptions.length} assessment{assessmentOptions.length === 1 ? '' : 's'} in this subject</p>
              )}
            </div>

            {assessmentOptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quick Switch</p>
                <div className="teacher-scrollbar max-h-64 space-y-2 overflow-y-auto pr-3 pl-1">
                  {assessmentOptions.map((option) => {
                    const isActive = option.value === selectedAssessmentId;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedAssessmentId(option.value)}
                        className={`w-full rounded-[1.25rem] border px-4 py-3 text-left transition ${
                          isActive
                            ? 'border-blue-300 bg-blue-50 shadow-sm'
                            : 'border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/50'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {option.score !== null && option.score !== undefined ? `${option.score}%` : 'No score'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          <motion.section
            className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm"
            variants={resultVariants}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.35 }}
          >
            {!selectedRecord ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Select a subject and assessment to view the returned score.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-[1.75rem] bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Submission</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedRecord.student_name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedRecord.assessment_title}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>{selectedRecord.subject_name}</span>
                    <span>Student ID {selectedRecord.student_id}</span>
                    <span>Submitted {selectedRecord.submission_date}</span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Saved Grade</p>
                    <p className="mt-3 text-4xl font-black text-slate-900">
                      {selectedRecord.score !== null && selectedRecord.score !== undefined ? `${selectedRecord.score}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Exact Score</p>
                    <p className="mt-3 text-2xl font-bold text-blue-700">{formatExactScore(selectedRecord)}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Scored At</p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {selectedRecord.date_scored ? new Date(selectedRecord.date_scored).toLocaleString() : 'Recently saved'}
                    </p>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">AI Feedback</p>
                      <p className="mt-2 text-sm text-slate-500">
                        This combines the explanation, score review, and edit notes for the submission.
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
            )}
          </motion.section>
        </div>
        </>
      )}
    </div>
  );
};

export default StudentReports;
