import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';
import Select from './components/Select';

const toAbsoluteFileUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = String(path).replace(/^\/+/, '');
  return `${API_BASE_URL}/${normalizedPath}`;
};

const formatOcrText = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const trimmed = line.trim();
    const labelMatch = trimmed.match(/^(Question|Item|Problem|Part|Q|P|No\.?|Number)\s*(\d+[\.:)]?)\s*(.*)/i);
    if (labelMatch) {
      return (
        <div key={i} className="mt-2 first:mt-0">
          <span className="font-bold text-slate-900">{labelMatch[1]} {labelMatch[2]}</span>
          {labelMatch[3] && <span className="text-slate-700"> {labelMatch[3]}</span>}
        </div>
      );
    }
    const numberedMatch = trimmed.match(/^(\d+[\.:)]?)\s+(.*)/);
    if (numberedMatch && numberedMatch[2]) {
      return (
        <div key={i} className="mt-1.5 first:mt-0">
          <span className="font-semibold text-slate-800">{numberedMatch[1]}</span>
          <span className="text-slate-700"> {numberedMatch[2]}</span>
        </div>
      );
    }
    if (trimmed === '') {
      return <div key={i} className="h-2" />;
    }
    return (
      <p key={i} className="text-slate-700">{trimmed}</p>
    );
  });
};

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
      {/* Blue Gradient Header */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-5 py-4 text-white shadow-lg shadow-blue-200/50">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-indigo-400/20 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-blue-100">Returned Results</p>
          </div>
          <h1 className="text-xl font-black tracking-tight">Scores & Feedback</h1>
          <p className="mt-1 text-xs text-blue-100">View scores and feedback returned by your teacher.</p>
          <p className="mt-1.5 text-[10px] text-blue-200">Signed in as {studentName}</p>
        </div>
      </section>

      {lastUpdated && !loading && !errorMessage && (
        <p className="text-right text-xs text-slate-400">Last updated {lastUpdated}</p>
      )}

      <section className="grid gap-2 md:grid-cols-3">
        <div className="group relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-3 shadow-sm transition hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-blue-100/60 blur-2xl transition group-hover:bg-blue-200/60" />
          <div className="relative z-10">
            <div className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-blue-100">
              <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-blue-400">Returned</p>
            <p className="mt-0.5 text-lg font-black text-slate-900">{stats.returned}</p>
            <p className="text-[9px] text-slate-400">assessment{stats.returned === 1 ? '' : 's'} graded</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-3 shadow-sm transition hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-100/60 blur-2xl transition group-hover:bg-emerald-200/60" />
          <div className="relative z-10">
            <div className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100">
              <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
              </svg>
            </div>
            <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-emerald-400">Subjects</p>
            <p className="mt-0.5 text-lg font-black text-slate-900">{stats.subjects}</p>
            <p className="text-[9px] text-slate-400">active subject{stats.subjects === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-3 shadow-sm transition hover:shadow-md">
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-amber-100/60 blur-2xl transition group-hover:bg-amber-200/60" />
          <div className="relative z-10">
            <div className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-amber-100">
              <svg className="h-3 w-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
            <p className="text-[8px] font-bold uppercase tracking-[0.25em] text-amber-400">Average Score</p>
            <p className="mt-0.5 text-lg font-black text-slate-900">{stats.averageScore}</p>
            <p className="text-[9px] text-slate-400">across all assessments</p>
          </div>
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

          <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900">Assessments</p>
                <p className="text-[11px] text-slate-500">
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
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No returned assessments were found for this subject yet.
              </div>
            ) : (
              <div className="teacher-scrollbar max-h-[calc(100vh-420px)] space-y-2 overflow-y-auto pr-2 pb-6">
                {filteredRecords.map((record) => {
                  const isActive = String(record.score_id) === selectedAssessmentId && detailsModalOpen;
                  const scoreNum = Number(record.score);
                  const hasScore = record.score !== null && record.score !== undefined;
                  return (
                    <motion.button
                      key={record.score_id}
                      type="button"
                      onClick={() => openDetailsModal(record)}
                      className={`group relative overflow-hidden rounded-xl border border-l-[3px] border-l-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 p-3 pl-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:p-4 sm:pl-5 ${isActive ? 'shadow-[0_4px_20px_rgba(59,130,246,0.12)]' : ''}`}
                      variants={resultVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-sky-400 via-blue-500 to-indigo-500" />
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-blue-100 text-[10px] sm:text-xs font-bold text-blue-700">
                          {record.assessment_title?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{record.assessment_title}</p>
                          <p className="mt-0.5 text-[10px] sm:text-[11px] text-blue-600/80 truncate">{record.subject_name}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                              {record.submission_date}
                            </span>
                            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
                            <span>{formatExactScore(record)}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {hasScore ? (
                            <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl text-xs sm:text-sm font-black ${
                              scoreNum >= 80 ? 'bg-emerald-100 text-emerald-700' :
                              scoreNum >= 50 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-600'
                            }`}>
                              {scoreNum}%
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-slate-100 text-xs sm:text-sm font-bold text-slate-400">
                              N/A
                            </div>
                          )}
                        </div>
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
            {/* Modal Header */}
            <div className="relative shrink-0 border-b border-slate-200 px-6 py-5">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-white to-indigo-50" />
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-100/40 blur-2xl" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-sm font-bold text-white shadow-md shadow-blue-200/50">
                    {selectedRecord.assessment_title?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Assessment Detail</p>
                    <h2 className="truncate text-lg font-bold text-slate-900">{selectedRecord.assessment_title}</h2>
                    <p className="truncate text-xs text-slate-500">{selectedRecord.subject_name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDetailsModal}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="teacher-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="rounded-[1.5rem] bg-gradient-to-br from-blue-50 via-white to-indigo-50/50 p-6 shadow-sm ring-1 ring-blue-100/50">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-100">
                    <svg className="h-3 w-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                    {selectedRecord.subject_name}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-100">
                    <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    Submitted {selectedRecord.submission_date}
                  </span>
                </div>
              </div>

              {/* Score Summary Cards */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="group relative overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-blue-500 to-indigo-500 p-5 text-white shadow-lg shadow-blue-200/50 transition hover:shadow-xl">
                  <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10 blur-xl" />
                  <p className="relative text-[10px] font-bold uppercase tracking-[0.3em] text-blue-100">Returned Grade</p>
                  <p className="relative mt-2 text-4xl font-black">
                    {selectedRecord.score !== null && selectedRecord.score !== undefined ? `${selectedRecord.score}%` : 'N/A'}
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Exact Score</p>
                  <p className="mt-2 text-xl font-bold text-blue-700">{formatExactScore(selectedRecord)}</p>
                </div>
                <div className="relative overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Returned At</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {selectedRecord.returned_at ? new Date(selectedRecord.returned_at).toLocaleString() : 'Recently returned'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                      <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">Feedback</p>
                      <p className="text-[11px] text-slate-400">Teacher-approved score details and AI feedback</p>
                    </div>
                    <span className="ml-auto rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-600 shadow-sm ring-1 ring-blue-100">
                      Returned
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/80 p-4 ring-1 ring-blue-100/50">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {selectedRecord.ai_feedback || 'No AI feedback was saved for this submission.'}
                    </p>
                  </div>
                </div>

                {selectedRecord.ocr_text && typeof selectedRecord.ocr_text === 'string' && selectedRecord.ocr_text.trim() && (
                  <div className="rounded-[1.5rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                        <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400">AI Extracted Solution</p>
                        <p className="text-[11px] text-slate-400">Text extracted from your submission by AI</p>
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-xl bg-white/80 p-4 ring-1 ring-blue-100/50" style={{ scrollbarWidth: 'thin' }}>
                      <p className="mb-2 text-[10px] text-slate-400 italic">Extracted text may contain errors.</p>
                      {formatOcrText(selectedRecord.ocr_text)}
                    </div>
                  </div>
                )}
              </div>

              {Array.isArray(selectedRecord.item_scores) && selectedRecord.item_scores.length > 0 && (
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                      <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                      </svg>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Item Breakdown</p>
                  </div>
                  <div className="space-y-3">
                    {selectedRecord.item_scores.map((item, index) => {
                      const itemScore = Number(item.score_earned) || 0;
                      const itemMax = Number(item.max_score) || 0;
                      const itemPct = itemMax > 0 ? Math.round((itemScore / itemMax) * 100) : 0;
                      return (
                        <div key={item.item_score_id ?? index} className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50">
                          <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold text-white ${
                                itemPct >= 80 ? 'bg-gradient-to-br from-emerald-500 to-teal-500' :
                                itemPct >= 50 ? 'bg-gradient-to-br from-amber-500 to-orange-500' :
                                'bg-gradient-to-br from-red-500 to-rose-500'
                              }`}>
                                {item.item_no ?? index + 1}
                              </div>
                              <p className="text-sm font-semibold text-slate-700">Item {item.item_no ?? index + 1}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-black ${
                                itemPct >= 80 ? 'text-emerald-600' : itemPct >= 50 ? 'text-amber-600' : 'text-red-500'
                              }`}>
                                {itemScore.toFixed(2)} / {itemMax.toFixed(2)}
                              </p>
                              <p className="text-[10px] text-slate-400">{itemPct}%</p>
                            </div>
                          </div>
                          {item.question_content && (
                            <div className="px-4 py-2">
                              <p className="whitespace-pre-wrap text-xs text-slate-500">{item.question_content}</p>
                            </div>
                          )}
                          {item.ai_feedback && (
                            <div className="mx-3 mb-3 rounded-lg bg-blue-50/70 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-1">AI Feedback</p>
                              <p className="whitespace-pre-wrap text-xs leading-6 text-slate-600">{item.ai_feedback}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {Array.isArray(selectedRecord.files) && selectedRecord.files.length > 0 && (
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                      <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z" />
                      </svg>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Submitted Files</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {selectedRecord.files.map((file, index) => {
                      const fileUrl = toAbsoluteFileUrl(file.path);
                      return file.type === 'image' ? (
                        <a
                          key={index}
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50 shadow-sm transition hover:shadow-md"
                        >
                          <img
                            src={fileUrl}
                            alt={file.name}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2.5">
                            <p className="truncate text-[10px] font-medium text-white">{file.name}</p>
                          </div>
                        </a>
                      ) : (
                        <a
                          key={index}
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center transition hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm"
                        >
                          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9Z" />
                          </svg>
                          <p className="mt-2 truncate text-xs font-medium text-slate-600">{file.name}</p>
                        </a>
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
    </div>
  );
};

export default StudentReports;
