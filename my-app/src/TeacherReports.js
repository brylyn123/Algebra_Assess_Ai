import React, { useEffect, useState } from 'react';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

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
    <div className="space-y-8 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="page-hero-card p-8">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Reports</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">View Reports</h1>
          <p className="mt-2 text-sm text-slate-500">
            Track grading activity by subject and by assessment once scores are saved from the grading queue.
          </p>
          {errorMessage && <p className="mt-4 text-sm text-red-600">{errorMessage}</p>}
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-[1.75rem] border border-slate-100 bg-white p-6 shadow-sm">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${card.accent}`}>
                {card.label}
              </span>
              <p className="mt-5 text-4xl font-black text-slate-900">{loading ? '...' : card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg">
            <div className="mb-5">
              <p className="text-xl font-semibold text-slate-900">Subject Performance</p>
              <p className="text-sm text-slate-500">Average score and grading volume per subject.</p>
            </div>

            <div className="space-y-4">
              {!loading && (!report?.subjects || report.subjects.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No subject report data yet.
                </div>
              ) : (
                (report?.subjects ?? []).map((subject) => (
                  <div key={subject.subject_id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{subject.subject_name}</p>
                        <p className="mt-1 text-xs text-slate-500">{subject.submissions} submission(s)</p>
                      </div>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {subject.average_score !== null ? `${subject.average_score}% avg` : 'No score yet'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg">
            <div className="mb-5">
              <p className="text-xl font-semibold text-slate-900">Assessment Performance</p>
              <p className="text-sm text-slate-500">How each assessment is doing once submissions are graded.</p>
            </div>

            <div className="teacher-scrollbar max-h-[500px] space-y-4 overflow-y-auto pr-2">
              {!loading && (!report?.assessments || report.assessments.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No assessment report data yet.
                </div>
              ) : (
                (report?.assessments ?? []).map((assessment) => (
                  <div key={assessment.exercise_id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{assessment.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{assessment.subject_name}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>{assessment.submissions} submission(s)</span>
                      <span>{assessment.graded} graded</span>
                      <span>
                        {assessment.average_score !== null ? `${assessment.average_score}% average` : 'No score yet'}
                      </span>
                    </div>
                  </div>
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
