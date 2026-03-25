import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

const quickActions = [
  { label: 'Dashboard', icon: 'D', path: '/dashboard' },
  { label: 'Manage Subjects', icon: 'S', path: '/dashboard/subjects' },
  { label: 'Manage Assessments', icon: 'A', path: '/teacher/assessments' },
  { label: 'Grade Submissions', icon: 'G', path: '/teacher/grade-submissions' },
  { label: 'Results & Feedback', icon: 'F', path: '/teacher/feedback' },
  { label: 'View Reports', icon: 'R', path: '/teacher/reports' },
];

const navSpring = { type: 'spring', stiffness: 360, damping: 30 };

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const [teacherName, setTeacherName] = useState('Teacher');
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setTeacherName(parsedUser.firstName || 'Teacher');
    }
  }, []);

  const performLogout = () => {
    localStorage.removeItem('user');
    setLogoutConfirm(false);
    navigate('/login');
  };

  const renderNavButton = ({ label, icon, path, layoutId, activeClassName }) => {
    const isActive =
      location.pathname === path ||
      (path !== '/dashboard' && location.pathname.startsWith(`${path}/`)) ||
      (path === '/dashboard' && location.pathname === '/dashboard');

    return (
      <motion.button
        key={label}
        type="button"
        onClick={() => navigate(path)}
        whileHover={prefersReducedMotion ? undefined : { x: 4, scale: 1.01 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
          isActive ? activeClassName : 'text-slate-500 hover:bg-white/80 hover:text-blue-600'
        }`}
      >
        {isActive && (
          <motion.span
            layoutId={layoutId}
            className="absolute inset-0 rounded-2xl bg-blue-600"
            transition={navSpring}
          />
        )}
        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-xl border border-current/10 bg-white/15 text-xs font-extrabold">
          {icon}
        </span>
        <span className="relative z-10 block flex-1 whitespace-nowrap leading-tight">{label}</span>
      </motion.button>
    );
  };

  const renderAccountButton = ({ label, icon, path }) => {
    const isActive = location.pathname === path;

    return (
      <motion.button
        key={label}
        type="button"
        onClick={() => navigate(path)}
        whileHover={prefersReducedMotion ? undefined : { x: 4 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
          isActive ? 'text-blue-700' : 'text-slate-500 hover:bg-white/80 hover:text-blue-600'
        }`}
      >
        {isActive && (
          <motion.span
            layoutId="teacher-account-active-pill"
            className="absolute inset-0 rounded-2xl bg-blue-50"
            transition={navSpring}
          />
        )}
        <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-xl border border-current/10 bg-white text-xs font-extrabold">
          {icon}
        </span>
        <span className="relative z-10 block flex-1 whitespace-nowrap leading-tight">{label}</span>
      </motion.button>
    );
  };

  const isTeacherZone = location.pathname.startsWith('/teacher');
  const profilePath = isTeacherZone ? '/teacher/profile' : '/dashboard/profile';
  const settingsPath = isTeacherZone ? '/teacher/settings' : '/dashboard/settings';

  return (
    <>
      {logoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-sm space-y-4 rounded-[1.5rem] bg-white p-6 text-center shadow-[0_25px_60px_rgba(15,23,42,0.35)]"
          >
            <p className="text-lg font-semibold text-slate-900">Are you sure you want to logout?</p>
            <p className="text-sm text-slate-500">You can always login again to pick up where you left off.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={performLogout}
                className="rounded-2xl bg-blue-600 px-6 py-2 font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
              >
                Proceed
              </button>
              <button
                type="button"
                onClick={() => setLogoutConfirm(false)}
                className="rounded-2xl border border-slate-200 px-6 py-2 font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </motion.div>
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
        <header className="sticky top-0 z-50 border-b border-white/15 bg-blue-600 text-white shadow-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
            <motion.div
              whileHover={prefersReducedMotion ? undefined : { x: 2 }}
              className="flex cursor-pointer items-center gap-3"
              onClick={() => navigate('/dashboard')}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold">A</div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-white/80">AlgebraAssess</p>
                <p className="text-lg font-bold">Teacher Dashboard</p>
              </div>
            </motion.div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 rounded-full border border-white/30 bg-white/5 px-4 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white font-bold text-blue-600">
                  {teacherName.charAt(0)}
                </div>
                <div className="text-sm">
                  <p className="leading-none font-semibold text-white">{teacherName}</p>
                  <p className="text-xs text-white/70">Online</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLogoutConfirm(true)}
                className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold transition hover:border-red-500 hover:bg-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-10">
          <div className="relative flex gap-8">
            <aside className="hidden w-[260px] shrink-0 lg:block">
              <motion.div
                layout
                className="sticky top-28 h-[calc(100vh-160px)] space-y-6 overflow-y-auto rounded-[2rem] border border-slate-100 bg-white p-6 shadow-lg"
              >
                <div>
                  <p className="mb-4 ml-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Quick Actions
                  </p>
                  <nav className="space-y-1">
                    {quickActions.map((action) =>
                      renderNavButton({
                        ...action,
                        layoutId: 'teacher-sidebar-active-pill',
                        activeClassName: 'text-white shadow-lg shadow-blue-100',
                      })
                    )}
                  </nav>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <p className="mb-4 ml-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Account Settings
                  </p>
                  <div className="space-y-1">
                    {renderAccountButton({ label: 'Profile', icon: 'P', path: profilePath })}
                    {renderAccountButton({ label: 'Settings', icon: 'S', path: settingsPath })}
                  </div>
                </div>
              </motion.div>
            </aside>

            <section className="min-w-0 flex-1">
              <motion.div
                layout
                transition={{
                  layout: {
                    duration: prefersReducedMotion ? 0 : 0.24,
                    ease: [0.22, 1, 0.36, 1],
                  },
                }}
                className="min-h-[600px] rounded-[2rem] border border-[#d9dfeb] bg-[#eef2f7] p-1 shadow-[0_24px_70px_rgba(59,130,246,0.08)]"
              >
                <div className="min-h-[596px] rounded-[1.8rem] bg-[#f5f7fb]">
                  <Outlet context={{ teacherName }} />
                </div>
              </motion.div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
};

export default Dashboard;
