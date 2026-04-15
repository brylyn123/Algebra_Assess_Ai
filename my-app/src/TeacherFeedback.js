import React, { useEffect, useMemo, useState } from 'react';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const TeacherFeedback = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = storedTeacher?.teacher_id ?? storedTeacher?.user_id ?? storedTeacher?.id ?? null;

  const [records, setRecords] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const formatExactScore = (record) => {
    const rawScore = record?.raw_score_earned;
    const maxScore = record?.max_score_possible;
    if (rawScore === null || rawScore === undefined || maxScore === null || maxScore === undefined) {
      return 'Exact score unavailable';
    }

    return `${Number(rawScore).toFixed(2)} / ${Number(maxScore).toFixed(2)} pts`;
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadFeedback = async () => {
      if (!teacherId) {
        if (isMounted) {
          setLoading(false);
          setRecords([]);
          setSubjects([]);
          setErrorMessage('Log in as a teacher to view graded submissions.');
        }
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams({ teacher_id: String(teacherId) });
        if (selectedSubject) {
          params.set('subject_id', selectedSubject);
        }

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

        const subjectMap = new Map();
        nextRecords.forEach((record) => {
          if (!subjectMap.has(record.subject_id)) {
            subjectMap.set(record.subject_id, record.subject_name);
          }
        });
        const nextSubjects = Array.from(subjectMap.entries()).map(([value, label]) => ({ value: String(value), label }));
        setSubjects(nextSubjects);

        setSelectedSubject((current) => {
          if (nextSubjects.length === 0) {
            return '';
          }
          const stillValid = nextSubjects.some((subject) => subject.value === current);
          return stillValid ? current : nextSubjects[0].value;
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        if (isMounted) {
          setRecords([]);
          setSubjects([]);
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
  }, [teacherId, selectedSubject]);

  const subjectOptions = useMemo(() => subjects, [subjects]);

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
            {loading ? 'Loading...' : `${records.length} graded submissions`}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-10 lg:grid-cols-[0.95fr,1.05fr]">
          <div className="flex min-h-0 flex-col gap-7 overflow-hidden">
            <div className="teacher-float-card p-7">
              <label className="block text-sm font-semibold text-slate-500">Filter by Subject</label>
              <select
                value={selectedSubject}
                onChange={(event) => setSelectedSubject(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {subjectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="teacher-float-card flex min-h-0 flex-1 flex-col p-7">
              <div className="mb-4">
                <p className="text-md font-semibold text-slate-900">Graded Submissions</p>
                <p className="text-sm text-slate-500">
                  {loading ? 'Loading graded submissions...' : `${records.length} graded submission(s) found`}
                </p>
                {errorMessage && <p className="mt-2 text-xs text-red-600">{errorMessage}</p>}
              </div>

              <div className="teacher-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto pr-2">
                {!loading && records.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No graded submissions yet. Save a result from Grade Submissions first.
                  </div>
                ) : (
                  records.map((record) => {
                    const isActive = selectedRecord?.score_id === record.score_id;
                    return (
                      <button
                        key={record.score_id}
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        className={`teacher-float-card w-full p-5 text-left transition ${
                          isActive
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{record.student_name}</p>
                            <p className="text-sm text-slate-500">{record.assessment_title}</p>
                          </div>
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {record.score}%
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>{record.subject_name}</span>
                          <span>Submitted {record.submission_date}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="teacher-float-card flex min-h-0 flex-col p-7">
            {!selectedRecord ? (
              <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Select a graded submission to view the saved result.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="teacher-float-card p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Submission</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedRecord.student_name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedRecord.assessment_title}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>{selectedRecord.subject_name}</span>
                    <span>Student ID {selectedRecord.student_id}</span>
                    <span>Submitted {selectedRecord.submission_date}</span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="teacher-float-card p-6">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Saved Grade</p>
                    <p className="mt-3 text-4xl font-black text-slate-900">{selectedRecord.score}%</p>
                    <p className="mt-2 text-sm font-semibold text-slate-500">{formatExactScore(selectedRecord)}</p>
                  </div>
                  <div className="teacher-float-card p-6">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Scored At</p>
                    <p className="mt-3 text-lg font-semibold text-slate-900">
                      {selectedRecord.date_scored ? new Date(selectedRecord.date_scored).toLocaleString() : 'Recently saved'}
                    </p>
                  </div>
                </div>

                <div className="teacher-float-card p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">AI Feedback</p>
                      <p className="mt-2 text-sm text-slate-500">This combines the explanation, score review, and edit notes for the submission.</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-600">
                      Returned
                    </span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-slate-700">
                    {selectedRecord.ai_feedback || 'No AI feedback was saved for this submission.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherFeedback;
