import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from './axiosClient';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const assessmentStatusClasses = {
    draft: 'bg-slate-100 text-slate-700',
    pending: 'bg-amber-100 text-amber-700',
    graded: 'bg-emerald-100 text-emerald-700',
};

const DashboardHome = () => {
    const navigate = useNavigate();
    const currentEmail = getCurrentLocalUserEmail();
    const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
    const teacherId = storedTeacher?.user_id ?? storedTeacher?.teacher_id ?? storedTeacher?.id ?? null;

    const [analytics, setAnalytics] = useState(null);
    const [recentAssessments, setRecentAssessments] = useState([]);

    useEffect(() => {
        if (!teacherId) {
            return;
        }

        axios
            .get('http://localhost/Algebra_Assess_Ai/algebra-api/teacher_analytics.php', {
                params: { teacher_id: teacherId },
            })
            .then((response) => {
                const analyticsData = response.data?.analytics;
                if (analyticsData) {
                    setAnalytics(analyticsData);
                }
            })
            .catch((error) => {
                console.error('Failed to fetch analytics', error);
            });

        axios
            .get('http://localhost/Algebra_Assess_Ai/algebra-api/get_assessments.php', {
                params: { teacher_id: teacherId },
            })
            .then((response) => {
                if (response.data?.status === 'success') {
                    setRecentAssessments((response.data.assessments || []).slice(0, 4));
                }
            })
            .catch((error) => {
                console.error('Failed to fetch assessments', error);
            });
    }, [teacherId]);

    const stats = useMemo(() => {
        const totals = analytics || {};
        return [
            {
                id: 1,
                label: 'Total submissions',
                value: totals.total_submissions ?? 0,
                description: 'Across all subjects',
                color: 'teacher-stat-card-blue',
                icon: 'SB',
            },
            {
                id: 2,
                label: 'Pending review',
                value: totals.needs_review ?? totals.pending_submissions ?? 0,
                description: 'Immediate action items',
                color: 'teacher-stat-card-amber',
                icon: 'RV',
            },
            {
                id: 3,
                label: 'Graded',
                value: totals.graded_submissions ?? 0,
                description: 'Finished this session',
                color: 'teacher-stat-card-emerald',
                icon: 'OK',
            },
        ];
    }, [analytics]);

    return (
        <div className="flex h-full min-h-0 flex-col gap-10 overflow-hidden px-4 py-4 md:px-6 md:py-5">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 pb-3 lg:flex-row lg:items-end lg:justify-between md:pb-4">
                <div className="pt-2 md:pt-3">
                    <h1 className="teacher-heading">Welcome back, Teacher!</h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-500">
                        Here is your activity snapshot for today, plus the most recently created assessments in your workspace.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/teacher/grade-submissions')}
                    className="teacher-primary-btn"
                >
                    Review Submissions
                </button>
            </div>

            <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-12 px-1 pt-5 sm:grid-cols-2 sm:px-2 xl:grid-cols-3 xl:gap-14">
                {stats.map((stat) => (
                    <article
                        key={stat.id}
                        className={`teacher-stat-card ${stat.color} min-h-[144px] p-5 shadow-[0_24px_60px_rgba(59,130,246,0.22)]`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Overview</p>
                                <p className="mt-4 text-4xl font-black leading-none lg:text-5xl">{stat.value}</p>
                            </div>
                            <div className="teacher-stat-icon">{stat.icon}</div>
                        </div>

                        <div className="mt-6">
                            <p className="text-lg font-bold text-white lg:text-xl">{stat.label}</p>
                            <p className="mt-2 max-w-[18rem] text-sm text-white/80">{stat.description}</p>
                        </div>
                    </article>
                ))}
            </div>

            <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col overflow-hidden px-1 pt-0 sm:px-2 sm:pt-1">
                <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xl font-bold text-slate-900">Recent Assessments</p>
                            <p className="text-sm text-slate-500">The latest assessments you created, ready to receive submissions.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/teacher/assessments/view')}
                            className="teacher-secondary-btn !px-4 !py-2"
                        >
                            View all
                        </button>
                    </div>

                    <div className="teacher-scrollbar min-h-0 h-[calc(100vh-520px)] space-y-5 overflow-y-auto pr-4 pb-32 sm:h-[calc(100vh-500px)] sm:pb-40">
                        {recentAssessments.length === 0 ? (
                            <p className="teacher-float-card px-6 py-6 text-sm text-slate-500">
                                No assessments created yet. Start by building one from Manage Assessments.
                            </p>
                        ) : (
                            recentAssessments.map((assessment) => {
                                const status = (assessment.assessment_status || assessment.status || 'Draft').toLowerCase();
                                return (
                                    <article
                                        key={assessment.exercise_id}
                                        className={`relative w-full overflow-hidden rounded-[1.3rem] border border-slate-900/10 bg-slate-100/70 p-3.5 shadow-[0_14px_32px_rgba(148,163,184,0.14)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_36px_rgba(148,163,184,0.18)]`}
                                    >
                                        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">
                                                    {assessment.subject || 'Assessment'}
                                                </p>
                                                <p className="mt-1.5 truncate text-[1.02rem] font-bold text-slate-900">{assessment.title}</p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {assessment.subject || 'Unassigned Subject'} - {assessment.topic || 'No topic'}
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs text-slate-500 shadow-sm">
                                                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                                                    {assessment.item_count ?? assessment.items?.length ?? 0} item(s)
                                                </p>
                                                <span
                                                    className={`mt-1 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${
                                                        assessmentStatusClasses[status] ?? 'bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    {assessment.assessment_status || assessment.status || 'Draft'}
                                                </span>
                                            </div>
                                        </div>
                                </article>
                            );
                        })
                    )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default DashboardHome;
