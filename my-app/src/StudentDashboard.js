import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  findLocalUser,
  getCurrentLocalUserEmail,
  clearCurrentLocalUserEmail,
} from './localAuthStore';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const quickActions = [
  { label: 'Subjects', icon: '📘', path: '/student' },
  { label: 'Submit Assessment', icon: '⬆️', path: '/student/submit' },
  { label: 'Reports & Feedback', icon: '📊', path: '/student/reports' },
  { label: 'Manage Profile', icon: '👤', path: '/student/profile' },
];

const StudentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentEmail = getCurrentLocalUserEmail();
  const currentUser = currentEmail ? findLocalUser(currentEmail) : null;
  const displayName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : 'Student';

  const studentId = currentUser?.student_id ?? currentUser?.user_id ?? null;
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectsError, setSubjectsError] = useState('');
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState('');

  const fetchSubjects = async () => {
    if (!studentId) {
      setEnrolledSubjects([]);
      return;
    }
    setLoadingSubjects(true);
    setSubjectsError('');
    try {
      const response = await fetch(`${API_BASE_URL}/get_student_subjects.php?student_id=${studentId}`);
      const payload = await response.json();
      if (payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to load subjects.');
      }
      setEnrolledSubjects(Array.isArray(payload.enrolled_subjects) ? payload.enrolled_subjects : []);
    } catch (error) {
      setSubjectsError(error.message || 'Unable to load subjects.');
      setEnrolledSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleEnroll = async (event) => {
    event.preventDefault();
    if (!studentId) {
      setEnrollMessage('Please log in to enroll.');
      return;
    }
    if (!enrollCode.trim()) {
      setEnrollMessage('Enter the enrollment code provided by your teacher.');
      return;
    }
    setEnrollLoading(true);
    setEnrollMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/enroll_subject.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, join_code: enrollCode.trim() }),
      });
      const payload = await response.json();
      if (payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to enroll.');
      }
      setEnrollMessage(payload.message || 'Enrollment successful! Your subjects list has been updated.');
      setEnrollCode('');
      await fetchSubjects();
    } catch (error) {
      setEnrollMessage(error.message || 'Unable to enroll.');
    } finally {
      setEnrollLoading(false);
    }
  };

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

  useEffect(() => {
    fetchSubjects();
  }, [studentId]);

  const outletContext = useMemo(
    () => ({
      enrolledSubjects,
      loadingSubjects,
      subjectsError,
    }),
    [enrolledSubjects, loadingSubjects, subjectsError]
  );
  const isSubmitPage = location.pathname === '/student/submit';
  useEffect(() => {
    if (isSubmitPage) {
      document.body.style.overflowY = 'hidden';
    } else {
      document.body.style.overflowY = 'auto';
    }

    return () => {
      document.body.style.overflowY = 'auto';
    };
  }, [isSubmitPage]);

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
        className="min-h-screen bg-slate-50 overflow-hidden"
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
              <h3 className="text-sm font-semibold text-slate-900">Enroll by Code</h3>
              <form onSubmit={handleEnroll} className="space-y-2">
                <input
                  value={enrollCode}
                  onChange={(e) => setEnrollCode(e.target.value)}
                  placeholder="Paste teacher's join code"
                  className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={enrollLoading}
                  className="w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white duration-200 transition disabled:cursor-wait disabled:bg-blue-300"
                >
                  {enrollLoading ? 'Enrolling…' : 'Join Subject'}
                </button>
              </form>
              <p className="text-xs text-slate-400">
                Ask your teacher for the subject join code, then paste it here to be added immediately.
              </p>
              {enrollMessage && (
                <p className="text-xs text-slate-600 font-medium">{enrollMessage}</p>
              )}
            </div>
          </aside>

          <main
            className={`flex-1 pr-0 ${isSubmitPage ? 'overflow-hidden' : 'overflow-y-auto'}`}
            style={{ maxHeight: isSubmitPage ? 'none' : 'calc(100vh - 200px)' }}
          >
            <div className="space-y-6 pb-6">
              <Outlet context={outletContext} />
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export const StudentOverview = () => {
  const {
    enrolledSubjects = [],
    loadingSubjects = false,
    subjectsError = '',
  } = useOutletContext() ?? {};

  return (
    <>
      <section className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Overview</p>
          <h1 className="text-3xl font-bold text-slate-900">My Subjects</h1>
          <p className="text-sm text-slate-500">Only subscribed subjects appear here after you use their join codes.</p>
        </div>
      </section>
      <section className="space-y-4">
        {loadingSubjects ? (
          <p className="text-sm text-slate-500">Loading subjects...</p>
        ) : (
          <>
            {subjectsError && (
              <p className="text-sm text-rose-600">{subjectsError}</p>
            )}
            {enrolledSubjects.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-900">Joined Classes</h2>
                {enrolledSubjects.map((subject) => (
                  <div key={subject.subject_id} className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{subject.subject_name}</h3>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{subject.subject_code}</p>
                      </div>
                      <span className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600">Enrolled</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">Teacher: {subject.teacher_name}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {subject.course} · {subject.section_name || subject.section} · {subject.semester} {subject.school_year}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {enrolledSubjects.length === 0 && (
              <p className="text-sm text-slate-500">
                You haven’t joined any subjects yet. Paste a teacher-provided join code to unlock your classes.
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
};

export default StudentDashboard;
