import React, { useEffect, useMemo, useState } from 'react';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const TeacherFeedback = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = storedTeacher?.teacher_id ?? storedTeacher?.user_id ?? storedTeacher?.id ?? null;

  const [records, setRecords] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

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
        if (selectedSubject !== 'all') {
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
        setSubjects(Array.from(subjectMap.entries()).map(([value, label]) => ({ value: String(value), label })));
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

  const subjectOptions = useMemo(
    () => [{ value: 'all', label: 'All Subjects' }, ...subjects],
    [subjects]
  );

  return (
    <div className="space-y-8 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="page-hero-card p-8">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Feedback</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Results & Feedback</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review every submission that already has a saved grade and teacher feedback.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.95fr,1.05fr]">
          <div className="space-y-6">
            <div className="page-hero-card p-6">
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

            <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg">
              <div className="mb-4">
                <p className="text-md font-semibold text-slate-900">Graded Submissions</p>
                <p className="text-sm text-slate-500">
                  {loading ? 'Loading graded submissions...' : `${records.length} graded submission(s) found`}
                </p>
                {errorMessage && <p className="mt-2 text-xs text-red-600">{errorMessage}</p>}
              </div>

              <div className="teacher-scrollbar max-h-[520px] space-y-4 overflow-y-auto pr-2">
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
                        className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
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

          <div className="page-hero-card p-8">
            {!selectedRecord ? (
              <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Select a graded submission to view the saved result.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl bg-blue-50 p-5">
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
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Saved Grade</p>
                    <p className="mt-3 text-4xl font-black text-slate-900">{selectedRecord.score}%</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Scored At</p>
                    <p className="mt-3 text-lg font-semibold text-slate-900">
                      {selectedRecord.date_scored ? new Date(selectedRecord.date_scored).toLocaleString() : 'Recently saved'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Teacher Feedback</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {selectedRecord.teacher_feedback || 'No written feedback was saved for this submission.'}
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
