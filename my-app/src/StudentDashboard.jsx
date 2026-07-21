import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  clearCurrentLocalUserEmail,
  findLocalUser,
  getLocalUserEventName,
  getCurrentLocalUserEmail,
} from './localAuthStore';
import { Skeleton, SkeletonWelcome, SkeletonStatRow, SkeletonSection } from './components/Skeleton';
import { getSubjectCardTheme } from './subjectCardThemes';
import { API_BASE_URL } from './apiBase';
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
  { label: 'Home', icon: navIcons.home, path: '/student' },
  { label: 'My Subjects', icon: navIcons.subjects, path: '/student/subjects' },
  { label: 'Scores & Feedback', icon: navIcons.reports, path: '/student/reports' },
  { label: 'Manage Profile', icon: navIcons.profile, path: '/student/profile' },
];

const dashboardWidgets = [
  { key: 'enrolledSubjects', label: 'Enrolled Subjects', gradient: 'from-sky-500 via-indigo-500 to-purple-600' },
  { key: 'completedAssessments', label: 'Completed Assessments', gradient: 'from-emerald-500 via-teal-500 to-cyan-500' },
  { key: 'averageScore', label: 'Average Score', gradient: 'from-amber-500 via-orange-500 to-rose-500' },
];

const getDisplayName = (user) => {
  if (!user) return 'Student';

  const firstName = user.firstName ?? user.first_Name ?? '';
  const middleName = user.middleName ?? user.middle_Name ?? '';
  const lastName = user.lastName ?? user.last_Name ?? '';
  const combinedName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

  if (combinedName) {
    return combinedName;
  }

  if (typeof user.name === 'string' && user.name.trim()) {
    return user.name.trim();
  }

  return 'Student';
};

