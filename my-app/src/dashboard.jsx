import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { clearCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';
import { apiFetch } from './fetchClient';
import MobileNav from './components/MobileNav';

const iconClassName = 'h-4 w-4';

const navIcons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={iconClassName}>
      <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5V20h13V9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  subjects: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={iconClassName}>
      <path d="M6 4.5h9A2.5 2.5 0 0 1 17.5 7v12H8.5A2.5 2.5 0 0 0 6 21.5v-17Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 19h11.5" strokeLinecap="round" />
    </svg>
  ),
  assessments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={iconClassName}>
      <path d="M8 6.5h11" strokeLinecap="round" />
      <path d="M8 12h11" strokeLinecap="round" />
      <path d="M8 17.5h7" strokeLinecap="round" />
      <path d="m4.5 6.5 1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4.5 12 1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5.5" cy="17.5" r="1" />
    </svg>
  ),
  submissions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={iconClassName}>
      <path d="M12 4v10" strokeLinecap="round" />
      <path d="m8.5 10.5 3.5 3.5 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18.5h14" strokeLinecap="round" />
    </svg>
  ),
  feedback: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={iconClassName}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4.5 4v-4A2.5 2.5 0 0 1 3 12.5v-6Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={iconClassName}>
      <path d="M5 19.5h14" strokeLinecap="round" />
      <path d="M7.5 16V10" strokeLinecap="round" />
      <path d="M12 16V6.5" strokeLinecap="round" />
      <path d="M16.5 16v-4" strokeLinecap="round" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={iconClassName}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19a7 7 0 0 1 14 0" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={iconClassName}>
      <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
      <path d="M19 12a7.6 7.6 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.8 7.8 0 0 0-1.8-1l-.3-2.6h-4l-.3 2.6a7.8 7.8 0 0 0-1.8 1l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.8 7.8 0 0 0 1.8 1l.3 2.6h4l.3-2.6a7.8 7.8 0 0 0 1.8-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  catalog: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={iconClassName}>
      <path d="M5.5 7.5A2.5 2.5 0 0 1 8 5h10.5A1.5 1.5 0 0 1 20 6.5v11A1.5 1.5 0 0 1 18.5 19H8a2.5 2.5 0 0 1-2.5-2.5v-9Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 5v14" strokeLinecap="round" />
      <path d="M11 8.5h5" strokeLinecap="round" />
      <path d="M11 12h5" strokeLinecap="round" />
      <path d="M11 15.5h3.5" strokeLinecap="round" />
    </svg>
  ),
  collapse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClassName}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  expand: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconClassName}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
};

const quickActions = [
  { label: 'Home', icon: navIcons.home, path: '/dashboard' },
  { label: 'Subjects', icon: navIcons.subjects, path: '/dashboard/subjects' },
  { label: 'Assessments', icon: navIcons.assessments, path: '/teacher/assessments' },
  { label: 'Grade Submissions', icon: navIcons.submissions, path: '/teacher/grade-submissions', badge: true },
  { label: 'Feedback', icon: navIcons.feedback, path: '/teacher/feedback' },
  { label: 'Reports', icon: navIcons.reports, path: '/teacher/reports' },
];

