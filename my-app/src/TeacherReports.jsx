import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];

const clampScore = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 0;
  return Math.max(0, Math.min(100, Number(value)));
};

const getScoreTier = (score) => {
  if (score >= 90) return { key: 'mastery', gradient: 'from-emerald-400 via-emerald-500 to-green-600', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', label: 'Mastery' };
  if (score >= 75) return { key: 'proficient', gradient: 'from-sky-400 via-blue-500 to-indigo-500', bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200', label: 'Proficient' };
  if (score >= 50) return { key: 'developing', gradient: 'from-amber-400 via-orange-500 to-amber-600', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Developing' };
  return { key: 'needsWork', gradient: 'from-rose-400 via-rose-500 to-red-500', bg: 'bg-rose-50', text: 'text-rose-700', ring: 'ring-rose-200', label: 'Needs Work' };
};

const AnimatedCounter = ({ value, suffix = '' }) => {
  const [display, setDisplay] = useState(0);
  const numericVal = typeof value === 'string' ? parseFloat(value) : Number(value);
  const isNumeric = !Number.isNaN(numericVal);

  useEffect(() => {
    if (!isNumeric) { setDisplay(0); return; }
    const end = numericVal;
    const duration = 800;
    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(end * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [numericVal, isNumeric]);

  if (!isNumeric) return <>{value ?? 'N/A'}</>;
  return <>{display}{suffix}</>;
};

const ProgressBar = ({ score, submissions, graded, label, isHovered, onHover, onLeave, index, prefersReducedMotion }) => {
  const clamped = clampScore(score);
  const tier = getScoreTier(clamped);
  const gradingProgress = submissions > 0 ? Math.round((graded / submissions) * 100) : 0;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${isHovered ? 'border-blue-200 bg-white shadow-lg shadow-blue-100/50 -translate-y-0.5' : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md'}`}>
        <div className="flex items-center gap-4 p-4">
          <div className="relative shrink-0">
            <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
              <motion.circle
                cx="22" cy="22" r="18" fill="none"
                stroke={clamped >= 90 ? '#10b981' : clamped >= 75 ? '#3b82f6' : clamped >= 50 ? '#f59e0b' : '#f43f5e'}
                strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${clamped * 1.131} 113.1`}
                initial={prefersReducedMotion ? false : { strokeDasharray: '0 113.1' }}
                animate={{ strokeDasharray: `${clamped * 1.131} 113.1` }}
                transition={{ duration: 1, delay: index * 0.06 + 0.3, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-[10px] font-black ${tier.text}`}>{Math.round(clamped)}</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-900 truncate">{label}</p>
              {score !== null && score !== undefined && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${tier.bg} ${tier.text} ring-1 ${tier.ring}`}>
                  {tier.label}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {submissions} submission{submissions !== 1 ? 's' : ''} · {graded} graded
            </p>
          </div>

          {score !== null && score !== undefined ? (
            <div className="hidden shrink-0 sm:block">
              <span className={`inline-flex items-center rounded-xl px-3 py-1.5 text-sm font-black ${tier.bg} ${tier.text} ring-1 ${tier.ring}`}>
                {clamped.toFixed(1)}%
              </span>
            </div>
          ) : (
            <span className="hidden shrink-0 text-xs font-medium text-slate-400 sm:block">No score</span>
          )}
        </div>

        <div className="px-4 pb-3">
          <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${tier.gradient}`}
              initial={prefersReducedMotion ? false : { width: 0 }}
              animate={{ width: `${Math.max(clamped, 2)}%` }}
              transition={{ duration: 0.9, delay: index * 0.06 + 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
            {[25, 50, 75].map((mark) => (
              <div key={mark} className="absolute top-0 h-full w-px bg-slate-200/60" style={{ left: `${mark}%` }} />
            ))}
          </div>

          {submissions > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[9px] font-semibold text-slate-400">Grading</span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-slate-300"
                  initial={prefersReducedMotion ? false : { width: 0 }}
                  animate={{ width: `${gradingProgress}%` }}
                  transition={{ duration: 0.7, delay: index * 0.06 + 0.5, ease: 'easeOut' }}
                />
              </div>
              <span className="text-[9px] font-bold text-slate-500">{gradingProgress}%</span>
            </div>
          )}
        </div>

        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-slate-100"
            >
              <div className="grid grid-cols-3 gap-3 bg-slate-50/80 px-4 py-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Avg Score</p>
                  <p className="text-sm font-black text-slate-800">{score !== null ? `${clamped.toFixed(1)}%` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Graded</p>
                  <p className="text-sm font-black text-slate-800">{graded}/{submissions}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Progress</p>
                  <p className="text-sm font-black text-slate-800">{gradingProgress}%</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const StatCard = ({ label, value, accent, icon, index, prefersReducedMotion }) => (
  <motion.div
    initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
    className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/50"
  >
    <div className="flex items-start justify-between">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent} transition-transform duration-300 group-hover:scale-110`}>
        {icon}
      </div>
    </div>
    <p className="mt-3 text-2xl font-black text-slate-900 tracking-tight">
      <AnimatedCounter value={value} />
    </p>
    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
  </motion.div>
);

const TeacherReports = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = storedTeacher?.user_id ?? storedTeacher?.teacher_id ?? storedTeacher?.id ?? null;
  const prefersReducedMotion = useReducedMotion();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeChart, setActiveChart] = useState('subjects');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadReport = async () => {
      if (!teacherId) {
        if (isMounted) { setLoading(false); setErrorMessage('Log in as a teacher to view reports.'); }
        return;
      }
      setLoading(true);
      setErrorMessage('');
      try {
        const response = await fetch(`${API_BASE_URL}/get_teacher_reports.php?teacher_id=${teacherId}`, { credentials: 'include', signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(payload.message || 'Unable to load reports.');
        if (isMounted) setReport(payload.report);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isMounted) { setReport(null); setErrorMessage(error.message || 'Unable to load reports.'); }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadReport();
    return () => { isMounted = false; controller.abort(); };
  }, [teacherId]);

  const summary = report?.summary ?? {};

  const gradedRatio = summary.total_submissions > 0
    ? Math.round((summary.graded_submissions / summary.total_submissions) * 100) : 0;
  const scoreVal = summary.average_score !== null && summary.average_score !== undefined ? Number(summary.average_score) : null;
  const scoreTier = scoreVal !== null ? getScoreTier(scoreVal) : null;

  const statCards = [
    { label: 'Total Submissions', value: summary.total_submissions ?? 0, accent: 'bg-blue-50 text-blue-600', icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" /></svg> },
    { label: 'Graded', value: summary.graded_submissions ?? 0, accent: 'bg-emerald-50 text-emerald-600', icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg> },
    { label: 'Pending', value: summary.pending_submissions ?? 0, accent: 'bg-amber-50 text-amber-600', icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" /></svg> },
    { label: 'Average Score', value: scoreVal !== null ? `${scoreVal.toFixed(1)}%` : 'N/A', accent: `${scoreTier ? scoreTier.bg + ' ' + scoreTier.text : 'bg-violet-50 text-violet-600'}`, icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.783.783 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2z" clipRule="evenodd" /></svg> },
    { label: 'Highest Score', value: summary.highest_score !== null && summary.highest_score !== undefined ? `${Number(summary.highest_score).toFixed(1)}%` : 'N/A', accent: 'bg-cyan-50 text-cyan-600', icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102 1.106 4.637c.194.813.691 1.456 1.405 1.705a.75.75 0 01-.176 1.395l-3.83 2.716a.75.75 0 01-1.091-.243l-3.224-3.094-3.556 2.887a.75.75 0 01-1.045-.295l-1.29-4.495a.75.75 0 01.396-.953l4.265-.794a.75.75 0 01.686.227L6.5 13.09l3.63-2.993a.75.75 0 01.938 0l2.8 2.31 1.106-4.637a.75.75 0 01.536-1.65l4.753-.382 1.83-4.401z" clipRule="evenodd" /></svg> },
    { label: 'Lowest Score', value: summary.lowest_score !== null && summary.lowest_score !== undefined ? `${Number(summary.lowest_score).toFixed(1)}%` : 'N/A', accent: 'bg-rose-50 text-rose-600', icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102 1.106 4.637c.194.813.691 1.456 1.405 1.705a.75.75 0 01-.176 1.395l-3.83 2.716a.75.75 0 01-1.091-.243l-3.224-3.094-3.556 2.887a.75.75 0 01-1.045-.295l-1.29-4.495a.75.75 0 01.396-.953l4.265-.794a.75.75 0 01.686.227L6.5 13.09l3.63-2.993a.75.75 0 01.938 0l2.8 2.31 1.106-4.637a.75.75 0 01.536-1.65l4.753-.382 1.83-4.401z" clipRule="evenodd" /></svg> },
  ];

  const subjectChartData = useMemo(
    () => (report?.subjects ?? []).map((subject) => ({
      id: `subject-${subject.subject_id}`,
      label: subject.subject_name,
      typeLabel: 'Subject',
      score: subject.average_score,
      submissions: subject.submissions,
      graded: subject.graded,
      submissionsText: `${subject.submissions} submission(s)`,
    })),
    [report?.subjects]
  );

  const assessmentChartData = useMemo(
    () => (report?.assessments ?? []).map((assessment) => ({
      id: `assessment-${assessment.exercise_id}`,
      label: assessment.title,
      subtitle: assessment.subject_name,
      difficulty: String(assessment.difficulty || 'Medium'),
      typeLabel: 'Assessment',
      score: assessment.average_score,
      submissions: assessment.submissions,
      graded: assessment.graded,
      submissionsText: `${assessment.submissions} submission(s)`,
    })),
    [report?.assessments]
  );

  const activeChartData = activeChart === 'subjects' ? subjectChartData : assessmentChartData;
  const scoredChartData = activeChartData.filter((entry) => entry.score !== null && entry.score !== undefined);
  const topPerformer = scoredChartData.length > 0
    ? scoredChartData.reduce((best, entry) => (entry.score > best.score ? entry : best), scoredChartData[0])
    : null;
  const needsAttention = scoredChartData.length > 0
    ? scoredChartData.reduce((lowest, entry) => (entry.score < lowest.score ? entry : lowest), scoredChartData[0])
    : null;
  const assessmentGroups = useMemo(() => {
    const grouped = new Map(DIFFICULTY_ORDER.map((d) => [d, []]));
    assessmentChartData.forEach((entry) => {
      const key = grouped.has(entry.difficulty) ? entry.difficulty : 'Medium';
      grouped.get(key).push(entry);
    });
    return DIFFICULTY_ORDER.map((d) => ({ difficulty: d, entries: grouped.get(d) ?? [] })).filter((g) => g.entries.length > 0);
  }, [assessmentChartData]);
  const difficultyOptions = useMemo(() => ['All', ...assessmentGroups.map((g) => g.difficulty)], [assessmentGroups]);
  const visibleAssessmentGroups = useMemo(() => selectedDifficulty === 'All' ? assessmentGroups : assessmentGroups.filter((g) => g.difficulty === selectedDifficulty), [assessmentGroups, selectedDifficulty]);
  const visibleEntries = activeChart === 'assessments' ? visibleAssessmentGroups.flatMap((g) => g.entries) : activeChartData;
  const chartSummary = useMemo(() => {
    const scoredEntries = visibleEntries.filter((e) => e.score !== null && e.score !== undefined);
    return {
      visibleCount: visibleEntries.length,
      average: scoredEntries.length > 0
        ? `${(scoredEntries.reduce((t, e) => t + Number(e.score || 0), 0) / scoredEntries.length).toFixed(1)}%`
        : 'N/A',
    };
  }, [visibleEntries]);

  useEffect(() => {
    if (activeChart !== 'assessments') return;
    setSelectedDifficulty((current) => {
      const stillValid = difficultyOptions.includes(current);
      return stillValid ? current : 'All';
    });
  }, [activeChart, difficultyOptions]);

  return (
    <div className="h-full min-h-0 overflow-y-auto teacher-scrollbar px-1 pt-3 sm:px-2">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="shrink-0 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-4 py-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-white">Reports & Analytics</h2>
              </div>
              <p className="text-xs text-blue-100 ml-[42px]">Performance insights across subjects and assessments.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {loading ? 'Updating...' : 'Live Snapshot'}
            </div>
          </div>
        </motion.div>

        {errorMessage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-sm font-semibold text-rose-700">{errorMessage}</p>
          </motion.div>
        )}

        {!loading && summary.total_submissions > 0 && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Grading Progress</p>
              <p className="text-sm font-black text-slate-800">{gradedRatio}%</p>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                initial={prefersReducedMotion ? false : { width: 0 }}
                animate={{ width: `${gradedRatio}%` }}
                transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
              <span>{summary.graded_submissions ?? 0} graded</span>
              <span>{summary.pending_submissions ?? 0} pending</span>
            </div>
          </motion.div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {statCards.map((card, index) => (
            <StatCard key={card.label} {...card} index={index} prefersReducedMotion={prefersReducedMotion} />
          ))}
        </div>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                {['subjects', 'assessments'].map((chart) => (
                  <button
                    key={chart}
                    type="button"
                    onClick={() => setActiveChart(chart)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-all duration-200 ${activeChart === chart
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {chart}
                  </button>
                ))}
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {activeChart === 'subjects' ? 'Subject Performance' : 'Assessment Performance'}
                </p>
                <p className="text-xs text-slate-500">
                  {activeChart === 'subjects'
                    ? 'Average score and grading progress per subject.'
                    : 'Average score and grading progress for each assessment.'}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:w-[380px]">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Visible</p>
                <p className="mt-1 text-xl font-black text-slate-900">{chartSummary.visibleCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Visible Avg</p>
                <p className="mt-1 text-xl font-black text-blue-700">{chartSummary.average}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-700">Top Performer</p>
                <p className="mt-1 text-xs font-semibold text-slate-900 truncate">{topPerformer?.label ?? 'No scored data yet'}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">Needs Attention</p>
                <p className="mt-1 text-xs font-semibold text-slate-900 truncate">{needsAttention?.label ?? 'No scored data yet'}</p>
              </div>
            </div>
          </div>

          {activeChart === 'assessments' && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Difficulty</p>
              <div className="flex flex-wrap gap-1">
                {difficultyOptions.map((difficulty) => (
                  <button
                    key={difficulty}
                    type="button"
                    onClick={() => setSelectedDifficulty(difficulty)}
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${selectedDifficulty === difficulty
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {!loading && visibleEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-slate-400">
                    <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-slate-600">No data yet</h4>
                <p className="mt-1 max-w-xs mx-auto text-xs text-slate-400">
                  {activeChart === 'subjects'
                    ? 'Create subjects and receive submissions to see analytics.'
                    : 'Create assessments and receive submissions to see analytics.'}
                </p>
              </div>
            ) : (
              (activeChart === 'assessments' ? visibleAssessmentGroups : [{ difficulty: '', entries: activeChartData }]).map((group) => (
                <div key={group.difficulty || 'all'} className="space-y-3">
                  {group.difficulty && (
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                        group.difficulty === 'Easy' ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : group.difficulty === 'Hard' ? 'bg-rose-50 text-rose-600 border-rose-200'
                            : 'bg-amber-50 text-amber-600 border-amber-200'
                      }`}>
                        {group.difficulty}
                      </span>
                      <span className="text-[10px] text-slate-400">{group.entries.length} assessment{group.entries.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {group.entries.map((entry, i) => (
                    <ProgressBar
                      key={entry.id}
                      score={entry.score}
                      submissions={entry.submissions}
                      graded={entry.graded}
                      label={entry.label}
                      isHovered={hoveredId === entry.id}
                      onHover={() => setHoveredId(entry.id)}
                      onLeave={() => setHoveredId(null)}
                      index={i}
                      prefersReducedMotion={prefersReducedMotion}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TeacherReports;