const formatDateTime = (value) => {
  if (!value) return 'Not submitted yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const compactListCardClass =
  'w-full rounded-[1.15rem] border border-slate-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,248,255,0.94))] px-4 py-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(231,242,255,0.98))]';


const sectionHeaderEyebrowClass = 'text-[11px] uppercase tracking-[0.35em] text-slate-400';
const sectionHeaderTitleClass = 'text-2xl font-semibold text-slate-900';
const sectionHeaderSubtextClass = 'mt-1 text-sm text-slate-500';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const email = getCurrentLocalUserEmail();
    return email ? findLocalUser(email) : null;
  });
  const displayName = getDisplayName(currentUser);

  const studentId = currentUser?.user_id ?? currentUser?.student_id ?? null;
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);
  const [archivedSubjects, setArchivedSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectsError, setSubjectsError] = useState('');
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const [showJoinCard, setShowJoinCard] = useState(true);
  const [availableAssessments, setAvailableAssessments] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [assessmentsError, setAssessmentsError] = useState('');
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    const syncCurrentUser = () => {
      const email = getCurrentLocalUserEmail();
      setCurrentUser(email ? findLocalUser(email) : null);
    };

    syncCurrentUser();
    const eventName = getLocalUserEventName();
    window.addEventListener(eventName, syncCurrentUser);
    window.addEventListener('storage', syncCurrentUser);

    return () => {
      window.removeEventListener(eventName, syncCurrentUser);
      window.removeEventListener('storage', syncCurrentUser);
    };
  }, []);

  useEffect(() => {
    setCollapsed(true);
    setHovering(false);
  }, [location.pathname]);

  const fetchSubjects = useCallback(async () => {
    if (!studentId) {
      setEnrolledSubjects([]);
      setArchivedSubjects([]);
      return;
    }

    setLoadingSubjects(true);
    setSubjectsError('');

    try {
      const response = await fetch(`${API_BASE_URL}/get_student_subjects.php?student_id=${studentId}`, {
        credentials: 'include',
      });
      const payload = await response.json();
      if (payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to load subjects.');
      }
      setEnrolledSubjects(Array.isArray(payload.enrolled_subjects) ? payload.enrolled_subjects : []);
      setArchivedSubjects(Array.isArray(payload.archived_subjects) ? payload.archived_subjects : []);
    } catch (error) {
      setSubjectsError(error.message || 'Unable to load subjects.');
      setEnrolledSubjects([]);
      setArchivedSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  }, [studentId]);

  const handleEnroll = async (event) => {
    event.preventDefault();

    if (!studentId) {
      setEnrollMessage('Please log in to enroll.');
      setEnrollSuccess(false);
      return;
    }

    if (!enrollCode.trim()) {
      setEnrollMessage('Enter the enrollment code provided by your teacher.');
      setEnrollSuccess(false);
      return;
    }

    setEnrollLoading(true);
    setEnrollMessage('');
    setEnrollSuccess(false);

    try {
      const response = await fetch(`${API_BASE_URL}/enroll_subject.php`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, join_code: enrollCode.trim() }),
      });
      const payload = await response.json();
      if (payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to enroll.');
      }
      setEnrollMessage(payload.message || 'Enrollment successful! Subject has been added.');
      setEnrollSuccess(true);
      setEnrollCode('');
      await fetchSubjects();
    } catch (error) {
      setEnrollMessage(error.message || 'Unable to enroll.');
      setEnrollSuccess(false);
    } finally {
      setEnrollLoading(false);
    }
  };

  useEffect(() => {
    if (!enrollSuccess || !enrollMessage) return;
    const timer = setTimeout(() => {
      setEnrollMessage('');
      setEnrollSuccess(false);
      setShowJoinCard(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [enrollSuccess, enrollMessage]);

  const performLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/logout.php`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
    localStorage.removeItem('user');
    clearCurrentLocalUserEmail();
    setLogoutConfirm(false);
    navigate('/login');
  };

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchAssessments = async () => {
      if (!studentId) {
        if (isMounted) {
          setAvailableAssessments([]);
          setAssessmentsError('');
          setLoadingAssessments(false);
        }
        return;
      }

      setLoadingAssessments(true);
      setAssessmentsError('');

      try {
        const response = await fetch(`${API_BASE_URL}/get_student_assessments.php?student_id=${studentId}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        const payload = await response.json();
        if (payload.status !== 'success') {
          throw new Error(payload.message || 'Unable to load assessments.');
        }
        if (!isMounted) return;
        setAvailableAssessments(Array.isArray(payload.assessments) ? payload.assessments : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isMounted) {
          setAssessmentsError(error.message || 'Unable to load assessments.');
          setAvailableAssessments([]);
        }
      } finally {
        if (isMounted) {
          setLoadingAssessments(false);
        }
      }
    };

    fetchAssessments();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [studentId]);

  const dashboardStats = useMemo(() => {
    const completedAssessments = availableAssessments.filter((assessment) => assessment.already_submitted).length;
    const pendingAssessments = availableAssessments.filter((assessment) => !assessment.already_submitted).length;

    return {
      enrolledSubjects: enrolledSubjects.length > 0 ? enrolledSubjects.length : '-',
      completedAssessments,
      averageScore:
        typeof currentUser?.averageScore === 'number' || typeof currentUser?.averageScore === 'string'
          ? `${currentUser.averageScore}%`
          : 'TBD',
      pendingAssessments,
    };
  }, [availableAssessments, currentUser?.averageScore, enrolledSubjects.length]);

  const pendingAssessments = useMemo(
    () => availableAssessments.filter((assessment) => !assessment.already_submitted),
    [availableAssessments]
  );

  const outletContext = useMemo(
    () => ({
      enrolledSubjects,
      archivedSubjects,
      loadingSubjects,
      subjectsError,
      availableAssessments,
      loadingAssessments,
      assessmentsError,
      dashboardStats,
      pendingAssessments,
      enrollCode,
      setEnrollCode,
      enrollLoading,
      enrollMessage,
      enrollSuccess,
      setEnrollSuccess,
      showJoinCard,
      setShowJoinCard,
      handleEnroll,
    }),
    [
      enrolledSubjects,
      archivedSubjects,
      loadingSubjects,
      subjectsError,
      availableAssessments,
      loadingAssessments,
      assessmentsError,
      dashboardStats,
      pendingAssessments,
      enrollCode,
      enrollLoading,
      enrollMessage,
      enrollSuccess,
      showJoinCard,
      handleEnroll,
    ]
  );

  useEffect(() => {
    document.body.style.overflowY = 'hidden';
    document.documentElement.style.overflowY = 'hidden';
    return () => {
      document.body.style.overflowY = 'auto';
      document.documentElement.style.overflowY = 'auto';
    };
  }, []);

  return (
    <>
      {logoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-[1.5rem] bg-white p-6 text-center shadow-[0_25px_60px_rgba(15,23,42,0.35)]">
            <p className="text-lg font-semibold text-slate-900">Are you sure you want to logout?</p>
            <p className="text-sm text-slate-500">We will save your progress. You can log back in anytime.</p>
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
          </div>
        </div>
      )}

      <div
        className="h-screen overflow-hidden bg-slate-50"
        style={{
          backgroundImage:
            'linear-gradient(#cbd7ed 1px, transparent 1px), linear-gradient(90deg, #cbd7ed 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          backgroundColor: '#e0edff',
        }}
      >
        <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-blue-500 text-white shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-1.5 sm:px-6">
            <div className="flex items-center gap-1.5">
              <MobileNav
                actions={quickActions.map((a) => ({ label: a.label, icon: a.icon, path: a.path }))}
                label="Navigation"
              />
              <div className="flex cursor-pointer items-center gap-1.5" onClick={() => navigate('/student')}>
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20 text-xs font-bold">A</div>
                <div>
                  <p className="text-[8px] uppercase tracking-[0.2em] text-white/70">AlgebraAssess</p>
                  <p className="text-[11px] font-bold sm:text-xs">Student Home</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="hidden items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 sm:flex">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-blue-600">
                  {displayName.charAt(0)}
                </div>
                <div className="text-[10px] leading-tight">
                  <p className="font-semibold text-white">{displayName}</p>
                  <p className="text-white/60">Online</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLogoutConfirm(true)}
                className="rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-semibold transition hover:border-red-400 hover:bg-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          {(() => {
            const isExpanded = !collapsed || hovering;
            return (
              <div
                className="flex overflow-hidden rounded-[2rem] border border-slate-100 bg-slate-50 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]"
                style={{ height: 'calc(100vh - 68px)' }}
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
                        <p className="mb-3 ml-2 text-[9px] font-bold uppercase tracking-widest text-blue-200">Menu</p>
                      )}
                      <nav className="space-y-0.5">
                        {quickActions.map((action) => {
                          const isActive =
                            action.path === '/student/subjects'
                              ? location.pathname.startsWith('/student/subjects')
                              : location.pathname === action.path;
                          return (
                            <button
                              key={action.label}
                              type="button"
                              onClick={() => navigate(action.path)}
                              title={!isExpanded ? action.label : undefined}
                              className={`relative flex w-full items-center gap-2.5 rounded-xl ${isExpanded ? 'px-3 py-2' : 'justify-center px-0 py-2'} text-left text-xs font-bold transition ${
                                isActive
                                  ? 'text-blue-700 shadow-lg shadow-blue-800/30'
                                  : 'text-blue-100 hover:bg-white/15 hover:text-white'
                              }`}
                            >
                              {isActive && (
                                <span className="absolute inset-0 rounded-xl bg-white/90 shadow-sm" />
                              )}
                              <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold ${isActive ? 'bg-blue-500 text-white' : 'bg-white/20'}`}>
                                {action.icon}
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
                                    {action.label}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </button>
                          );
                        })}
                      </nav>
                    </div>
                  </div>
                </aside>

                {/* Content area - inside the same panel */}
                <div className="min-w-0 flex-1 overflow-hidden rounded-r-[2rem] bg-slate-100/80">
                  <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto teacher-scrollbar space-y-4 px-4 py-4 md:space-y-6 md:px-6 md:py-6">
                      <Outlet context={outletContext} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </main>
      </div>
    </>
  );
};

export const StudentOverview = () => {
  const navigate = useNavigate();
  const {
    loadingAssessments = false,
    assessmentsError = '',
    dashboardStats = {},
    pendingAssessments = [],
  } = useOutletContext() ?? {};

  const stats = [
    { key: 'enrolledSubjects', label: 'Subjects', icon: '📚', color: 'from-blue-400 to-blue-600' },
    { key: 'completedAssessments', label: 'Completed', icon: '✅', color: 'from-emerald-400 to-emerald-600' },
    { key: 'averageScore', label: 'Avg Score', icon: '📊', color: 'from-amber-400 to-orange-500' },
  ];

  const isLoading = loadingAssessments && pendingAssessments.length === 0;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <>
          <SkeletonWelcome />
          <SkeletonStatRow />
          <SkeletonSection rows={3} />
        </>
      ) : (
      <>
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-4 text-white shadow-lg shadow-purple-500/20">
        <div className="relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-100">Welcome back</p>
          <h1 className="mt-0.5 text-lg font-bold">Student!</h1>
          <p className="mt-1 max-w-md text-xs text-purple-100">
            Check your pending assessments and track your progress.
          </p>
          <button
            onClick={() => navigate('/student/subjects')}
            className="mt-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-purple-600 shadow-md transition hover:shadow-lg"
          >
            View My Subjects →
          </button>
        </div>
        <div className="absolute right-4 top-4 text-5xl opacity-20">🎓</div>
      </div>

      {/* Stats Row */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Overview</p>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div
              key={stat.key}
              className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 transition hover:bg-slate-100"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${stat.color} text-sm text-white shadow-sm`}>
                {stat.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{stat.label}</p>
                <p className="text-base font-bold text-slate-900">{dashboardStats[stat.key] ?? '-'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Assessments */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Pending Assessments</p>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
            {dashboardStats.pendingAssessments ?? 0} pending
          </span>
        </div>
        <div className="mt-2 space-y-1.5">
          {loadingAssessments ? (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-2.5">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="mb-1 h-3 w-3/4 rounded-md" />
                    <Skeleton className="h-2.5 w-1/2 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : assessmentsError ? (
            <p className="text-[11px] text-rose-600">{assessmentsError}</p>
          ) : pendingAssessments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-[11px] text-slate-500">No assessments for now</p>
              <p className="mt-0.5 text-[9px] text-slate-400">All works caught up!</p>
            </div>
          ) : (
            pendingAssessments.slice(0, 3).map((assessment) => (
              <div
                key={assessment.exercise_id}
                className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-2.5 transition hover:bg-slate-100"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-[10px] font-bold text-white">
                  {(assessment.subject_name || 'A').charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-900">{assessment.title}</p>
                  <p className="text-[10px] text-slate-500">
                    {assessment.difficulty || 'Medium'} · {assessment.item_count ?? 0} items
                  </p>
                </div>
                {assessment.due_date && (() => {
                  const now = new Date();
                  const due = new Date(assessment.due_date);
                  if (Number.isNaN(due.getTime())) return null;
                  const diffMs = due.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                  let cls = 'bg-blue-50 text-blue-600';
                  let label = `${diffDays}d left`;
                  if (diffDays < 0) { cls = 'bg-red-50 text-red-600'; label = 'Overdue'; }
                  else if (diffDays === 0) { cls = 'bg-amber-50 text-amber-600'; label = 'Today'; }
                  else if (diffDays <= 3) { cls = 'bg-orange-50 text-orange-600'; }
                  return (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                      {label}
                    </span>
                  );
                })()}
              </div>
            ))
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export const StudentSubjects = () => {
  const navigate = useNavigate();
  const { id: subjectIdParam = '' } = useParams();
  const {
    enrolledSubjects = [],
    archivedSubjects = [],
    loadingSubjects = false,
    subjectsError = '',
    availableAssessments = [],
    loadingAssessments = false,
    assessmentsError = '',
    enrollCode = '',
    setEnrollCode = () => {},
    enrollLoading = false,
    enrollMessage = '',
    enrollSuccess = false,
    setEnrollSuccess = () => {},
    showJoinCard = true,
    setShowJoinCard = () => {},
    handleEnroll = () => {},
  } = useOutletContext() ?? {};
  const currentEmail = getCurrentLocalUserEmail();
  const currentUser = currentEmail ? findLocalUser(currentEmail) : null;
  const studentId = currentUser?.user_id ?? currentUser?.student_id ?? null;

  const [assessmentList, setAssessmentList] = useState(availableAssessments);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [showArchivedSubjects, setShowArchivedSubjects] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setAssessmentList(availableAssessments);
  }, [availableAssessments]);

  useEffect(() => {
    setSelectedFiles([]);
    setSubmitMessage('');
    setSelectedAssessmentId('');
  }, [subjectIdParam]);

  const selectedSubject = useMemo(
    () =>
      [...enrolledSubjects, ...archivedSubjects].find((subject) => String(subject.subject_id) === String(subjectIdParam)) ??
      null,
    [archivedSubjects, enrolledSubjects, subjectIdParam]
  );

  const assessmentCountBySubject = useMemo(() => {
    const counts = new Map();
    assessmentList.forEach((assessment) => {
      const key = String(assessment.subject_id ?? '');
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [assessmentList]);

  const subjectAssessments = useMemo(
    () => assessmentList.filter((assessment) => String(assessment.subject_id) === String(subjectIdParam)),
    [assessmentList, subjectIdParam]
  );

  useEffect(() => {
    if (subjectAssessments.length === 0) {
      setSelectedAssessmentId('');
      return;
    }

    setSelectedAssessmentId((current) => {
      const stillExists = subjectAssessments.some((assessment) => String(assessment.exercise_id) === String(current));
      return stillExists ? current : '';
    });
  }, [subjectAssessments]);

  const selectedAssessment = useMemo(
    () =>
      subjectAssessments.find((assessment) => String(assessment.exercise_id) === String(selectedAssessmentId)) ?? null,
    [selectedAssessmentId, subjectAssessments]
  );

  const selectedAssessmentItems = Array.isArray(selectedAssessment?.items) ? selectedAssessment.items : [];
  const subjectTheme = useMemo(
    () => getSubjectCardTheme(selectedSubject ?? selectedAssessment ?? {}),
    [selectedAssessment, selectedSubject]
  );

  const handleFiles = (event) => {
    const fileList = Array.from(event.target.files || []);
    if (fileList.length === 0) return;
    setSelectedFiles((current) => [...current, ...fileList]);
    event.target.value = '';
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const removeSelectedFile = (indexToRemove) => {
    setSelectedFiles((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setSubmitMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!studentId) {
      setSubmitMessage('Please log in as a student to submit work.');
      return;
    }

    if (!selectedSubject) {
      setSubmitMessage('Choose an enrolled subject first.');
      return;
    }

    if (!selectedAssessment) {
      setSubmitMessage('Choose an assessment first.');
      return;
    }

    if (selectedAssessment.already_submitted) {
      setSubmitMessage('This assessment already has a submission.');
      return;
    }

    if (selectedFiles.length === 0) {
      setSubmitMessage('Upload at least one file before submitting.');
      return;
    }

    setSubmitLoading(true);
    setSubmitMessage('');

    try {
      const formData = new FormData();
      formData.append('student_id', String(studentId));
      formData.append('exercise_id', String(selectedAssessment.exercise_id));
      selectedFiles.forEach((file) => {
        formData.append('files[]', file);
      });

      const response = await fetch(`${API_BASE_URL}/submit_assessment.php`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const payload = await response.json();

      if (payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to submit assessment.');
      }

      setSubmitMessage('Assessment submitted successfully. Your teacher can now grade it from Grade Submissions.');
      setSelectedFiles([]);
      setAssessmentList((current) =>
        current.map((assessment) =>
          assessment.exercise_id === selectedAssessment.exercise_id
            ? {
                ...assessment,
                already_submitted: true,
                submission_status: 'Pending Review',
                latest_submission_at: new Date().toISOString(),
              }
            : assessment
        )
      );
    } catch (error) {
      setSubmitMessage(error.message || 'Unable to submit assessment.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const fileLabel = selectedFiles.length === 0
    ? 'Drop files here or click to browse'
    : `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} ready to upload`;

  const subjectAssessmentCount = subjectAssessments.length;
  const isSubjectAssessmentPage = Boolean(subjectIdParam);
  const visibleSubjects = showArchivedSubjects ? archivedSubjects : enrolledSubjects;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      {!isSubjectAssessmentPage && (
      <section className="mb-2 space-y-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <p className={sectionHeaderEyebrowClass}>
              Subjects
            </p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-[1.85rem]">
              My Subjects
            </h1>
            <p className="max-w-2xl text-xs leading-6 text-slate-500">
              Keep track of your enrolled classes, revisit archived subjects, and join a new subject with your teacher's code.
            </p>
          </div>
        </div>
      </section>
      )}

      {!isSubjectAssessmentPage && (
      <section className="space-y-2">
        {showJoinCard ? (
        <div className="rounded-[1.25rem] border border-slate-200/60 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
          {enrollSuccess && enrollMessage ? (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-800">Subject Joined!</p>
                <p className="mt-0.5 text-xs text-emerald-600">{enrollMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEnrollMessage('');
                  setEnrollSuccess(false);
                  setShowJoinCard(false);
                }}
                className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Join Subject</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Enter the class code from your teacher to add a subject.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowJoinCard(false)}
                  className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleEnroll} className="flex w-full gap-2">
                <input
                  value={enrollCode}
                  onChange={(event) => {
                    setEnrollCode(event.target.value);
                    if (enrollMessage) {
                      setEnrollMessage('');
                      setEnrollSuccess(false);
                    }
                  }}
                  placeholder="Paste join code"
                  className="teacher-input h-9 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
                <button
                  type="submit"
                  disabled={enrollLoading}
                  className="teacher-primary-btn h-9 whitespace-nowrap rounded-xl px-4 text-xs font-semibold disabled:cursor-wait disabled:bg-blue-300"
                >
                  {enrollLoading ? 'Joining...' : 'Join'}
                </button>
              </form>
              {enrollMessage && !enrollSuccess && (
                <p className="text-[11px] font-medium text-rose-600">{enrollMessage}</p>
              )}
            </>
          )}
        </div>
        ) : (
        <div>
          <button
            type="button"
            onClick={() => {
              setShowJoinCard(true);
              setEnrollMessage('');
              setEnrollSuccess(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Join Subject
          </button>
        </div>
        )}
      </section>
      )}

      <section className="flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden">
        {!isSubjectAssessmentPage && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">Subject Library</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Active classes and archived records.
                </p>
              </div>
              <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowArchivedSubjects(false)}
                  className={`rounded-full px-4 py-1.5 text-[11px] font-semibold transition ${
                    !showArchivedSubjects
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchivedSubjects(true)}
                  className={`rounded-full px-4 py-1.5 text-[11px] font-semibold transition ${
                    showArchivedSubjects
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Archived ({archivedSubjects.length})
                </button>
              </div>
            </div>

            <div className="teacher-scrollbar grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto pr-2 pb-4 sm:grid-cols-2 lg:grid-cols-3">
            {loadingSubjects ? (
              <p className="text-sm text-slate-500">Loading subjects...</p>
            ) : subjectsError ? (
              <p className="text-sm text-rose-600">{subjectsError}</p>
            ) : visibleSubjects.length === 0 ? (
              <div className="col-span-full rounded-[1rem] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <p className="text-sm font-semibold text-slate-900">
                  {showArchivedSubjects ? 'No archived subjects yet' : 'No subjects yet'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {showArchivedSubjects
                    ? 'Archived subjects will appear here once one of your enrolled classes is archived by your teacher.'
                    : 'Use the join subject form above to unlock your classes.'}
                </p>
              </div>
            ) : (
              visibleSubjects.map((subject) => {
                const assessmentCount = assessmentCountBySubject.get(String(subject.subject_id)) ?? 0;
                const subjectTheme = getSubjectCardTheme(subject);
                return (
                  <button
                    key={subject.subject_id}
                    type="button"
                    onClick={() => {
                      if (!showArchivedSubjects) {
                        navigate(`/student/subjects/${subject.subject_id}`);
                      }
                    }}
                    className={`group relative flex flex-col overflow-hidden rounded-[0.85rem] border border-slate-200/60 p-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03),0_2px_8px_rgba(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_6px_16px_rgba(0,0,0,0.05)] ${subjectTheme.surfaceClass}`}
                  >
                    <div className={`absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r ${subjectTheme.accentClass}`} />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">
                          {subject.subject_code || 'Subject'}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-900">{subject.subject_name}</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                          {subject.course || 'Course'} • {subject.year || 'Year'} • {subject.section_name || subject.section || 'Section'}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          showArchivedSubjects ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {showArchivedSubjects ? 'Archived' : 'Active'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold shadow-sm ${
                        showArchivedSubjects
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-blue-200 bg-white text-blue-700'
                      }`}>
                        {assessmentCount} assessment{assessmentCount === 1 ? '' : 's'}
                      </span>
                      {subject.school_year && (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-600 shadow-sm">
                          {subject.school_year}
                        </span>
                      )}
                      {subject.semester && (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-600 shadow-sm">
                          {subject.semester}
                        </span>
                      )}
                    </div>

                    <div className="mt-auto pt-2">
                      <span className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200/60 bg-slate-50 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 transition group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-600">
                        {showArchivedSubjects ? 'View Subject' : 'Open Assessments'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
            </div>
          </>
        )}

        {isSubjectAssessmentPage && (
          <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate('/student/subjects')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                ← Back to Subjects
              </button>
              {selectedSubject && (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  {subjectAssessmentCount} assessment{subjectAssessmentCount === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {!selectedSubject ? (
              <div className="rounded-[1rem] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <p className="text-sm font-semibold text-slate-900">Subject not found</p>
                <p className="mt-1 text-xs text-slate-500">This subject is not in your enrolled list.</p>
              </div>
            ) : (
              <>
                {loadingAssessments ? (
                  <p className="text-xs text-slate-500">Loading assessments...</p>
                ) : selectedSubject.archived ? (
                  <div className="rounded-[1rem] border border-amber-200 bg-amber-50/80 px-6 py-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <p className="text-sm font-semibold text-slate-900">This subject is archived</p>
                    <p className="mt-1 text-xs text-slate-600">
                      You can still review it, but new submissions are no longer available.
                    </p>
                  </div>
                ) : assessmentsError ? (
                  <p className="text-xs text-rose-600">{assessmentsError}</p>
                ) : subjectAssessments.length === 0 ? (
                  <div className="rounded-[1rem] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <p className="text-sm font-semibold text-slate-900">No assessments yet</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Your teacher has not published any activities in this subject yet.
                    </p>
                  </div>
                ) : (
                  <div className="teacher-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
                    {subjectAssessments.map((assessment) => {
                      const isSelected = String(assessment.exercise_id) === String(selectedAssessmentId);
                      const isSubmitted = Boolean(assessment.already_submitted || assessment.submission_status);
                      const statusLabel = isSubmitted ? 'Submitted' : 'Pending';
                      const statusClass =
                        statusLabel === 'Submitted'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700';

                      return (
                        <div
                          key={assessment.exercise_id}
                          onClick={() => setSelectedAssessmentId(String(assessment.exercise_id))}
                          className={`relative overflow-hidden rounded-[0.85rem] border px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_14px_rgba(0,0,0,0.05)] ${
                            isSelected
                              ? `${subjectTheme.surfaceClass} border-blue-300 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(59,130,246,0.1)]`
                              : `${subjectTheme.surfaceClass} border-slate-100`
                          }`}
                        >
                          <div className={`absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r ${subjectTheme.accentClass}`} />
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                                {assessment.subject_name} {assessment.subject_code ? `(${assessment.subject_code})` : ''}
                              </p>
                              <h3 className="mt-0.5 truncate text-sm font-bold text-slate-900">{assessment.title}</h3>
                              <p className="mt-0.5 text-[11px] leading-snug text-slate-500 line-clamp-2">{assessment.description || 'No description provided.'}</p>
                            </div>
                            <div className="flex shrink-0 flex-row items-center gap-2 lg:flex-col lg:items-end">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${statusClass}`}>
                                {statusLabel}
                              </span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedAssessmentId(String(assessment.exercise_id));
                                }}
                                className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-1 text-[9px] font-semibold text-blue-700 transition hover:bg-blue-50 hover:border-blue-300"
                              >
                                {assessment.already_submitted ? 'View' : 'Submit / View'}
                              </button>
                            </div>
                          </div>

                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-400">
                            <span>Topic: {assessment.topic || '-'}</span>
                            <span>Difficulty: {assessment.difficulty || 'Medium'}</span>
                            <span>Items: {assessment.item_count ?? 0}</span>
                            {assessment.latest_submission_at && <span>Latest: {formatDateTime(assessment.latest_submission_at)}</span>}
                            {assessment.due_date && (() => {
                              const now = new Date();
                              const due = new Date(assessment.due_date);
                              if (Number.isNaN(due.getTime())) return null;
                              const diffMs = due.getTime() - now.getTime();
                              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                              let cls = 'text-blue-600';
                              let label = `Due in ${diffDays}d`;
                              if (diffDays < 0) { cls = 'text-red-600 font-semibold'; label = 'Overdue'; }
                              else if (diffDays === 0) { cls = 'text-amber-600 font-semibold'; label = 'Due today'; }
                              else if (diffDays <= 3) { cls = 'text-orange-600 font-semibold'; }
                              const formatted = due.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                              return <span className={cls}>{label} ({formatted})</span>;
                            })()}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedAssessment && typeof document !== 'undefined' && createPortal(
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-900/45 px-4 py-6 backdrop-blur-sm"
                    onClick={() => setSelectedAssessmentId('')}
                  >
                    <div
                      className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${subjectTheme.accentClass}`} />
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(239,246,255,0.92))] px-6 py-4">
                        <div>
                          <p className={sectionHeaderEyebrowClass}>Assessment</p>
                          <h3 className={sectionHeaderTitleClass}>{selectedAssessment.title}</h3>
                          <p className={sectionHeaderSubtextClass}>
                            {selectedAssessment.description || 'No description provided.'}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span>Topic: {selectedAssessment.topic || '-'}</span>
                            <span>Difficulty: {selectedAssessment.difficulty || 'Medium'}</span>
                            <span>Items: {selectedAssessment.item_count ?? 0}</span>
                          </div>
                        </div>
                          <div className="flex items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedAssessment.already_submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {selectedAssessment.already_submitted ? 'Submitted' : 'Pending'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedAssessmentId('')}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl leading-none text-slate-500 transition hover:bg-slate-50"
                            aria-label="Close assessment"
                          >
                            &times;
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 overflow-y-auto teacher-scrollbar bg-slate-50 px-6 py-4">
                        {selectedAssessmentItems.length > 0 ? (
                          <div className="space-y-3">
                            {selectedAssessmentItems.map((item, index) => {
                              const itemNumber = item.item_no ?? index + 1;
                              const itemId = `assessment-${selectedAssessment.exercise_id}-item-${itemNumber}`;
                              return (
                                <div
                                  key={`${selectedAssessment.exercise_id}-${itemNumber}`}
                                  id={itemId}
                                  className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                                >
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <p className="text-lg font-semibold text-slate-900">#{itemNumber}</p>
                                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-600">
                                        Item
                                      </span>
                                    </div>
                                    <span className="text-sm text-slate-500">{item.max_score ?? 0} pts</span>
                                  </div>
                                  <p className="text-sm leading-7 text-slate-700">{item.question_content}</p>
                                  {Array.isArray(item.options) && item.options.length > 0 && (
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                      {item.options.map((option, optionIndex) => (
                                        <div
                                          key={`${selectedAssessment.exercise_id}-${itemNumber}-${optionIndex}`}
                                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                                        >
                                          {option}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No item breakdown was found for this assessment.</p>
                        )}
                      </div>

                      <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
                        <div className="space-y-3">
                          <div>
                            <p className="text-base font-semibold text-slate-900">Upload Scanned Answer Photos</p>
                            <p className="mt-1 text-sm text-slate-500">
                              Upload clear JPG or PNG photos for the best OCR and AI grading results. Once submitted, uploads are locked.
                            </p>
                            <p className="mt-2 text-xs text-amber-600">
                              PDF files are allowed, but automatic text extraction may be less reliable than image uploads.
                            </p>
                          </div>

                          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center">
                            <div className="flex-1 space-y-2">
                              <input
                                ref={fileInputRef}
                                id={`student-upload-${selectedAssessment.exercise_id}`}
                                type="file"
                                multiple
                                accept="image/*,.pdf"
                                onChange={handleFiles}
                                className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-700 file:mr-4 file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                              />
                              <p className="text-xs italic text-slate-500">{fileLabel}</p>
                              <p className="text-[11px] text-slate-500">Supported formats: JPG, JPEG, PNG, PDF</p>
                            </div>
                            <button
                              type="button"
                              onClick={openFilePicker}
                            className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 md:shrink-0"
                            >
                              Upload Photos
                            </button>
                          </div>

                          {selectedFiles.length > 0 && (
                            <div className="space-y-2">
                              {selectedFiles.map((file, index) => (
                                <div
                                  key={`${selectedAssessment.exercise_id}-${file.name}-${file.lastModified}`}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                                >
                                  <span className="truncate">{file.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeSelectedFile(index)}
                                    className="shrink-0 font-semibold text-rose-500 hover:text-rose-700"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={clearFiles}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                              >
                                Clear files
                              </button>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={handleSubmit}
                              disabled={submitLoading || selectedAssessment.already_submitted}
                              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                            >
                              {submitLoading ? 'Submitting...' : selectedAssessment.already_submitted ? 'Already Submitted' : 'Upload Photos'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedAssessmentId('')}
                              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              Close
                            </button>
                            {selectedAssessment.score !== null && selectedAssessment.score !== undefined && (
                              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                <p className="font-semibold">Score: {selectedAssessment.score}%</p>
                              </div>
                            )}
                          </div>

                          {selectedAssessment.ai_feedback && (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                              <p className="font-semibold">Feedback</p>
                              <p className="mt-1 text-xs text-emerald-700">{selectedAssessment.ai_feedback}</p>
                            </div>
                          )}

                          {submitMessage && <p className="text-xs text-slate-600">{submitMessage}</p>}
                        </div>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default StudentDashboard;
