import React, { useEffect, useMemo, useState } from 'react';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];

const clampScore = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 0;
  }

  return Math.max(0, Math.min(100, Number(value)));
};

const TeacherReports = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = storedTeacher?.user_id ?? storedTeacher?.teacher_id ?? storedTeacher?.id ?? null;

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeChart, setActiveChart] = useState('subjects');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadReport = async () => {
      if (!teacherId) {
        if (isMounted) {
          setLoading(false);
          setErrorMessage('Log in as a teacher to view reports.');
        }
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(`${API_BASE_URL}/get_teacher_reports.php?teacher_id=${teacherId}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'Unable to load reports.');
        }
        if (isMounted) {
          setReport(payload.report);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        if (isMounted) {
          setReport(null);
          setErrorMessage(error.message || 'Unable to load reports.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadReport();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [teacherId]);

  const summary = report?.summary ?? {};

  const statCards = [
    { label: 'Total Submissions', value: summary.total_submissions ?? 0, accent: 'bg-blue-50 text-blue-700' },
    { label: 'Graded', value: summary.graded_submissions ?? 0, accent: 'bg-emerald-50 text-emerald-700' },
    { label: 'Pending', value: summary.pending_submissions ?? 0, accent: 'bg-amber-50 text-amber-700' },
    { label: 'Average Score', value: summary.average_score !== null && summary.average_score !== undefined ? `${summary.average_score}%` : 'N/A', accent: 'bg-violet-50 text-violet-700' },
    { label: 'Highest Score', value: summary.highest_score !== null && summary.highest_score !== undefined ? `${summary.highest_score}%` : 'N/A', accent: 'bg-cyan-50 text-cyan-700' },
    { label: 'Lowest Score', value: summary.lowest_score !== null && summary.lowest_score !== undefined ? `${summary.lowest_score}%` : 'N/A', accent: 'bg-rose-50 text-rose-700' },
  ];

  const subjectChartData = useMemo(
    () =>
      (report?.subjects ?? []).map((subject) => ({
        id: `subject-${subject.subject_id}`,
        label: subject.subject_name,
        typeLabel: 'Subject',
        score: subject.average_score,
        scoreText: subject.average_score !== null ? `${subject.average_score}% avg` : 'No score yet',
        submissionsText: `${subject.submissions} submission(s)`,
        metaPills: [
          `${subject.graded} graded`,
          subject.submissions > 0 ? `${Math.round((subject.graded / subject.submissions) * 100)}% completed` : 'No submissions yet',
        ],
      })),
    [report?.subjects]
  );

  const assessmentChartData = useMemo(
    () =>
      (report?.assessments ?? []).map((assessment) => ({
        id: `assessment-${assessment.exercise_id}`,
        label: assessment.title,
        subtitle: assessment.subject_name,
        difficulty: String(assessment.difficulty || 'Medium'),
        typeLabel: 'Assessment',
        score: assessment.average_score,
        scoreText: assessment.average_score !== null ? `${assessment.average_score}% avg` : 'No score yet',
        submissionsText: `${assessment.submissions} submission(s)`,
        metaPills: [
          `${assessment.graded} graded`,
          assessment.average_score !== null ? `${assessment.average_score}% average` : 'No score yet',
        ],
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
    const grouped = new Map(DIFFICULTY_ORDER.map((difficulty) => [difficulty, []]));

    assessmentChartData.forEach((entry) => {
      const key = grouped.has(entry.difficulty) ? entry.difficulty : 'Medium';
      grouped.get(key).push(entry);
    });

    return DIFFICULTY_ORDER
      .map((difficulty) => ({
        difficulty,
        entries: grouped.get(difficulty) ?? [],
      }))
      .filter((group) => group.entries.length > 0);
  }, [assessmentChartData]);
  const difficultyOptions = useMemo(
    () => ['All', ...assessmentGroups.map((group) => group.difficulty)],
    [assessmentGroups]
  );
  const visibleAssessmentGroups = useMemo(() => {
    if (selectedDifficulty === 'All') {
      return assessmentGroups;
    }

    return assessmentGroups.filter((group) => group.difficulty === selectedDifficulty);
  }, [assessmentGroups, selectedDifficulty]);
  const visibleEntries = activeChart === 'assessments'
    ? visibleAssessmentGroups.flatMap((group) => group.entries)
    : activeChartData;
  const chartSummary = useMemo(() => {
    const scoredEntries = visibleEntries.filter((entry) => entry.score !== null && entry.score !== undefined);

    return {
      visibleCount: visibleEntries.length,
      average:
        scoredEntries.length > 0
          ? `${Math.round(scoredEntries.reduce((total, entry) => total + Number(entry.score || 0), 0) / scoredEntries.length)}%`
          : 'N/A',
    };
  }, [visibleEntries]);

  useEffect(() => {
    if (activeChart !== 'assessments') {
      return;
    }

    setSelectedDifficulty((current) => {
      const stillValid = difficultyOptions.includes(current);
      return stillValid ? current : 'All';
    });
  }, [activeChart, difficultyOptions]);

  return (
    <div className="h-full min-h-0 overflow-y-auto teacher-scrollbar px-4 py-3 md:px-6 md:py-4">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="teacher-eyebrow">Reports</p>
            <h1 className="teacher-heading">View Reports</h1>
            <p className="text-sm text-slate-500">
              Track grading activity by subject and by assessment once scores are saved from the grading queue.
            </p>
          </div>
          <div className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {loading ? 'Updating...' : 'Report Snapshot Ready'}
          </div>
        </div>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {statCards.map((card) => (
            <div key={card.label} className="teacher-list-card p-3">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${card.accent}`}>
                {card.label}
              </span>
              <p className="mt-2 text-2xl font-black text-slate-900">{loading ? '...' : card.value}</p>
            </div>
          ))}
        </div>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setActiveChart('subjects')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeChart === 'subjects'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                  Subjects
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChart('assessments')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeChart === 'assessments'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                  Assessments
                </button>
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
              <div className="rounded-[1.15rem] border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Visible</p>
                <p className="mt-1 text-xl font-black text-slate-900">{chartSummary.visibleCount}</p>
              </div>
              <div className="rounded-[1.15rem] border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Visible Avg</p>
                <p className="mt-1 text-xl font-black text-blue-700">{chartSummary.average}</p>
              </div>
              <div className="rounded-[1.15rem] border border-emerald-200 bg-emerald-50/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-700">Top</p>
                <p className="mt-1 text-xs font-semibold text-slate-900">{topPerformer?.label ?? 'No scored data yet'}</p>
              </div>
              <div className="rounded-[1.15rem] border border-amber-200 bg-amber-50/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">Needs Attention</p>
                <p className="mt-1 text-xs font-semibold text-slate-900">{needsAttention?.label ?? 'No scored data yet'}</p>
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

          <div className="rounded-[1.15rem] border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <div className="hidden grid-cols-[160px,minmax(0,1fr)] gap-4 border-b border-slate-100 px-2 pb-2 text-[10px] font-semibold text-slate-400 md:grid">
              <div />
              <div className="grid grid-cols-5">
                <span className="text-left">0</span>
                <span className="text-center">25</span>
                <span className="text-center">50</span>
                <span className="text-center">75</span>
                <span className="text-right">100</span>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <div className="min-w-[600px] space-y-3 pb-4">
                {!loading && activeChartData.length === 0 ? (
                  <div className="rounded-[1rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    No {activeChart} report data yet.
                  </div>
                ) : (
                  (activeChart === 'assessments' ? visibleAssessmentGroups : [{ difficulty: '', entries: activeChartData }]).map((group) => (
                    <div key={group.difficulty || 'all'} className="space-y-2">
                      {group.entries.map((entry) => {
                        const score = clampScore(entry.score);
                        return (
                          <div key={entry.id} className="grid gap-2 rounded-[1rem] border border-slate-100 bg-slate-50/70 p-2.5 md:grid-cols-[160px,minmax(0,1fr)] md:gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-500">
                                {entry.typeLabel}
                              </p>
                              <p className="mt-0.5 text-sm font-bold leading-snug text-slate-900">
                                {entry.label}
                              </p>
                              <p className="text-xs text-slate-500">
                                {entry.submissionsText}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <div className="h-8 overflow-hidden rounded-[0.85rem] bg-slate-100">
                                <div
                                  className="flex h-full min-w-[4rem] items-center rounded-[0.85rem] bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 px-2.5 shadow-[0_8px_16px_rgba(59,130,246,0.15)]"
                                  style={{ width: `${score}%` }}
                                >
                                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-800 shadow-sm">
                                    {entry.scoreText}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1">
                                {entry.metaPills.map((pill) => (
                                  <span
                                    key={`${entry.id}-${pill}`}
                                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                                  >
                                    {pill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}

                {!loading && activeChart === 'assessments' && visibleAssessmentGroups.length === 0 && (
                  <div className="rounded-[1.3rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No assessments found for the selected difficulty.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TeacherReports;
