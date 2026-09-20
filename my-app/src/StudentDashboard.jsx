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
import { apiFetch } from './fetchClient';
import MobileNav from './components/MobileNav';
import NotificationBell from './components/NotificationBell';
import { useToast } from './components/Toast';
import MathText from './MathText';

const iconClassName = 'h-4 w-4';

function toAbsoluteFileUrl(path) {
  if (!path) return '';
  if (/^(https?:|blob:)/i.test(path)) return path;
  const normalizedPath = String(path).replace(/^\/+/, '');
  return `${API_BASE_URL}/${normalizedPath}`;
}

const analyzeImageQuality = (file) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ pass: true, reasons: [], note: 'PDF quality verified after upload' });
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      try {
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        const gray = new Float32Array(size * size);

        for (let i = 0; i < gray.length; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        }

        const reasons = [];

        let blurSum = 0;
        let blurCount = 0;
        for (let y = 1; y < size - 1; y++) {
          for (let x = 1; x < size - 1; x++) {
            const idx = y * size + x;
            const laplacian = -4 * gray[idx]
              + gray[idx - 1] + gray[idx + 1]
              + gray[idx - size] + gray[idx + size];
            blurSum += laplacian * laplacian;
            blurCount++;
          }
        }
        const blurVariance = blurCount > 0 ? blurSum / blurCount : 0;
        if (blurVariance < 50) {
          reasons.push('Image may be blurry');
        }

        let brightnessSum = 0;
        for (let i = 0; i < gray.length; i++) {
          brightnessSum += gray[i];
        }
        const brightness = brightnessSum / gray.length;
        if (brightness < 30) {
          reasons.push('Image is too dark');
        } else if (brightness > 225) {
          reasons.push('Image is too bright');
        }

        let contrastSum = 0;
        for (let i = 0; i < gray.length; i++) {
          contrastSum += (gray[i] - brightness) * (gray[i] - brightness);
        }
        const contrast = Math.sqrt(contrastSum / gray.length);
        if (contrast < 20) {
          reasons.push('Image has low contrast');
        }

        resolve({ pass: true, reasons });
      } catch {
        resolve({ pass: true, reasons: [] });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ pass: true, reasons: [] });
    };

    img.src = url;
  });
};

