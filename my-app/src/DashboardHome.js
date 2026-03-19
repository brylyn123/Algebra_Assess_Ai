import React from 'react';
import { useNavigate } from 'react-router-dom';

const stats = [
    { id: 1, label: 'Total Submissions', value: '42', description: 'Across all subjects', color: 'bg-blue-600', icon: '📘' },
    { id: 2, label: 'Pending Grading', value: '5', description: 'Immediate action items', color: 'bg-amber-500', icon: '⏳' },
    { id: 3, label: 'Graded', value: '37', description: 'Finished this session', color: 'bg-emerald-600', icon: '✅' },
];

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

const statusClasses = {
    Pending: 'bg-amber-100 text-amber-700',
    Graded: 'bg-emerald-100 text-emerald-700',
};

const DashboardHome = () => {
    const navigate = useNavigate();

    return (
        <>
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <p className="text-slate-500 uppercase tracking-[0.3em] text-xs mb-1">Dashboard</p>
                    <h1 className="text-3xl font-bold text-slate-900">Welcome back, Teacher!</h1>
                    <p className="text-sm text-slate-500">Here is your activity snapshot for today.</p>
                </div>
                <button
                    onClick={() => navigate('/signup')}
                    className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
                >
                    Upload a Submission
                </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.map((stat) => (
                <div
                    key={stat.id}
                    className={`rounded-[1.5rem] p-6 text-white shadow-md ${stat.color} flex flex-col justify-between min-h-[140px] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl`}
                >
                    <div className="text-3xl font-bold flex items-center gap-2">
                        <span>{stat.value}</span> <span>{stat.icon}</span>
                    </div>
                        <p className="text-sm opacity-90">{stat.label}</p>
                        <p className="text-xs text-white/80">{stat.description}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 space-y-6 mt-10">
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
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[submission.status] ?? 'bg-slate-100 text-slate-600'
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
                        onClick={() => navigate('/signup')}
                        className="bg-white text-blue-600 px-4 py-2 rounded-full font-semibold"
                    >
                        Upload a Submission
                    </button>
                </div>
            </div>
        </>
    );
};

export default DashboardHome;
