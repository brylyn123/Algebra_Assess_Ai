import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  findLocalUser,
  getCurrentLocalUserEmail,
  clearCurrentLocalUserEmail,
} from './localAuthStore';

const quickActions = [
  { label: 'Subjects', icon: '📘', path: '/student' },
  { label: 'Submit Assessment', icon: '⬆️', path: '/student/submit' },
  { label: 'Reports & Feedback', icon: '📊', path: '/student/reports' },
  { label: 'Manage Profile', icon: '👤', path: '/student/profile' },
];

const subjects = [
  { title: 'Algebra I - Period 3', status: 'Enrolled' },
  { title: 'Geometry - Honors', status: 'Available' },
  { title: 'Calculus - AP', status: 'Available' },
];

const assessments = [
  {
    id: 1,
    title: 'Linear Equations Quiz',
    description: 'Solve problems involving linear equations and graph analysis.',
    due: '2/25/2026',
    questions: 5,
    points: 50,
    status: 'Pending',
  },
  {
    id: 2,
    title: 'Quadratic Functions Test',
    description: 'Assessment on quadratic equations, factoring, and graphs.',
    due: '2/28/2026',
    questions: 8,
    points: 80,
    status: 'Pending',
  },
  {
    id: 3,
    title: 'Midterm Algebra Exam',
    description: 'Comprehensive exam covering all topics from the semester.',
    due: '3/05/2026',
    questions: 12,
    points: 100,
    status: 'Pending',
  },
];

export const StudentOverview = () => (
  <>
    <section className="space-y-3 rounded-[2rem] bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <h2 className="text-3xl font-bold text-slate-900">Available Assessments</h2>
      <p className="text-sm text-slate-500">View and complete your algebra assessments</p>
    </section>

    <section className="space-y-4">
      {assessments.map((assessment) => (
        <article
          key={assessment.id}
          className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">{assessment.title}</h3>
              <p className="text-sm text-slate-500">{assessment.description}</p>
            </div>
            <span className="rounded-full bg-amber-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
              {assessment.status}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <span>📅</span>
              <span>Due: {assessment.due}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>📋</span>
              <span>{assessment.questions} Questions</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⏱️</span>
              <span>{assessment.points} Points</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700">
              Start Assessment
            </button>
            <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
              View Details
            </button>
          </div>
        </article>
      ))}
    </section>
  </>
);

const StudentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentEmail = getCurrentLocalUserEmail();
  const currentUser = currentEmail ? findLocalUser(currentEmail) : null;
  const displayName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : 'Student';

  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const performLogout = () => {
    localStorage.removeItem('user');
    clearCurrentLocalUserEmail();
    setLogoutConfirm(false);
    navigate('/login');
  };

  const handleLogout = () => {
    setLogoutConfirm(true);
  };

  return (
    <>
      {logoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-[1.5rem] bg-white p-6 text-center shadow-[0_25px_60px_rgba(15,23,42,0.35)] space-y-4">
            <p className="text-lg font-semibold text-slate-900">Are you sure you want to logout?</p>
            <p className="text-sm text-slate-500">We’ll save your progress. You can log back in anytime.</p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button onClick={performLogout} className="px-6 py-2 rounded-2xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 transition">
                Proceed
              </button>
              <button onClick={() => setLogoutConfirm(false)} className="px-6 py-2 rounded-2xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        className="min-h-screen bg-slate-50"
      style={{
        backgroundImage:
          'linear-gradient(#cbd7ed 1px, transparent 1px), linear-gradient(90deg, #cbd7ed 1px, transparent 1px)',
        backgroundSize: '30px 30px',
        backgroundColor: '#e0edff',
      }}
    >
      <header className="bg-blue-600 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/student')}>
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">A</div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/80">AlgebraAssess</p>
              <p className="text-lg font-bold">Student Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-full border border-white/30 px-4 py-2 bg-white/5">
              <div className="w-9 h-9 rounded-full bg-white text-blue-600 font-bold flex items-center justify-center">
                {displayName.charAt(0)}
              </div>
              <div className="text-sm text-white">
                <p className="font-semibold leading-none">{displayName}</p>
                <p className="text-xs text-white/70">Online</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-red-500 hover:border-red-500 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col gap-6 px-4 py-8 lg:flex-row lg:flex-nowrap">
        <aside className="w-full flex-none space-y-6 rounded-[2rem] border border-slate-100 bg-white/80 p-6 shadow-md sticky top-6 self-start lg:w-72 lg:top-20 lg:self-start lg:h-[calc(100vh-160px)] lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-4">Quick Actions</p>
          <nav className="space-y-2">
            {quickActions.map((action) => {
              const isActive = location.pathname === action.path;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                    }`}
                >
                  <span className="text-lg">{action.icon}</span>
                  <span className="text-base font-bold whitespace-nowrap">{action.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Subjects</h3>
              <span className="text-xs text-slate-400">Manage</span>
            </div>
            <div className="space-y-3">
              {subjects.map((subject) => (
                <div
                  key={subject.title}
                  className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm text-slate-700"
                >
                  <div>
                    <p className="font-semibold">{subject.title}</p>
                    <p className="text-xs text-slate-400">
                      {subject.status === 'Enrolled' ? 'You are enrolled' : 'Open for enrollment'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${subject.status === 'Enrolled'
                        ? 'border border-blue-200 text-blue-600'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                  >
                    {subject.status === 'Enrolled' ? 'Enrolled' : 'Enroll'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 min-h-[calc(100vh-260px)] overflow-hidden pr-0">
          <div className="sticky top-6 min-h-[calc(100vh-260px)]">
            <div className="mx-auto w-full max-w-5xl space-y-6 overflow-y-auto max-h-[calc(100vh-200px)] pr-3">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
    </>
  );
};

export default StudentDashboard;
