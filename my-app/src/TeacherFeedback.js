import React, { useEffect, useMemo, useState } from 'react';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { getSubjectCardTheme } from './subjectCardThemes';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const TeacherFeedback = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = storedTeacher?.teacher_id ?? storedTeacher?.user_id ?? storedTeacher?.id ?? null;

  const [records, setRecords] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

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
      return;
    }

    setSelectedRecord((current) => {
      const stillVisible = filteredRecords.find((record) => record.score_id === current?.score_id);
      return stillVisible || filteredRecords[0];
    });
  }, [filteredRecords]);

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

          <div className="teacher-float-card flex min-h-0 flex-1 flex-col p-4 md:p-5">
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

            <div className="teacher-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {!loading && filteredRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No graded submissions yet. Save a result from Grade Submissions first.
                </div>
              ) : (
                filteredRecords.map((record) => {
                  const isActive = selectedRecord?.score_id === record.score_id;
                  const recordTheme = getSubjectCardTheme(record);
                  return (
                      <button
                        key={record.score_id}
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        className={`relative w-full overflow-hidden rounded-[1.45rem] border border-slate-900/10 p-3.5 text-left shadow-[0_14px_32px_rgba(148,163,184,0.12)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_36px_rgba(148,163,184,0.18)] ${
                          isActive
                            ? `${recordTheme.surfaceClass} border-blue-300`
                            : `${recordTheme.surfaceClass}`
                        }`}
                      >
                        <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${recordTheme.accentClass}`} />
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
    </div>
  );
};

export default TeacherFeedback;
