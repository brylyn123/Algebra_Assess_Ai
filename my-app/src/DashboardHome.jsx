import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from './axiosClient';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { apiFetch } from './fetchClient';
import { useToast } from './components/Toast';
import { SkeletonWelcome, SkeletonStatRow, SkeletonSection, SkeletonQuickActions, SkeletonStatusCards } from './components/Skeleton';
import { getSubjectThemeByName } from './subjectCardThemes';

const assessmentStatusClasses = {
    draft: 'bg-slate-100 text-slate-700',
    pending: 'bg-amber-100 text-amber-700',
    graded: 'bg-emerald-100 text-emerald-700',
};

const quickActions = [
    {
        label: 'New Assessment',
        description: 'Create a quiz or exam',
        icon: '📝',
        path: '/teacher/assessments/new',
        color: 'bg-gradient-to-br from-blue-500 to-blue-600',
    },
    {
        label: 'New Rubric',
        description: 'Build grading criteria',
        icon: '📊',
        path: '/teacher/assessments/new-rubric',
        color: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    },
    {
        label: 'Grade Work',
        description: 'Review submissions',
        icon: '✅',
        path: '/teacher/grade-submissions',
        color: 'bg-gradient-to-br from-amber-500 to-orange-500',
    },
    {
        label: 'View Reports',
        description: 'Track performance',
        icon: '📈',
        path: '/teacher/reports',
        color: 'bg-gradient-to-br from-violet-500 to-purple-600',
    },
];

