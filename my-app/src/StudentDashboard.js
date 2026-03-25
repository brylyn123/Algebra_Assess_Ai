import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  clearCurrentLocalUserEmail,
  findLocalUser,
  getLocalUserEventName,
  getCurrentLocalUserEmail,
} from './localAuthStore';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const quickActions = [
  { label: 'Dashboard', icon: 'D', path: '/student' },
  { label: 'My Subjects', icon: 'S', path: '/student/subjects' },
  { label: 'Submit Assessment', icon: 'U', path: '/student/submit' },
  { label: 'Reports & Feedback', icon: 'R', path: '/student/reports' },
  { label: 'Manage Profile', icon: 'P', path: '/student/profile' },
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

  const performLogout = () => {
    localStorage.removeItem('user');
    clearCurrentLocalUserEmail();
    setLogoutConfirm(false);
    navigate('/login');
  };

  useEffect(() => {
    fetchSubjects();
  }, [studentId]);

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
        <header className="sticky top-0 z-50 bg-blue-600 text-white shadow-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate('/student')}>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold">A</div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-white/80">AlgebraAssess</p>
                <p className="text-lg font-bold">Student Dashboard</p>
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
                const isActive = location.pathname === action.path;
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
    enrolledSubjects = [],
    loadingSubjects = false,
    subjectsError = '',
    loadingAssessments = false,
    assessmentsError = '',
    dashboardStats = {},
    pendingAssessments = [],
  } = useOutletContext() ?? {};

  return (
    <>
      <section className="mb-6 rounded-[2.5rem] border border-slate-100 bg-white px-8 py-10 shadow-lg md:mb-8 md:px-10 md:py-11">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Overview</p>
          <h1 className="text-3xl font-bold text-slate-900">Student Dashboard</h1>
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
  const {
    enrolledSubjects = [],
    loadingSubjects = false,
    subjectsError = '',
  } = useOutletContext() ?? {};

  return (
    <>
      <section className="mb-6 rounded-[2.5rem] border border-slate-100 bg-white px-8 py-10 shadow-lg md:mb-8 md:px-10 md:py-11">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Subjects</p>
          <h1 className="text-3xl font-bold text-slate-900">My Subjects</h1>
          <p className="text-sm text-slate-500">
            View all joined classes and the subjects currently available in your student account.
          </p>
        </div>
      </section>

      <section className="space-y-6 pb-2">
        {loadingSubjects ? (
          <p className="text-sm text-slate-500">Loading subjects...</p>
        ) : (
          <>
            {subjectsError && <p className="text-sm text-rose-600">{subjectsError}</p>}
            {enrolledSubjects.length > 0 ? (
              <div className="space-y-6">
                {enrolledSubjects.map((subject) => (
                  <div key={subject.subject_id} className="rounded-[2rem] border border-slate-100 bg-white p-7 shadow-sm md:p-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{subject.subject_name}</h3>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{subject.subject_code}</p>
                      </div>
                      <span className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600">
                        Enrolled
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">Teacher: {subject.teacher_name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {subject.course} - {subject.section_name || subject.section} - {subject.semester} {subject.school_year}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <p className="text-lg font-semibold text-slate-900">No subjects yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Paste a teacher-provided join code from the sidebar to unlock your classes.
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
};

export default StudentDashboard;
