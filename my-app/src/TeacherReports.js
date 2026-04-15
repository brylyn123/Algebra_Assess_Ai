import React, { useEffect, useState } from 'react';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { getSubjectCardTheme } from './subjectCardThemes';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const TeacherReports = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = storedTeacher?.teacher_id ?? storedTeacher?.user_id ?? storedTeacher?.id ?? null;

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadReport = async () => {
      if (!teacherId) {
        if (isMounted) {
          setLoading(false);
          setErrorMessage('Log in as a teacher to view reports.');
        }
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(`${API_BASE_URL}/get_teacher_reports.php?teacher_id=${teacherId}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'Unable to load reports.');
        }
        if (isMounted) {
          setReport(payload.report);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        if (isMounted) {
          setReport(null);
          setErrorMessage(error.message || 'Unable to load reports.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadReport();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [teacherId]);

  const summary = report?.summary ?? {};

  const statCards = [
    { label: 'Total Submissions', value: summary.total_submissions ?? 0, accent: 'bg-blue-50 text-blue-700' },
    { label: 'Graded', value: summary.graded_submissions ?? 0, accent: 'bg-emerald-50 text-emerald-700' },
    { label: 'Pending', value: summary.pending_submissions ?? 0, accent: 'bg-amber-50 text-amber-700' },
    { label: 'Average Score', value: summary.average_score !== null && summary.average_score !== undefined ? `${summary.average_score}%` : 'N/A', accent: 'bg-violet-50 text-violet-700' },
  ];

  return (
    <div className="h-full min-h-0 overflow-hidden px-4 py-4 md:px-6 md:py-5">
      <div className="mx-auto flex h-full min-h-0 max-w-[1440px] flex-col gap-10 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="teacher-eyebrow">Reports</p>
            <h1 className="teacher-heading">View Reports</h1>
            <p className="text-sm text-slate-500">
              Track grading activity by subject and by assessment once scores are saved from the grading queue.
            </p>
          </div>
          <div className="teacher-status-pill bg-slate-100 text-slate-700">
            {loading ? 'Updating...' : 'Report Snapshot Ready'}
          </div>
        </div>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="teacher-list-card p-6">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${card.accent}`}>
                {card.label}
              </span>
              <p className="mt-5 text-4xl font-black text-slate-900">{loading ? '...' : card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 gap-10 lg:grid-cols-2">
          <div className="teacher-float-card flex min-h-0 flex-col p-6">
            <div className="mb-5">
              <p className="text-xl font-semibold text-slate-900">Subject Performance</p>
              <p className="text-sm text-slate-500">Average score and grading volume per subject.</p>
            </div>

            <div className="teacher-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto pr-2">
              {!loading && (!report?.subjects || report.subjects.length === 0) ? (
                <div className="teacher-float-card px-4 py-6 text-sm text-slate-500">
                  No subject report data yet.
                </div>
              ) : (
                (report?.subjects ?? []).map((subject) => (
                  (() => {
                    const theme = getSubjectCardTheme(subject);
                    return (
                      <div
                        key={subject.subject_id}
                        className={`relative overflow-hidden rounded-[1.3rem] border border-slate-900/10 p-3.5 shadow-[0_14px_32px_rgba(148,163,184,0.12)] backdrop-blur-sm ${theme.surfaceClass}`}
                      >
                        <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${theme.accentClass}`} />
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">Subject</p>
                            <p className="mt-1.5 truncate text-[1.02rem] font-bold text-slate-900">{subject.subject_name}</p>
                            <p className="mt-1 text-xs text-slate-500">{subject.submissions} submission(s)</p>
                          </div>
                          <span className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-semibold text-slate-600 shadow-sm">
                            {subject.average_score !== null ? `${subject.average_score}% avg` : 'No score yet'}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ))
              )}
            </div>
          </div>

          <div className="teacher-float-card p-6">
            <div className="mb-5">
              <p className="text-xl font-semibold text-slate-900">Assessment Performance</p>
              <p className="text-sm text-slate-500">How each assessment is doing once submissions are graded.</p>
            </div>

            <div className="teacher-scrollbar max-h-[520px] space-y-5 overflow-y-auto pr-2">
              {!loading && (!report?.assessments || report.assessments.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No assessment report data yet.
                </div>
              ) : (
                (report?.assessments ?? []).map((assessment) => (
                  (() => {
                    const theme = getSubjectCardTheme(assessment);
                    return (
                      <div
                        key={assessment.exercise_id}
                        className={`relative overflow-hidden rounded-[1.3rem] border border-slate-900/10 p-3.5 shadow-[0_14px_32px_rgba(148,163,184,0.12)] backdrop-blur-sm ${theme.surfaceClass}`}
                      >
                        <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${theme.accentClass}`} />
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">Assessment</p>
                            <p className="mt-1.5 truncate text-[1.02rem] font-bold text-slate-900">{assessment.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{assessment.subject_name}</p>
                          </div>
                          <span className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-semibold text-slate-600 shadow-sm">
                            {assessment.average_score !== null ? `${assessment.average_score}%` : 'No score yet'}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                            {assessment.submissions} submission(s)
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                            {assessment.graded} graded
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                            {assessment.average_score !== null ? `${assessment.average_score}% average` : 'No score yet'}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherReports;