const checkImageContent = async (file) => {
  if (!file.type.startsWith('image/')) {
    return { pass: true, reason: 'PDF content verified after upload' };
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await apiFetch('/check_image_legibility.php', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const result = await response.json();

    if (result.status === 'success') {
      return { pass: result.readable, reason: result.reason || '' };
    }
    return { pass: true, reason: '' };
  } catch {
    return { pass: true, reason: '' };
  }
};

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
  const { toast } = useToast();
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
  const [showJoinCard, setShowJoinCard] = useState(false);
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
    setShowJoinCard(false);
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
      const response = await apiFetch('/enroll_subject.php', {
        method: 'POST',
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

    // Calculate average from actual scored assessments
    const scoredAssessments = availableAssessments.filter(
      (assessment) => assessment.score !== null && assessment.score !== undefined && !Number.isNaN(Number(assessment.score))
    );
    const averageScore = scoredAssessments.length > 0
      ? Math.round(scoredAssessments.reduce((sum, a) => sum + Number(a.score), 0) / scoredAssessments.length)
      : null;

    return {
      enrolledSubjects: enrolledSubjects.length > 0 ? enrolledSubjects.length : '-',
      completedAssessments,
      averageScore: averageScore !== null ? `${averageScore}%` : 'TBD',
      pendingAssessments,
    };
  }, [availableAssessments, enrolledSubjects.length]);

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
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-1.5 sm:px-6 lg:px-8">
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
              <NotificationBell />
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

        <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
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
                              className={`relative flex w-full items-center gap-2.5 rounded-xl ${isExpanded ? 'px-3 py-2' : 'justify-center px-0 py-2'} text-left text-xs font-bold transition ${isActive
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
    { key: 'enrolledSubjects', label: 'Subjects' },
    { key: 'completedAssessments', label: 'Completed' },
    { key: 'averageScore', label: 'Avg Score' },
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
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-4 text-white shadow-lg shadow-purple-500/20">
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
          <div className="rounded-[1.05rem] border border-slate-200/60 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Overview</p>
            <div className="grid grid-cols-3 gap-2">
              {stats.map((stat) => (
                <div
                  key={stat.key}
                  className="rounded-lg bg-slate-50 p-3 text-center transition hover:bg-slate-100"
                >
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{stat.label}</p>
                  <p className="text-lg font-bold text-slate-900">{dashboardStats[stat.key] ?? '-'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Assessments */}
          <div className="rounded-[1.1rem] border border-slate-200/60 bg-white p-3 shadow-sm">
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
                      const due = new Date(assessment.due_date);
                      if (Number.isNaN(due.getTime())) return null;
                      const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + due.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                      const isPast = due.getTime() < Date.now();
                      const cls = isPast ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600';
                      return (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                          Due {formatted}
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
  const { toast } = useToast();
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
    setEnrollCode = () => { },
    enrollLoading = false,
    enrollMessage = '',
    enrollSuccess = false,
    setEnrollSuccess = () => { },
    showJoinCard = true,
    setShowJoinCard = () => { },
    handleEnroll = () => { },
  } = useOutletContext() ?? {};
  const currentEmail = getCurrentLocalUserEmail();
  const currentUser = currentEmail ? findLocalUser(currentEmail) : null;
  const studentId = currentUser?.user_id ?? currentUser?.student_id ?? null;

  const [assessmentList, setAssessmentList] = useState(availableAssessments);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileQualityResults, setFileQualityResults] = useState(new Map());
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [showArchivedSubjects, setShowArchivedSubjects] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
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

  const handleFiles = async (event) => {
    const fileList = Array.from(event.target.files || []);
    if (fileList.length === 0) return;

    const startIndex = selectedFiles.length;
    setSelectedFiles((current) => [...current, ...fileList]);
    event.target.value = '';

    // Step 1: Run client-side quality checks (instant) and mark as checking content
    for (let i = 0; i < fileList.length; i++) {
      const qualityResult = await analyzeImageQuality(fileList[i]);
      setFileQualityResults((prev) => {
        const next = new Map(prev);
        next.set(startIndex + i, { ...qualityResult, pass: true, checking: true });
        return next;
      });
      if (!qualityResult.pass) {
        const reasons = qualityResult.reasons?.join(', ') || 'Image quality is poor';
        toast.warning(`${fileList[i].name}: ${reasons}. Please retake with better lighting.`);
      }
    }

    // Step 2: Run content checks in background and update status when done
    fileList.forEach((file, i) => {
      const fileIndex = startIndex + i;
      checkImageContent(file).then((contentResult) => {
        setFileQualityResults((prev) => {
          const next = new Map(prev);
          const existing = next.get(fileIndex) || {};
          next.set(fileIndex, { ...existing, ...contentResult, checking: false });
          return next;
        });
        if (!contentResult.pass) {
          toast.error(`${file.name}: ${contentResult.reason || 'This is not a handwritten math solution.'}`);
        }
      });
    });
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const removeSelectedFile = (indexToRemove) => {
    setSelectedFiles((current) => current.filter((_, index) => index !== indexToRemove));
    setFileQualityResults((prev) => {
      const next = new Map(prev);
      next.delete(indexToRemove);
      return next;
    });
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setFileQualityResults(new Map());
    setSubmitMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasFailingImages = useMemo(() => {
    for (const [, result] of fileQualityResults) {
      if (result && !result.pass) return true;
    }
    return false;
  }, [fileQualityResults]);

  const isCheckingContent = useMemo(() => {
    for (const [, result] of fileQualityResults) {
      if (result && result.checking === true) return true;
    }
    return false;
  }, [fileQualityResults]);

  const handleSubmit = async () => {
    if (!studentId) {
      setSubmitMessage('Please log in as a student to submit work.');
      toast.warning('Please log in as a student to submit work.');
      return;
    }

    if (!selectedSubject) {
      setSubmitMessage('Choose an enrolled subject first.');
      toast.warning('Choose an enrolled subject first.');
      return;
    }

    if (!selectedAssessment) {
      setSubmitMessage('Choose an assessment first.');
      toast.warning('Choose an assessment first.');
      return;
    }

    if (selectedAssessment.already_submitted) {
      setSubmitMessage('This assessment was already submitted. Your teacher can grade it now.');
      try { toast?.info('Already submitted — waiting for teacher to grade.'); } catch (_) {}
      setTimeout(() => {
        setSelectedAssessmentId('');
        setSubmitMessage('');
      }, 2000);
      return;
    }

    if (selectedFiles.length === 0) {
      setSubmitMessage('Upload at least one file before submitting.');
      toast.warning('Upload at least one file before submitting.');
      return;
    }

    if (hasFailingImages) {
      toast.warning('Some images may be blurry or not handwritten math. Submitting anyway.');
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

      const response = await apiFetch('/submit_assessment.php', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();

      if (payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to submit assessment.');
      }

      let message = 'Assessment submitted successfully. Your teacher can now grade it from Grade Submissions.';
      if (payload.warnings && payload.warnings.length > 0) {
        const warningMsgs = payload.warnings.map((w) => `${w.file}: ${w.reason}`).join('; ');
        message += ` Some files were removed: ${warningMsgs}`;
        toast.warning(message);
      } else {
        toast.success('Assessment submitted successfully! Your teacher can now grade it.');
      }

      setSubmitMessage(message);
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
      try { toast?.success('Assessment submitted successfully!'); } catch (_) {}
      setTimeout(() => {
        setSelectedAssessmentId('');
        setSubmitMessage('');
      }, 1200);
    } catch (error) {
      const errMsg = error.message || 'Unable to submit assessment.';
      setSubmitMessage(errMsg);
      try { toast?.error(errMsg); } catch (_) {}
      if (errMsg.toLowerCase().includes('already submitted')) {
        setTimeout(() => setSelectedAssessmentId(''), 1500);
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const fileLabel = selectedFiles.length === 0
    ? 'Drop files here or click to browse'
    : `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} ready to upload`;

  const subjectAssessmentCount = subjectAssessments.length;
  const isSubjectAssessmentPage = Boolean(subjectIdParam);
  const visibleSubjects = enrolledSubjects;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      {!isSubjectAssessmentPage && (
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-5 py-4 text-white shadow-lg shadow-blue-200/50">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-indigo-400/20 blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-blue-100">Subjects</p>
            </div>
            <h1 className="text-xl font-black tracking-tight">My Subjects</h1>
            <p className="mt-1 text-xs text-blue-100">Keep track of your enrolled classes and join a new subject with your teacher's code.</p>
          </div>
        </section>
      )}

      {!isSubjectAssessmentPage && (
        <section>
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
        </section>
      )}

      {/* Join Subject Modal */}
      {!isSubjectAssessmentPage && showJoinCard && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            {enrollSuccess && enrollMessage ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-900">Subject Joined!</p>
                <p className="mt-1 text-xs text-slate-500">{enrollMessage}</p>
                <button
                  type="button"
                  onClick={() => {
                    setEnrollMessage('');
                    setEnrollSuccess(false);
                    setShowJoinCard(false);
                  }}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Join Subject</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">Enter the class code from your teacher.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowJoinCard(false)}
                    className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleEnroll} className="flex gap-2">
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
                    autoFocus
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    type="submit"
                    disabled={enrollLoading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300"
                  >
                    {enrollLoading ? 'Joining...' : 'Join'}
                  </button>
                </form>
                {enrollMessage && !enrollSuccess && (
                  <p className="mt-2 text-[11px] font-medium text-rose-600">{enrollMessage}</p>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      <section className="flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden">
        {!isSubjectAssessmentPage && (
          <>
            <div className="teacher-scrollbar grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto pr-2 pb-4 sm:grid-cols-2 lg:grid-cols-3">
              {loadingSubjects ? (
                <p className="text-sm text-slate-500">Loading subjects...</p>
              ) : subjectsError ? (
                <p className="text-sm text-rose-600">{subjectsError}</p>
              ) : visibleSubjects.length === 0 ? (
                <div className="col-span-full rounded-[1rem] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <p className="text-sm font-semibold text-slate-900">No subjects yet</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Use the join subject button above to unlock your classes.
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
                        navigate(`/student/subjects/${subject.subject_id}`);
                      }}
                      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/60 p-6 text-left shadow-[0_2px_4px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_4px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)] min-h-[10rem] ${subjectTheme.surfaceClass}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                              {subject.subject_code || 'Subject'}
                            </p>
                            <p className="mt-2 text-lg font-bold text-slate-900">{subject.subject_name}</p>
                            <p className="mt-2 text-sm leading-snug text-slate-500">
                              {subject.course || 'Course'} • {subject.year || 'Year'} • {subject.section_name || subject.section || 'Section'}
                            </p>
                          </div>

                          <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-semibold text-emerald-700">
                            Active
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
                  <div className="teacher-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-2">
                    {subjectAssessments.map((assessment) => {
                      const isSelected = String(assessment.exercise_id) === String(selectedAssessmentId);
                      const isSubmitted = Boolean(assessment.already_submitted || (assessment.submission_status && assessment.submission_status !== 'Not Submitted'));
                      const isOverdue = (() => {
                        if (!assessment.due_date) return false;
                        const due = new Date(assessment.due_date);
                        if (Number.isNaN(due.getTime())) return false;
                        return new Date() > due;
                      })();
                      const statusLabel = isSubmitted ? 'Submitted' : isOverdue ? 'Closed' : 'Pending';
                      const statusClass =
                        statusLabel === 'Submitted'
                          ? 'bg-emerald-100 text-emerald-700'
                          : statusLabel === 'Closed'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-amber-100 text-amber-700';

                      return (
                        <div
                          key={assessment.exercise_id}
                          onClick={() => setSelectedAssessmentId(String(assessment.exercise_id))}
                          className={`group relative overflow-hidden rounded-xl border transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${isSelected
                            ? 'border-blue-300 bg-white shadow-[0_4px_16px_rgba(59,130,246,0.12)]'
                            : 'border-slate-100 bg-white hover:border-slate-200'
                            }`}
                        >
                          <div className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${subjectTheme.accentClass}`} />
                          <div className="flex items-center gap-3 p-3 pl-4">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${subjectTheme.cardBadgeClass} text-xs font-bold`}>
                              {assessment.title?.charAt(0)?.toUpperCase() || 'Q'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate text-sm font-bold text-slate-900">{assessment.title}</h3>
                                <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${statusClass}`}>
                                  {statusLabel}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400">
                                <span>{assessment.topic || 'General'}</span>
                                <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                                <span>{assessment.difficulty || 'Medium'}</span>
                                <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                                <span>{assessment.item_count ?? 0} items</span>
                                {assessment.due_date && (() => {
                                  const due = new Date(assessment.due_date);
                                  if (Number.isNaN(due.getTime())) return null;
                                  const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + due.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                                  const isPast = due.getTime() < Date.now();
                                  let cls = 'text-slate-400';
                                  if (isPast) { cls = 'text-red-500 font-semibold'; }
                                  return (
                                    <>
                                      <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                                      <span className={cls}>Due {formatted}</span>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedAssessmentId(String(assessment.exercise_id));
                              }}
                              className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${
                                isOverdue && !assessment.already_submitted
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                  : assessment.already_submitted
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                              }`}
                            >
                              {assessment.already_submitted ? 'View' : isOverdue ? 'Closed' : 'Submit'}
                            </button>
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
                      className="relative flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${subjectTheme.accentClass}`} />
                      <div className="absolute right-4 top-5 z-10 flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedAssessment.already_submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {selectedAssessment.already_submitted ? 'Submitted' : 'Pending'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedAssessmentId('')}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xl leading-none text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                          aria-label="Close assessment"
                        >
                          &times;
                        </button>
                      </div>
                      <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(239,246,255,0.92))] px-6 py-4 pr-24">
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
                      </div>

                      <div className="flex-1 min-h-0 overflow-y-auto teacher-scrollbar">
                        <div className="bg-gradient-to-b from-slate-50 to-white px-4 py-3 space-y-2">
                          {selectedAssessmentItems.length > 0 ? (
                            <div className="space-y-2">
                            {selectedAssessmentItems.map((item, index) => {
                              const itemNumber = item.item_no ?? index + 1;
                              const itemId = `assessment-${selectedAssessment.exercise_id}-item-${itemNumber}`;
                              return (
                                <div
                                  key={`${selectedAssessment.exercise_id}-${itemNumber}`}
                                  id={itemId}
                                  className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
                                >
                                  <div className="mb-1.5 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-semibold text-slate-900">#{itemNumber}</p>
                                      <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                        Item
                                      </span>
                                    </div>
                                    <span className="text-xs text-slate-500">{item.max_score ?? 0} pts</span>
                                  </div>
                                  <p className="text-xs leading-6 text-slate-700 overflow-hidden break-words"><MathText text={item.question_content} /></p>
                                  {Array.isArray(item.options) && item.options.length > 0 && (
                                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                                        {item.options.map((option, optionIndex) => (
                                          <div
                                            key={`${selectedAssessment.exercise_id}-${itemNumber}-${optionIndex}`}
                                            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600"
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

                        <div className="border-t border-slate-200 bg-white px-4 py-3 space-y-2">
                          {selectedAssessment.already_submitted ? (
                            <>
                              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                                <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                                <p className="text-xs font-semibold text-emerald-700">Already Submitted — your teacher can now grade this.</p>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Submitted Solution</p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  Your uploaded files are shown below. Uploads are locked after submission.
                                </p>
                              </div>

                              {Array.isArray(selectedAssessment.submission_files) && selectedAssessment.submission_files.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                                  {selectedAssessment.submission_files.map((file, idx) => {
                                    const fileUrl = toAbsoluteFileUrl(file.path);
                                    const isImage = file.type === 'image';
                                    return (
                                      <button
                                        key={`${file.path}-${idx}`}
                                        type="button"
                                        onClick={() => setPreviewFile(file)}
                                        className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-blue-300 hover:shadow-md"
                                      >
                                        {isImage ? (
                                          <img
                                            src={fileUrl}
                                            alt={file.name || `Submission ${idx + 1}`}
                                            className="h-20 w-full object-cover"
                                          />
                                        ) : (
                                          <div className="flex h-20 w-full items-center justify-center bg-slate-100">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-slate-400">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                            </svg>
                                          </div>
                                        )}
                                        <p className="truncate px-1.5 py-1 text-[10px] text-slate-600">{file.name}</p>
                                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/10">
                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-white opacity-0 drop-shadow transition group-hover:opacity-100">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
                                          </svg>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                                  <p className="text-xs text-slate-500">No files were uploaded for this submission.</p>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Upload Scanned Answer Photos</p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  Upload clear JPG or PNG photos for the best OCR and AI grading results. Once submitted, uploads are locked.
                                </p>
                                <p className="mt-1 text-[10px] text-amber-600">
                                  PDF files are allowed, but automatic text extraction may be less reliable than image uploads.
                                </p>
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                  <div className="flex-1 space-y-1.5">
                                    <input
                                      ref={fileInputRef}
                                      id={`student-upload-${selectedAssessment.exercise_id}`}
                                      type="file"
                                      multiple
                                      accept="image/*,.pdf"
                                      onChange={handleFiles}
                                      className="w-full rounded-lg border border-slate-200 bg-white text-xs text-slate-700 file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
                                    />
                                    <p className="text-[11px] italic text-slate-500">{fileLabel}</p>
                                    <p className="text-[10px] text-slate-500">Supported formats: JPG, JPEG, PNG, PDF</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={openFilePicker}
                                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 md:shrink-0"
                                  >
                                    Select Files
                                  </button>
                                </div>

                                {selectedFiles.length > 0 && (
                                  <div className="mt-2.5 space-y-1.5 border-t border-slate-200 pt-2.5">
                                  <p className="text-[11px] font-semibold text-slate-500">Selected files ({selectedFiles.length})</p>
                                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                                    {selectedFiles.map((file, index) => {
                                      const isImage = file.type?.startsWith('image/');
                                      const previewUrl = isImage ? URL.createObjectURL(file) : null;
                                      return (
                                        <div
                                          key={`${selectedAssessment.exercise_id}-${file.name}-${file.lastModified}-${index}`}
                                          className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                                        >
                                          {isImage && previewUrl ? (
                                            <button
                                              type="button"
                                              onClick={() => setPreviewFile({ name: file.name, path: previewUrl, type: 'image' })}
                                              className="block w-full"
                                            >
                                              <img
                                                src={previewUrl}
                                                alt={file.name}
                                                className="h-20 w-full object-cover transition group-hover:brightness-90"
                                              />
                                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/10">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-white opacity-0 drop-shadow transition group-hover:opacity-100">
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
                                                </svg>
                                              </div>
                                            </button>
                                          ) : (
                                            <div className="flex h-32 w-full items-center justify-center">
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-slate-400">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                              </svg>
                                            </div>
                                          )}
                                          <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                                            <span className="truncate text-[11px] text-slate-600">{file.name}</span>
                                            <button
                                              type="button"
                                              onClick={() => removeSelectedFile(index)}
                                              className="shrink-0 text-[11px] font-semibold text-rose-500 hover:text-rose-700"
                                            >
                                              Remove
                                            </button>
                                          </div>
                                           {(() => {
                                            const quality = fileQualityResults.get(index);
                                            if (!quality) return null;
                                            if (quality.checking) {
                                              return (
                                                <div className="px-2 pb-1.5">
                                                  <span className="text-[10px] font-medium text-blue-500 flex items-center gap-1">
                                                    <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    Checking content...
                                                  </span>
                                                </div>
                                              );
                                            }
                                            if (quality.pass) {
                                              return (
                                                <div className="px-2 pb-1.5">
                                                  <span className="text-[10px] font-medium text-emerald-600">✓ Clear</span>
                                                </div>
                                              );
                                            }
                                            return (
                                              <div className="px-2 pb-1.5">
                                                <span className="text-[10px] font-medium text-rose-500">
                                                  ⚠ {quality.reason || 'Not a handwritten math solution'}
                                                </span>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={clearFiles}
                                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                                  >
                                    Clear all
                                  </button>
                                </div>
                              )}
                              </div>
                            </>
                          )}

                          <div className="flex flex-wrap items-center gap-2">
                            {!selectedAssessment.already_submitted && (() => {
                              const isOverdue = (() => {
                                if (!selectedAssessment.due_date) return false;
                                const due = new Date(selectedAssessment.due_date);
                                if (Number.isNaN(due.getTime())) return false;
                                return new Date() > due;
                              })();
                              return (
                                <>
                                  {isOverdue && (
                                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-700">
                                      <span className="font-semibold">Past due date</span> — Submission closed
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitLoading || isOverdue}
                                    className={`ml-auto rounded-xl px-4 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 ${isOverdue ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                                  >
                                    {isOverdue ? 'Submission Closed' : submitLoading ? 'Submitting...' : 'Submit Files'}
                                  </button>
                                </>
                              );
                            })()}
                            {selectedAssessment.score !== null && selectedAssessment.score !== undefined && (
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
                                <p className="font-semibold">Score: {selectedAssessment.score}%</p>
                              </div>
                            )}
                          </div>

                          {selectedAssessment.ai_feedback && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                              <p className="font-semibold">Feedback</p>
                              <p className="mt-0.5 text-[11px] text-emerald-700">{selectedAssessment.ai_feedback}</p>
                            </div>
                          )}

                          {submitMessage && (
                            <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${submitMessage.includes('successfully') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 shrink-0 ${submitMessage.includes('successfully') ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {submitMessage.includes('successfully') ? (
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                ) : (
                                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                )}
                              </svg>
                              {submitMessage}
                            </div>
                          )}
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

      {previewFile && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewFile(null)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-600 shadow-lg transition hover:text-slate-900"
            >
              &times;
            </button>
            {previewFile.type === 'pdf' ? (
              <iframe
                title={previewFile.name}
                src={toAbsoluteFileUrl(previewFile.path)}
                className="h-[80vh] w-[80vw] rounded-2xl border border-slate-200 bg-white"
              />
            ) : (
              <img
                src={toAbsoluteFileUrl(previewFile.path)}
                alt={previewFile.name}
                className="max-h-[85vh] max-w-[90vw] rounded-2xl border border-slate-200 bg-white object-contain shadow-2xl"
              />
            )}
            <p className="mt-2 text-center text-xs text-white/80">{previewFile.name}</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StudentDashboard;