const DashboardHome = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const currentEmail = getCurrentLocalUserEmail();
    const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
    const teacherId = storedTeacher?.user_id ?? storedTeacher?.teacher_id ?? storedTeacher?.id ?? null;
    const teacherName = storedTeacher?.firstName ?? 'Teacher';

    const [analytics, setAnalytics] = useState(null);
    const [recentAssessments, setRecentAssessments] = useState([]);

    useEffect(() => {
        if (!teacherId) {
            return;
        }

        axios
            .get('/teacher_analytics.php', {
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
                toast.error('Unable to load analytics.');
            });

        axios
            .get('/get_assessments.php', {
                params: { teacher_id: teacherId },
            })
            .then((response) => {
                if (response.data?.status === 'success') {
                    setRecentAssessments((response.data.assessments || []).slice(0, 4));
                }
            })
            .catch((error) => {
                console.error('Failed to fetch assessments', error);
                toast.error('Unable to load recent assessments.');
            });
    }, [teacherId]);

    const stats = useMemo(() => {
        const totals = analytics || {};
        return [
            {
                id: 1,
                label: 'Total',
                value: totals.total_submissions ?? 0,
                icon: '📋',
                color: 'from-blue-400 to-blue-600',
            },
            {
                id: 2,
                label: 'Pending',
                value: totals.needs_review ?? totals.pending_submissions ?? 0,
                icon: '⏳',
                color: 'from-amber-400 to-orange-500',
            },
            {
                id: 3,
                label: 'Graded',
                value: totals.graded_submissions ?? 0,
                icon: '✓',
                color: 'from-emerald-400 to-emerald-600',
            },
        ];
    }, [analytics]);

    const isLoading = analytics === null;

    return (
        <div className="h-full overflow-y-auto teacher-scrollbar px-4 py-4">
            <div className="mx-auto max-w-[1400px] space-y-4">
                {isLoading ? (
                    <>
                        <SkeletonWelcome />
                        <SkeletonStatRow />
                        <div className="grid gap-4 lg:grid-cols-3">
                            <div className="lg:col-span-2">
                                <SkeletonSection rows={3} />
                            </div>
                            <div>
                                <SkeletonQuickActions />
                            </div>
                        </div>
                        <SkeletonStatusCards />
                    </>
                ) : (
                    <>
                        {/* Welcome Banner */}
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 p-4 text-white shadow-lg shadow-blue-500/20">
                            <div className="relative z-10">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-100">Welcome back</p>
                                <h1 className="mt-0.5 text-lg font-bold">{teacherName}!</h1>
                                <p className="mt-1 max-w-md text-xs text-blue-100">
                                    Here's your activity snapshot for today. Ready to review submissions?
                                </p>
                                <button
                                    onClick={() => navigate('/teacher/grade-submissions')}
                                    className="mt-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-blue-600 shadow-md transition hover:shadow-lg"
                                >
                                    Review Submissions →
                                </button>
                            </div>
                            <div className="absolute right-4 top-4 text-5xl opacity-20">📚</div>
                        </div>

                        {/* Stats Row */}
                        <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Overview</p>
                            <div className="grid grid-cols-3 gap-2">
                                {stats.map((stat) => (
                                    <div
                                        key={stat.id}
                                        className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 transition hover:bg-slate-100"
                                    >
                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${stat.color} text-sm text-white shadow-sm`}>
                                            {stat.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{stat.label}</p>
                                            <p className="text-base font-bold text-slate-900">{stat.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid gap-4 lg:grid-cols-3">
                            {/* Recent Assessments - Takes 2 columns */}
                            <div className="lg:col-span-2 rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Recent Assessments</p>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/teacher/assessments/view')}
                                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                        View all →
                                    </button>
                                </div>
                                <div className="mt-2 space-y-1.5">
                                    {recentAssessments.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                                            <p className="text-xs text-slate-500">No assessments yet</p>
                                            <p className="mt-1 text-[10px] text-slate-400">Create one from Manage Assessments</p>
                                        </div>
                                    ) : (
                                        recentAssessments.map((assessment) => {
                                            const status = (assessment.assessment_status || assessment.status || 'draft').toLowerCase();
                                            const statusColors = {
                                                draft: 'bg-slate-100 text-slate-600',
                                                pending: 'bg-amber-100 text-amber-700',
                                                graded: 'bg-emerald-100 text-emerald-700',
                                            };
                                            const subjectTheme = getSubjectThemeByName(assessment.subject || assessment.subject_name);
                                            return (
                                                <div
                                                    key={assessment.exercise_id}
                                                    className={`flex items-center gap-2.5 rounded-lg p-2.5 transition ${subjectTheme.cardClass}`}
                                                >
                                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${subjectTheme.cardBadgeClass} text-[10px] font-bold`}>
                                                        {(assessment.subject || 'A').charAt(0)}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`truncate text-xs font-semibold ${subjectTheme.cardTextClass}`}>{assessment.title}</p>
                                                        <p className={`text-[10px] ${subjectTheme.cardSubtextClass}`}>
                                                            {assessment.subject || 'No subject'} · {assessment.item_count ?? 0} items
                                                        </p>
                                                    </div>
                                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${statusColors[status] || statusColors.draft}`}>
                                                        {assessment.assessment_status || assessment.status || 'Draft'}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Quick Actions - Takes 1 column */}
                            <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Quick Actions</p>
                                <div className="mt-2 grid grid-cols-2 gap-1.5">
                                    {quickActions.map((action) => (
                                        <button
                                            key={action.label}
                                            type="button"
                                            onClick={() => navigate(action.path)}
                                            className="group flex flex-col items-center rounded-lg bg-slate-50 p-2.5 transition hover:bg-slate-100"
                                        >
                                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.color} text-sm text-white shadow-sm transition group-hover:scale-105`}>
                                                {action.icon}
                                            </div>
                                            <p className="mt-1.5 text-[9px] font-semibold text-slate-700">{action.label}</p>
                                            <p className="text-[8px] text-slate-400">{action.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Row - Status Cards */}
                        <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Status</p>
                            <div className="grid gap-2 sm:grid-cols-3">
                                {/* Subjects */}
                                <div className="rounded-lg bg-slate-50 p-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-bold text-slate-700">My Subjects</h3>
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-600">
                                            {analytics?.total_subjects ?? '-'}
                                        </span>
                                    </div>
                                    <p className="mt-1.5 text-[10px] text-slate-500">Active classes you're teaching</p>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/teacher/subjects')}
                                        className="mt-2 w-full rounded-md bg-blue-50 py-1 text-[9px] font-semibold text-blue-600 transition hover:bg-blue-100"
                                    >
                                        View All
                                    </button>
                                </div>

                                {/* Grading Queue */}
                                <div className="rounded-lg bg-slate-50 p-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-bold text-slate-700">Grading Queue</h3>
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-600">
                                            {analytics?.needs_review ?? analytics?.pending_submissions ?? 0}
                                        </span>
                                    </div>
                                    <p className="mt-1.5 text-[10px] text-slate-500">Submissions awaiting your review</p>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/teacher/grade-submissions')}
                                        className="mt-2 w-full rounded-md bg-amber-50 py-1 text-[9px] font-semibold text-amber-600 transition hover:bg-amber-100"
                                    >
                                        Start Grading
                                    </button>
                                </div>

                                {/* Reports */}
                                <div className="rounded-lg bg-slate-50 p-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-bold text-slate-700">Performance</h3>
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-600">
                                            {analytics?.graded_submissions ?? 0}
                                        </span>
                                    </div>
                                    <p className="mt-1.5 text-[10px] text-slate-500">Graded work completed</p>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/teacher/reports')}
                                        className="mt-2 w-full rounded-md bg-emerald-50 py-1 text-[9px] font-semibold text-emerald-600 transition hover:bg-emerald-100"
                                    >
                                        View Reports
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DashboardHome;