const navSpring = { type: 'spring', stiffness: 360, damping: 30 };

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const [teacherName, setTeacherName] = useState('Teacher');
  const [userRole, setUserRole] = useState('');
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setTeacherName(parsedUser.firstName || 'Teacher');
      setUserRole(String(parsedUser.role || '').toLowerCase());
    }
  }, []);

  useEffect(() => {
    setCollapsed(true);
    setHovering(false);
  }, [location.pathname]);

  const performLogout = async () => {
    try {
      await apiFetch('/logout.php', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
    localStorage.removeItem('user');
    clearCurrentLocalUserEmail();
    setLogoutConfirm(false);
    navigate('/login');
  };

  const isExpanded = !collapsed || hovering;

  const renderNavButton = ({ label, icon, path, layoutId, activeClassName, badge }) => {
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
        className={`relative flex w-full items-center gap-2.5 rounded-xl ${isExpanded ? 'px-3 py-2' : 'justify-center px-0 py-2'} text-left text-xs font-bold transition ${isActive ? activeClassName : 'text-blue-100 hover:bg-white/15 hover:text-white'
          }`}
        title={!isExpanded ? label : undefined}
      >
        {isActive && (
          <motion.span
            layoutId={layoutId}
            className="absolute inset-0 rounded-xl bg-white/90 shadow-sm"
            transition={navSpring}
          />
        )}
        <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-blue-500 text-white' : 'bg-white/20'}`}>
          {icon}
          {badge && !isExpanded && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
              !
            </span>
          )}
        </span>
        <AnimatePresence>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 block flex-1 leading-tight"
            >
              {label}
              {badge && (
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  3
                </span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
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
        className={`relative flex w-full items-center gap-2.5 rounded-xl ${isExpanded ? 'px-3 py-2' : 'justify-center px-0 py-2'} text-left text-xs font-bold transition ${isActive ? 'text-blue-700 shadow-lg shadow-blue-800/30' : 'text-blue-100 hover:bg-white/15 hover:text-white'
          }`}
        title={!isExpanded ? label : undefined}
      >
        {isActive && (
          <motion.span
            layoutId="teacher-account-active-pill"
            className="absolute inset-0 rounded-xl bg-white/90 shadow-sm"
            transition={navSpring}
          />
        )}
        <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-blue-500 text-white' : 'bg-white/20'}`}>
          {icon}
        </span>
        <AnimatePresence>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 block flex-1 leading-tight"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  };

  const isTeacherZone = location.pathname.startsWith('/teacher');
  const profilePath = isTeacherZone ? '/teacher/profile' : '/dashboard/profile';
  const settingsPath = isTeacherZone ? '/teacher/settings' : '/dashboard/settings';
  const sidebarActions = userRole === 'admin'
    ? [...quickActions, { label: 'Catalog', icon: navIcons.catalog, path: '/dashboard/catalog' }]
    : quickActions;
  const homeLabel = userRole === 'admin' ? 'Admin Home' : 'Teacher Home';

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
        className="flex h-screen flex-col overflow-hidden bg-slate-50"
        style={{
          backgroundImage:
            'linear-gradient(#cbd7ed 1px, transparent 1px), linear-gradient(90deg, #cbd7ed 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          backgroundColor: '#e0edff',
        }}
      >
        <header className="sticky top-0 z-50 border-b border-blue-600/40 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-2">
              <MobileNav
                actions={sidebarActions.map((a) => ({ label: a.label, icon: a.icon, path: a.path }))}
                accountActions={[
                  { label: 'Profile', icon: navIcons.profile, path: profilePath },
                  { label: 'Settings', icon: navIcons.settings, path: settingsPath },
                ]}
                label="Quick Actions"
              />
              <motion.div
                whileHover={prefersReducedMotion ? undefined : { x: 2 }}
                className="flex cursor-pointer items-center gap-2"
                onClick={() => navigate('/dashboard')}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  {navIcons.home}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">AlgebraAssess</p>
                  <p className="text-sm font-bold leading-tight sm:text-base">{homeLabel}</p>
                </div>
              </motion.div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 backdrop-blur-sm sm:flex">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-600">
                  {teacherName.charAt(0)}
                </div>
                <div className="text-xs leading-tight">
                  <p className="font-semibold text-white">{teacherName}</p>
                  <p className="text-white/70">Online</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLogoutConfirm(true)}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition hover:border-red-400 hover:bg-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-1 py-1 sm:px-3 sm:py-2 lg:px-4">
          <div
            className="flex min-h-0 flex-1 overflow-hidden rounded-xl sm:rounded-[2rem] border border-slate-100 bg-slate-50 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]"
          >
            {/* Sidebar - inside the main panel */}
            <aside
              className="hidden shrink-0 transition-all duration-300 lg:block"
              style={{ width: isExpanded ? 220 : 72 }}
              onMouseEnter={() => collapsed && setHovering(true)}
              onMouseLeave={() => collapsed && setHovering(false)}
            >
              <div
                className="teacher-scrollbar flex h-full flex-col overflow-y-auto py-4"
                style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)', padding: isExpanded ? '16px 12px' : '16px 10px' }}
              >
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-blue-200 transition hover:bg-white/20 hover:text-white"
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  >
                    {collapsed ? navIcons.expand : navIcons.collapse}
                  </button>
                </div>

                <div className="flex-1">
                  {isExpanded && (
                    <p className="mb-3 ml-2 text-[9px] font-bold uppercase tracking-widest text-blue-200">
                      Menu
                    </p>
                  )}
                  <nav className="space-y-0.5">
                    {sidebarActions.map((action) =>
                      renderNavButton({
                        ...action,
                        layoutId: 'teacher-sidebar-active-pill',
                        activeClassName: 'text-blue-700 shadow-lg shadow-blue-800/30',
                      })
                    )}
                  </nav>
                </div>

                <div className="border-t border-white/20 pt-4">
                  {isExpanded && (
                    <p className="mb-3 ml-2 text-[9px] font-bold uppercase tracking-widest text-blue-200">
                      Account
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {renderAccountButton({ label: 'Profile', icon: navIcons.profile, path: profilePath })}
                    {renderAccountButton({ label: 'Settings', icon: navIcons.settings, path: settingsPath })}
                  </div>
                </div>
              </div>
            </aside>

            {/* Content area - inside the same panel */}
            <div className="min-w-0 flex-1 overflow-hidden rounded-r-[2rem] bg-slate-100/80">
              <div
                className="h-full teacher-scrollbar overflow-y-auto"
                style={{ scrollbarGutter: 'stable' }}
              >
                <Outlet context={{ teacherName }} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default Dashboard;
