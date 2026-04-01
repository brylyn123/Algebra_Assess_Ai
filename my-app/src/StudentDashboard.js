import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  clearCurrentLocalUserEmail,
  findLocalUser,
  getLocalUserEventName,
  getCurrentLocalUserEmail,
} from './localAuthStore';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const iconClassName = 'h-[18px] w-[18px]';

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
const compactListTitleClass = 'text-base font-semibold text-slate-900';
const compactListMetaClass = 'mt-3 flex flex-wrap gap-3 text-xs text-slate-500';
const compactListActionClass =
  'rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md';
const compactListBadgeClass = 'rounded-full px-3 py-1 text-xs font-semibold shadow-sm';
const sectionHeaderEyebrowClass = 'text-[11px] uppercase tracking-[0.35em] text-slate-400';
const sectionHeaderTitleClass = 'text-2xl font-semibold text-slate-900';
const sectionHeaderSubtextClass = 'mt-1 text-sm text-slate-500';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() => {
    const email = getCurrentLocalUserEmail();
    return email ? findLocalUser(email) : null;
  });
  const displayName = getDisplayName(currentUser);

  const studentId = currentUser?.student_id ?? currentUser?.user_id ?? null;
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectsError, setSubjectsError] = useState('');
  const [enrollCode, setEnrollCode] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState('');
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

  const fetchSubjects = useCallback(async () => {
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
  }, [studentId]);

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

  const performLogout = () => {
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
      loadingSubjects,
      subjectsError,
      availableAssessments,
      loadingAssessments,
      assessmentsError,
      dashboardStats,
      pendingAssessments,
    }),
    [
      enrolledSubjects,
      loadingSubjects,
      subjectsError,
      availableAssessments,
      loadingAssessments,
      assessmentsError,
      dashboardStats,
      pendingAssessments,
    ]
  );

  const isDashboardPage = location.pathname === '/student';
  const isSubmitPage = location.pathname === '/student/submit';

  useEffect(() => {
    document.body.style.overflowY = isSubmitPage ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflowY = 'auto';
    };
  }, [isSubmitPage]);

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
        className="min-h-screen overflow-hidden bg-slate-50"
        style={{
          backgroundImage:
            'linear-gradient(#cbd7ed 1px, transparent 1px), linear-gradient(90deg, #cbd7ed 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          backgroundColor: '#e0edff',
        }}
      >
        <div className="pointer-events-none absolute left-10 top-28 -z-0 h-56 w-56 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="pointer-events-none absolute right-20 top-40 -z-0 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />
        <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white shadow-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate('/student')}>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold">A</div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-white/80">AlgebraAssess</p>
                <p className="text-lg font-bold">Student Home</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 rounded-full border border-white/30 bg-white/5 px-4 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white font-bold text-blue-600">
                  {displayName.charAt(0)}
                </div>
                <div className="text-sm text-white">
                  <p className="font-semibold leading-none">{displayName}</p>
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

        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row lg:flex-nowrap">
          <aside className="sticky top-6 w-full flex-none self-start space-y-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-md lg:top-20 lg:h-[calc(100vh-160px)] lg:max-h-[calc(100vh-160px)] lg:w-72 lg:overflow-y-auto">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Quick Actions</p>
            <nav className="space-y-2">
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
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                    }`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-current/10 bg-white/15 text-xs font-extrabold">
                      {action.icon}
                    </span>
                    <span className="whitespace-nowrap text-base font-bold">{action.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Enroll by Code</h3>
              <form onSubmit={handleEnroll} className="space-y-2">
                <input
                  value={enrollCode}
                  onChange={(event) => setEnrollCode(event.target.value)}
                  placeholder="Paste teacher's join code"
                  className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={enrollLoading}
                  className="w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition duration-200 disabled:cursor-wait disabled:bg-blue-300"
                >
                  {enrollLoading ? 'Enrolling...' : 'Join Subject'}
                </button>
              </form>
              <p className="text-xs text-slate-400">
                Ask your teacher for the subject join code, then paste it here to be added immediately.
              </p>
              {enrollMessage && <p className="text-xs font-medium text-slate-600">{enrollMessage}</p>}
            </div>
          </aside>

          <main
            className={`flex-1 pr-0 ${
              isSubmitPage || isDashboardPage ? 'overflow-hidden' : 'overflow-y-auto'
            }`}
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          >
            <div
              className={`rounded-[2.25rem] border border-[#d9dfeb] bg-[#eef2f7] px-5 py-6 shadow-[0_24px_70px_rgba(59,130,246,0.08)] md:px-8 md:py-8 ${
                isDashboardPage ? 'h-[calc(100vh-200px)] overflow-hidden' : 'min-h-[680px]'
              }`}
            >
              <div className={`${isDashboardPage ? 'h-full overflow-hidden' : ''} space-y-10 pb-6 md:space-y-12 md:pb-8`}>
                <Outlet context={outletContext} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export const StudentOverview = () => {
  const {
    loadingAssessments = false,
    assessmentsError = '',
    dashboardStats = {},
    pendingAssessments = [],
  } = useOutletContext() ?? {};

  return (
    <>
      <section className="page-hero-card mb-6 px-8 py-10 md:mb-8 md:px-10 md:py-11">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Overview</p>
          <h1 className="text-3xl font-bold text-slate-900">Student Home</h1>
          <p className="text-sm text-slate-500">
            See your progress, check pending work, and keep track of active assessments.
          </p>
        </div>
      </section>

      <section className="mb-6 grid gap-8 md:mb-8 md:grid-cols-3">
        {dashboardWidgets.map((widget) => (
          <div
            key={widget.key}
            className={`rounded-[1.75rem] bg-gradient-to-r px-8 py-7 text-white shadow-sm ${widget.gradient}`}
          >
            <p className="text-[10px] uppercase tracking-[0.3em]">{widget.label}</p>
            <p className="text-3xl font-bold">{dashboardStats[widget.key] ?? '-'}</p>
          </div>
        ))}
      </section>

      <section className="mb-6 rounded-[2rem] border border-slate-100 bg-white px-7 py-8 shadow-sm md:mb-8 md:px-9 md:py-9">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Assessment Queue</p>
            <h2 className="text-2xl font-semibold text-slate-900">Ongoing Assessments</h2>
            <p className="mt-1 text-sm text-slate-500">
              These assessments are waiting for your submission.
            </p>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {dashboardStats.pendingAssessments ?? 0} pending
          </span>
        </div>

        <div className="mt-8 max-h-[360px] overflow-y-auto pr-2">
          <div className="space-y-6">
          {loadingAssessments ? (
            <p className="text-sm text-slate-500">Loading assessments...</p>
          ) : assessmentsError ? (
            <p className="text-sm text-rose-600">{assessmentsError}</p>
          ) : pendingAssessments.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-semibold text-slate-900">No assessments for now</p>
              <p className="mt-2 text-sm text-slate-500">All works caught up.</p>
            </div>
          ) : (
            pendingAssessments.map((assessment) => (
              <div key={assessment.exercise_id} className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-6 shadow-sm md:p-7">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      {assessment.subject_name} {assessment.subject_code ? `(${assessment.subject_code})` : ''}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">{assessment.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {assessment.description || 'Complete the assigned work and submit it from the assessment page.'}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    Awaiting submission
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>Topic: {assessment.topic || '-'}</span>
                  <span>Difficulty: {assessment.difficulty || 'Medium'}</span>
                  <span>Items: {assessment.item_count ?? 0}</span>
                  {assessment.subject_meta && <span>{assessment.subject_meta}</span>}
                </div>
              </div>
            ))
          )}
          </div>
        </div>
      </section>

    </>
  );
};

export const StudentSubjects = () => {
  const navigate = useNavigate();
  const { id: subjectIdParam = '' } = useParams();
  const {
    enrolledSubjects = [],
    loadingSubjects = false,
    subjectsError = '',
    availableAssessments = [],
    loadingAssessments = false,
    assessmentsError = '',
  } = useOutletContext() ?? {};
  const currentEmail = getCurrentLocalUserEmail();
  const currentUser = currentEmail ? findLocalUser(currentEmail) : null;
  const studentId = currentUser?.student_id ?? currentUser?.user_id ?? null;

  const [assessmentList, setAssessmentList] = useState(availableAssessments);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
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
    () => enrolledSubjects.find((subject) => String(subject.subject_id) === String(subjectIdParam)) ?? null,
    [enrolledSubjects, subjectIdParam]
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

  return (
    <>
      <section className="page-hero-card mb-6 px-8 py-10 md:mb-8 md:px-10 md:py-11">
        <div className="flex flex-col gap-2">
          <p className={sectionHeaderEyebrowClass}>
            {isSubjectAssessmentPage ? 'Assessments' : 'Subjects'}
          </p>
          <h1 className={sectionHeaderTitleClass}>
            {isSubjectAssessmentPage ? selectedSubject?.subject_name || 'Assessments' : 'My Subjects'}
          </h1>
          <p className={sectionHeaderSubtextClass}>
            {isSubjectAssessmentPage
              ? 'Review the assessments for this subject below, then open one to view the items and submit your captured solution.'
              : 'Click a subject to see its assessments, view the item list, and submit your captured solution if you are enrolled.'}
          </p>
        </div>
      </section>

      <section className="space-y-6">
        {!isSubjectAssessmentPage && (
          <div className="teacher-scrollbar mx-auto grid max-h-[calc(100vh-340px)] w-full max-w-5xl gap-4 overflow-y-auto pr-2">
            {loadingSubjects ? (
              <p className="text-sm text-slate-500">Loading subjects...</p>
            ) : subjectsError ? (
              <p className="text-sm text-rose-600">{subjectsError}</p>
            ) : enrolledSubjects.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <p className="text-lg font-semibold text-slate-900">No subjects yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Paste a teacher-provided join code from the sidebar to unlock your classes.
                </p>
              </div>
            ) : (
              enrolledSubjects.map((subject) => {
                const assessmentCount = assessmentCountBySubject.get(String(subject.subject_id)) ?? 0;
                return (
                  <button
                    key={subject.subject_id}
                    type="button"
                    onClick={() => {
                      navigate(`/student/subjects/${subject.subject_id}`);
                    }}
                    className={`${compactListCardClass} border-slate-100`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className={compactListTitleClass}>{subject.subject_name}</h3>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{subject.subject_code}</p>
                        <p className="mt-1 text-sm text-slate-500">Teacher: {subject.teacher_name}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {subject.course} - {subject.section_name || subject.section} - {subject.semester} {subject.school_year}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                        <span className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600">
                          Enrolled
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {assessmentCount} assessment{assessmentCount === 1 ? '' : 's'} assigned
                        </span>
                        <span className="rounded-full bg-blue-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                          View Assessments
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {isSubjectAssessmentPage && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate('/student/subjects')}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Back to Subjects
              </button>
              {selectedSubject && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {subjectAssessmentCount} assessment{subjectAssessmentCount === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {!selectedSubject ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <p className="text-lg font-semibold text-slate-900">Subject not found</p>
                <p className="mt-2 text-sm text-slate-500">This subject is not in your enrolled list.</p>
              </div>
            ) : (
              <>
                {loadingAssessments ? (
                  <p className="text-sm text-slate-500">Loading assessments...</p>
                ) : assessmentsError ? (
                  <p className="text-sm text-rose-600">{assessmentsError}</p>
                ) : subjectAssessments.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-900">No assessments for this subject yet</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Your teacher has not posted an assessment here yet.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[calc(100vh-420px)] space-y-3 overflow-y-auto pr-2 teacher-scrollbar">
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
                    className={`${compactListCardClass} ${
                      isSelected
                        ? 'border-blue-300 bg-[linear-gradient(135deg,rgba(239,246,255,1),rgba(219,234,254,0.96))] shadow-[0_18px_50px_rgba(59,130,246,0.14)]'
                        : 'border-slate-100'
                    }`}
                  >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                                {assessment.subject_name} {assessment.subject_code ? `(${assessment.subject_code})` : ''}
                              </p>
                              <h3 className={compactListTitleClass}>{assessment.title}</h3>
                              <p className="mt-1 text-sm text-slate-500">{assessment.description || 'No description provided.'}</p>
                            </div>
                            <div className="flex flex-col items-start gap-2 lg:items-end">
                              <span className={`${compactListBadgeClass} ${statusClass}`}>{statusLabel}</span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedAssessmentId(String(assessment.exercise_id));
                                }}
                                className={compactListActionClass}
                              >
                                {assessment.already_submitted ? 'View' : 'Submit / View'}
                              </button>
                            </div>
                          </div>

                          <div className={compactListMetaClass}>
                            <span>Topic: {assessment.topic || '-'}</span>
                            <span>Difficulty: {assessment.difficulty || 'Medium'}</span>
                            <span>Items: {assessment.item_count ?? 0}</span>
                            {assessment.latest_submission_at && <span>Latest: {formatDateTime(assessment.latest_submission_at)}</span>}
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

                      <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-6 py-4">
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
                              You can select multiple images. Once submitted, uploads are locked.
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
    </>
  );
};

export default StudentDashboard;
