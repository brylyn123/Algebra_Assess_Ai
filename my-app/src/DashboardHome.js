import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from './axiosClient';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const sampleSubmissions = [
    {
        id: 1,
        title: 'Week 3 Quiz (Algebra 1)',
        student: 'Miguel Reyes',
        subject: 'Algebra 1',
        submittedAt: 'Today · 09:17 AM',
        status: 'Pending',
    },
    {
        id: 2,
        title: 'Worksheet 2 (Geometry)',
        student: 'Clara Santos',
        subject: 'Geometry',
        submittedAt: 'Yesterday · 04:23 PM',
        status: 'Graded',
    },
    {
        id: 3,
        title: 'Homework 5 (Trigonometry)',
        student: 'Lloyd Cabrera',
        subject: 'Trigonometry',
        submittedAt: 'Yesterday · 11:05 AM',
        status: 'Pending',
    },
];

const subjectStatusClasses = {
    pending: 'bg-amber-100 text-amber-700',
    graded: 'bg-emerald-100 text-emerald-700',
};

const DashboardHome = () => {
    const navigate = useNavigate();
    const currentEmail = getCurrentLocalUserEmail();
    const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
    const teacherId = storedTeacher?.teacher_id ?? storedTeacher?.user_id ?? storedTeacher?.id ?? null;

    const [analytics, setAnalytics] = useState(null);

    useEffect(() => {
        if (!teacherId) {
            return;
        }
        // no loading indicator for now
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
    }, [teacherId]);

    const stats = useMemo(() => {
        const totals = analytics || {};
        return [
            {
                id: 1,
                label: 'Total submissions',
                value: totals.total_submissions ?? 0,
                description: 'Across all subjects',
                color: 'bg-blue-600',
                icon: '📘',
            },
            {
                id: 2,
                label: 'Pending review',
                value: totals.needs_review ?? totals.pending_submissions ?? 0,
                description: 'Awaiting AI or manual check',
                color: 'bg-amber-500',
                icon: '⏳',
            },
            {
                id: 3,
                label: 'Graded',
                value: totals.graded_submissions ?? 0,
                description: 'Completed this session',
                color: 'bg-emerald-600',
                icon: '✅',
            },
        ];
    }, [analytics]);

    return (
        <>
            <div className="flex flex-col items-start gap-2 text-left pb-6 border-b border-slate-200">
            <p className="text-slate-500 uppercase tracking-[0.4em] text-xs">Dashboard</p>
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900">Welcome back, Teacher!</h1>
        </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-center pt-6">
            {stats.map((stat) => (
                <div
                    key={stat.id}
                    className={`rounded-[1.5rem] p-6 text-white shadow-md ${stat.color} flex flex-col justify-between min-h-[160px] transition-all duration-300 group`}
                >
                    <div className="flex items-center justify-between">
                        <div className="text-4xl font-bold">{stat.value}</div>
                        <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl transition duration-300 group-hover:scale-110">
                            {stat.icon}
                        </div>
                    </div>
                    <div className="mt-4 space-y-1">
                        <p className="text-sm opacity-95">{stat.label}</p>
                        <p className="text-xs text-white/80">{stat.description}</p>
                    </div>
                    <div className="mt-4 h-1 w-full rounded-full bg-white/40 overflow-hidden">
                        <div className="h-full w-3/4 rounded-full bg-white/80 animate-pulse"></div>
                    </div>
                </div>
            ))}
        </div>

            <div className="grid gap-6 lg:grid-cols-1 mt-10">
                <article className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xl font-bold text-slate-900">Recent Submissions</p>
                            <p className="text-sm text-slate-500">What students handed in most recently.</p>
                        </div>
                        <button className="text-sm font-semibold text-blue-600 hover:underline">View all</button>
                    </div>

                    <div className="space-y-4">
                        {sampleSubmissions.map((submission) => (
                            <div
                                key={submission.id}
                                className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                            >
                                <div>
                                    <p className="font-semibold text-slate-900">{submission.title}</p>
                                    <p className="text-sm text-slate-500">
                                        {submission.student} · {submission.subject}
                                    </p>
                                </div>
                                <div className="text-right space-y-1">
                                    <p className="text-xs text-slate-500">{submission.submittedAt}</p>
                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${subjectStatusClasses[submission.status.toLowerCase()] ?? 'bg-slate-100 text-slate-600'
                                            }`}
                                    >
                                        {submission.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-blue-600 text-white rounded-2xl px-6 py-4 flex items-center justify-between">
                        <div>
                            <p className="font-bold text-lg">All caught up!</p>
                            <p className="text-sm text-white/80">No submissions overdue for grading.</p>
                        </div>
                        <button
                            onClick={() => navigate('/teacher/assessments')}
                            className="bg-white text-blue-600 px-4 py-2 rounded-full font-semibold"
                        >
                            View assessments
                        </button>
                    </div>
                </article>
            </div>
        </>
    );
};

export default DashboardHome;
