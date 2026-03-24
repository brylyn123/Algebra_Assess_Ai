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
    const teacherId = storedTeacher?.teacher_id ?? storedTeacher?.user_id ?? storedTeacher?.id ?? null;

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
        <>
            <div className="teacher-surface px-8 py-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="teacher-eyebrow">Dashboard</p>
                        <h1 className="mt-3 text-3xl font-black text-slate-950 lg:text-4xl">Welcome back, Teacher!</h1>
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
            </div>

            <div className="grid grid-cols-1 gap-6 pt-6 sm:grid-cols-2 xl:grid-cols-3">
                {stats.map((stat) => (
                    <article key={stat.id} className={`teacher-stat-card ${stat.color} min-h-[190px]`}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Overview</p>
                                <p className="mt-5 text-5xl font-black leading-none">{stat.value}</p>
                            </div>
                            <div className="teacher-stat-icon">{stat.icon}</div>
                        </div>

                        <div className="mt-8">
                            <p className="text-xl font-bold text-white">{stat.label}</p>
                            <p className="mt-2 max-w-[18rem] text-sm text-white/80">{stat.description}</p>
                        </div>
                    </article>
                ))}
            </div>

            <div className="mt-10">
                <article className="teacher-surface space-y-6 p-8">
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

                    <div className="space-y-4">
                        {recentAssessments.length === 0 ? (
                            <p className="rounded-[1.4rem] border border-slate-100 bg-slate-50 px-5 py-5 text-sm text-slate-500">
                                No assessments created yet. Start by building one from Manage Assessments.
                            </p>
                        ) : (
                            recentAssessments.map((assessment) => {
                                const status = (assessment.assessment_status || assessment.status || 'Draft').toLowerCase();
                                return (
                                    <article key={assessment.exercise_id} className="teacher-list-card">
                                        <div>
                                            <p className="text-[1.15rem] font-bold text-slate-900">{assessment.title}</p>
                                            <p className="text-sm text-slate-500">
                                                {assessment.subject || 'Unassigned Subject'} - {assessment.topic || 'No topic'}
                                            </p>
                                        </div>

                                        <div className="space-y-1 text-right">
                                            <p className="text-xs text-slate-500">
                                                {assessment.item_count ?? assessment.items?.length ?? 0} item(s)
                                            </p>
                                            <span
                                                className={`teacher-status-pill ${
                                                    assessmentStatusClasses[status] ?? 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {assessment.assessment_status || assessment.status || 'Draft'}
                                            </span>
                                        </div>
                                    </article>
                                );
                            })
                        )}
                    </div>

                    <div className="rounded-[1.6rem] bg-blue-600 px-6 py-5 text-white shadow-lg shadow-blue-200">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-lg font-bold">Keep the grading queue moving.</p>
                                <p className="text-sm text-white/80">
                                    Created assessments appear here first, then move into Grade Submissions once students submit work.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/teacher/assessments')}
                                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 font-semibold text-blue-600 transition hover:bg-slate-100"
                            >
                                Manage assessments
                            </button>
                        </div>
                    </div>
                </article>
            </div>
        </>
    );
};

export default DashboardHome;
