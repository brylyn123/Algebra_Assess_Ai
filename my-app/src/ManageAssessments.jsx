import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTeacherRecords } from './hooks/useTeacherRecords';
import { getSubjectThemeByName } from './subjectCardThemes';
import { API_BASE_URL } from './apiBase';
import MathText from './MathText';

const formatDate = (value) => {
    if (!value) return 'Not dated yet';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const ManageAssessments = () => {
    const navigate = useNavigate();
    const prefersReducedMotion = useReducedMotion();
    const { assessments, rubrics, loading, statusMessage } = useTeacherRecords();
    const [activePanel, setActivePanel] = useState('assessments');
    const [assessmentFilter, setAssessmentFilter] = useState('all');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyPanel, setHistoryPanel] = useState('assessments');
    const [showAssessmentDetail, setShowAssessmentDetail] = useState(false);
    const [selectedAssessmentDetail, setSelectedAssessmentDetail] = useState(null);
    const [detailTab, setDetailTab] = useState('questions');
    const [trackerData, setTrackerData] = useState(null);
    const [trackerLoading, setTrackerLoading] = useState(false);
    const [trackerError, setTrackerError] = useState('');
    const [trackerCache, setTrackerCache] = useState({});

    const formatDateTime = (value) => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getDueDateStatus = (dueDate) => {
        if (!dueDate) return null;
        const now = new Date();
        const due = new Date(dueDate);
        if (Number.isNaN(due.getTime())) return null;
        const diffMs = due.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: 'Overdue', color: 'bg-red-50 text-red-700 border-red-200' };
        if (diffDays === 0) return { label: 'Due Today', color: 'bg-amber-50 text-amber-700 border-amber-200' };
        if (diffDays <= 3) return { label: `Due in ${diffDays}d`, color: 'bg-orange-50 text-orange-700 border-orange-200' };
        return { label: `Due in ${diffDays}d`, color: 'bg-blue-50 text-blue-700 border-blue-200' };
    };

    const formatLevelLabel = (level) => {
        const label = String(level?.label ?? '').trim();
        const points = Number(level?.points ?? 0);
        return label ? `${label} - ${points} pts` : `${points} pts`;
    };

    const fetchTrackerData = useCallback(async (exerciseId) => {
        if (!exerciseId) return;
        setTrackerLoading(true);
        setTrackerError('');
        try {
            const response = await fetch(`${API_BASE_URL}/get_assessment_submission_tracker.php?exercise_id=${exerciseId}`, {
                credentials: 'include',
            });
            const text = await response.text();
            let payload;
            try { payload = JSON.parse(text); } catch { throw new Error('Invalid server response.'); }
            if (!response.ok || payload.status !== 'success' || !Array.isArray(payload.students)) {
                throw new Error(payload.message || 'Unable to load tracker data.');
            }
            setTrackerCache((prev) => ({ ...prev, [exerciseId]: payload }));
            setTrackerData(payload);
        } catch (err) {
            setTrackerError(err.message || 'Failed to load submission tracker.');
        } finally {
            setTrackerLoading(false);
        }
    }, []);

    useEffect(() => {
        setDetailTab('questions');
        setTrackerData(null);
        setTrackerError('');
        setTrackerLoading(false);
    }, [showAssessmentDetail]);

    useEffect(() => {
        if (!showAssessmentDetail) return;
        const cached = trackerCache[selectedAssessmentDetail?.exercise_id];
        if (cached) {
            setTrackerData(cached);
        } else {
            setTrackerData(null);
        }
        setTrackerError('');
        setTrackerLoading(false);
    }, [selectedAssessmentDetail?.exercise_id, showAssessmentDetail]);

    useEffect(() => {
        if (detailTab === 'tracker' && selectedAssessmentDetail && showAssessmentDetail) {
            const cached = trackerCache[selectedAssessmentDetail.exercise_id];
            if (cached) {
                setTrackerData(cached);
            } else {
                fetchTrackerData(selectedAssessmentDetail.exercise_id);
            }
        }
    }, [detailTab, selectedAssessmentDetail?.exercise_id, showAssessmentDetail]);

    const filteredAssessments = useMemo(() => {
        return assessments.filter((item) => {
            const statusValue = String(item.assessment_status || item.status || 'Draft').toLowerCase();
            if (assessmentFilter === 'pending') {
                return statusValue !== 'graded';
            }
            if (assessmentFilter === 'graded') {
                return statusValue === 'graded';
            }
            return true;
        });
    }, [assessments, assessmentFilter]);

    const getStatusClasses = (statusValue) => {
        const lower = String(statusValue).toLowerCase();
        if (lower === 'graded') return { accent: 'from-emerald-400 to-emerald-600', badge: 'bg-emerald-50 text-emerald-700', avatar: 'from-emerald-400 to-emerald-500' };
        if (lower === 'pending') return { accent: 'from-amber-400 to-amber-600', badge: 'bg-amber-50 text-amber-700', avatar: 'from-amber-400 to-amber-500' };
        return { accent: 'from-blue-400 to-blue-600', badge: 'bg-blue-50 text-blue-700', avatar: 'from-blue-400 to-blue-500' };
    };

    const actionCards = [
        {
            title: 'New Assessment',
            description: 'Create a quiz, homework task, or exam with a clean guided flow.',
            tone: 'bg-[linear-gradient(135deg,rgba(96,165,250,0.95),rgba(37,99,235,0.96))] text-white shadow-[0_24px_60px_rgba(59,130,246,0.18)]',
            buttonLabel: 'Create Assessment',
            buttonClass: 'text-blue-700',
            copyClass: 'text-white/85',
            icon: (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                    <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM9 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9z" clipRule="evenodd" />
                </svg>
            ),
            onClick: () => navigate('/teacher/assessments/new'),
        },
        {
            title: 'New Rubric',
            description: 'Build a grading rubric with point levels and AI instructions.',
            tone: 'bg-[linear-gradient(135deg,rgba(52,211,153,0.95),rgba(5,150,105,0.96))] text-white shadow-[0_24px_60px_rgba(16,185,129,0.16)]',
            buttonLabel: 'Create Rubric',
            buttonClass: 'text-emerald-700',
            copyClass: 'text-white/85',
            icon: (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                    <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                </svg>
            ),
            onClick: () => navigate('/teacher/assessments/new-rubric'),
        },
    ];

    return (
        <div className="mx-auto w-full max-w-[1400px] px-4 pt-3 sm:px-6 md:px-8" style={{ height: 'calc(100vh - 6rem)' }}>
            <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)]">

                <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-6 py-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-600 shadow-sm shadow-blue-200">
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                                        <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM9 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold tracking-tight text-slate-900">Assessments</h2>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 ml-10">Create and manage your quizzes, exams, and rubrics.</p>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="inline-flex w-full max-w-[320px] rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                            <button
                                type="button"
                                onClick={() => setActivePanel('assessments')}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${activePanel === 'assessments'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200/60'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                    }`}
                            >
                                <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-bold ${activePanel === 'assessments' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {assessments.length}
                                </span>
                                Assessments
                            </button>
                            <button
                                type="button"
                                onClick={() => setActivePanel('rubrics')}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${activePanel === 'rubrics'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200/60'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                    }`}
                            >
                                <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-bold ${activePanel === 'rubrics' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {rubrics.length}
                                </span>
                                Rubrics
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {activePanel === 'assessments' && (
                                <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                                    {['all', 'pending', 'graded'].map((filter) => (
                                        <button
                                            key={filter}
                                            type="button"
                                            onClick={() => setAssessmentFilter(filter)}
                                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize transition ${assessmentFilter === filter
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                : 'text-slate-500 hover:text-slate-900'
                                                }`}
                                        >
                                            {filter}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowHistoryModal(true)}
                                className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                            >
                                View All
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 min-h-0 flex-col">
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                        <style>{`
                            .assess-scroll::-webkit-scrollbar { width: 6px; }
                            .assess-scroll::-webkit-scrollbar-track { background: transparent; }
                            .assess-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 9999px; }
                            .assess-scroll::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
                        `}</style>
                        <div className="space-y-4">
                            {statusMessage && !loading ? (
                                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-rose-500">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-rose-800">Unable to load data</p>
                                        <p className="mt-0.5 text-xs text-rose-600">{statusMessage}</p>
                                    </div>
                                </div>
                            ) : activePanel === 'assessments' ? (
                                <>
                                    {/* Quick Actions - Compact horizontal row */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {actionCards.map((card, index) => (
                                            <motion.article
                                                key={card.title}
                                                initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                                                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                                                transition={{ duration: 0.28, delay: index * 0.06, ease: 'easeOut' }}
                                                whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                                                className={`relative overflow-hidden rounded-xl ${card.tone} p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                                                        {card.icon}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h2 className="text-sm font-bold leading-tight tracking-tight text-inherit">
                                                            {card.title}
                                                        </h2>
                                                        <p className={`text-[10px] leading-4 ${card.copyClass}`}>
                                                            {card.description}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={card.onClick}
                                                        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] shadow-md transition hover:-translate-y-0.5 ${card.buttonClass}`}
                                                    >
                                                        {card.buttonLabel}
                                                    </button>
                                                </div>
                                            </motion.article>
                                        ))}
                                    </div>

                                    {/* Section header */}
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Your Assessments</p>
                                        <p className="text-[10px] text-slate-400">{filteredAssessments.length} total</p>
                                    </div>

                                    {/* Assessment cards grid */}
                                    {filteredAssessments.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
                                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-blue-400">
                                                    <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM9 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-700">No assessments yet</h4>
                                            <p className="mt-1 max-w-xs text-xs text-slate-400">
                                                {assessmentFilter !== 'all'
                                                    ? 'No assessments match this filter. Try a different filter or create a new assessment.'
                                                    : 'Create your first assessment to get started.'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {filteredAssessments.map((item) => {
                                                const statusValue = String(item.assessment_status || item.status || 'Draft');
                                                const statusBadge = getStatusClasses(statusValue);
                                                const subjectTheme = getSubjectThemeByName(item.subject || item.subject_name);
                                                return (
                                                    <div
                                                        key={item.exercise_id}
                                                        onClick={() => {
                                                            setSelectedAssessmentDetail(item);
                                                            setShowAssessmentDetail(true);
                                                        }}
                                                        className={`group relative overflow-hidden rounded-[1.1rem] border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer flex flex-col min-h-[180px] ${subjectTheme.cardClass}`}
                                                    >
                                                        <div className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${subjectTheme.accentClass}`} />
                                                        <div className="flex flex-1 flex-col gap-2.5 p-4 pl-5">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${subjectTheme.cardBadgeClass} text-xs font-bold`}>
                                                                    {item.title?.charAt(0)?.toUpperCase() || 'A'}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <h3 className={`text-sm font-bold truncate ${subjectTheme.cardTextClass}`}>{item.title}</h3>
                                                                        <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusBadge.badge}`}>
                                                                            {statusValue}
                                                                        </span>
                                                                    </div>
                                                                    <p className={`mt-0.5 text-[11px] truncate ${subjectTheme.cardSubtextClass}`}>{item.subject || 'No subject yet'}</p>
                                                                </div>
                                                            </div>
                                                            {item.description && (
                                                                <p className={`text-[10px] leading-4 line-clamp-2 ${subjectTheme.cardSubtextClass}`}>{item.description}</p>
                                                            )}
                                                            <div className="mt-auto flex flex-wrap gap-1">
                                                                <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${subjectTheme.chipClass}`}>
                                                                    {item.topic || 'No topic'}
                                                                </span>
                                                                <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${subjectTheme.chipClass}`}>
                                                                    {item.difficulty || 'Medium'}
                                                                </span>
                                                                <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${subjectTheme.chipClass}`}>
                                                                    {item.item_count ?? item.items?.length ?? 0} items
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Section header */}
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Your Rubrics</p>
                                        <p className="text-[10px] text-slate-400">{rubrics.length} total</p>
                                    </div>

                                    {rubrics.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
                                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-emerald-400">
                                                    <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-700">No rubrics yet</h4>
                                            <p className="mt-1 max-w-xs text-xs text-slate-400">Create your first rubric to get started.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {rubrics.map((rubric) => (
                                                <div
                                                    key={rubric.rubric_set_id}
                                                    className="group relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex flex-col min-h-[180px]"
                                                >
                                                    <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-teal-600" />
                                                    <div className="flex flex-1 flex-col gap-2.5 p-4 pl-5">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 text-xs font-bold">
                                                                {rubric.rubric_name?.charAt(0)?.toUpperCase() || 'R'}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <h3 className="text-sm font-bold text-slate-900 truncate">{rubric.rubric_name}</h3>
                                                                    <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-700">
                                                                        Criteria
                                                                    </span>
                                                                </div>
                                                                <p className="mt-0.5 text-[11px] text-emerald-600/80">{formatDate(rubric.created_at)}</p>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] leading-4 text-slate-600 line-clamp-2">
                                                            {rubric.criteria || 'No criteria added yet.'}
                                                        </p>
                                                        {rubric.ai_instructions && (
                                                            <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-2 py-1.5">
                                                                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-blue-600">AI Instructions</p>
                                                                <p className="mt-0.5 text-[9px] leading-4 text-slate-600 line-clamp-2">{rubric.ai_instructions}</p>
                                                            </div>
                                                        )}
                                                        {Array.isArray(rubric.level_definitions) && rubric.level_definitions.length > 0 && (
                                                            <div className="mt-auto flex flex-wrap gap-1">
                                                                {rubric.level_definitions.map((level, index) => (
                                                                    <span
                                                                        key={`${rubric.rubric_set_id}-level-${index}`}
                                                                        className="rounded-full border border-emerald-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700"
                                                                    >
                                                                        {formatLevelLabel(level)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {showHistoryModal &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
                        onClick={() => setShowHistoryModal(false)}
                    >
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-3xl max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.28)]">

                            <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-8 pb-6 pt-7">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/90">History</span>
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">Assessments & Rubrics</h3>
                                        <p className="text-sm text-blue-100/80">Review everything you have created from one panel.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowHistoryModal(false)}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
                                    >
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-1 min-h-0 flex-col overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                                <div className="px-8 py-4">
                                    <div className="mb-4 inline-flex max-w-[320px] rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                                        <button
                                            type="button"
                                            onClick={() => setHistoryPanel('assessments')}
                                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${historyPanel === 'assessments'
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200/60'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                                }`}
                                        >
                                            <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-bold ${historyPanel === 'assessments' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                {assessments.length}
                                            </span>
                                            Assessments
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHistoryPanel('rubrics')}
                                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${historyPanel === 'rubrics'
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200/60'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                                }`}
                                        >
                                            <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-bold ${historyPanel === 'rubrics' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                {rubrics.length}
                                            </span>
                                            Rubrics
                                        </button>
                                    </div>

                                    {historyPanel === 'assessments' ? (
                                        <div className="space-y-3">
                                            {assessments.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-blue-400">
                                                            <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM9 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-600">No assessments yet</h4>
                                                    <p className="mt-1 max-w-xs text-xs text-slate-400">Create your first assessment to see it here.</p>
                                                </div>
                                            ) : (
                                                assessments.map((item) => {
                                                    const statusValue = String(item.assessment_status || item.status || 'Draft');
                                                    const statusBadge = getStatusClasses(statusValue);
                                                    const subjectTheme = getSubjectThemeByName(item.subject || item.subject_name);
                                                    return (
                                                        <div
                                                            key={item.exercise_id}
                                                            onClick={() => {
                                                                setSelectedAssessmentDetail(item);
                                                                setShowAssessmentDetail(true);
                                                            }}
                                                            className={`group relative overflow-hidden rounded-[1.1rem] border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer ${subjectTheme.cardClass}`}
                                                        >
                                                            <div className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${subjectTheme.accentClass}`} />
                                                            <div className="flex flex-col gap-3 p-4 pl-5">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                                                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${subjectTheme.cardBadgeClass} text-sm font-bold`}>
                                                                            {item.title?.charAt(0)?.toUpperCase() || 'A'}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <h3 className={`text-sm font-bold truncate ${subjectTheme.cardTextClass}`}>{item.title}</h3>
                                                                                <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusBadge.badge}`}>
                                                                                    {statusValue}
                                                                                </span>
                                                                            </div>
                                                                            <p className={`mt-0.5 text-xs truncate ${subjectTheme.cardSubtextClass}`}>{item.subject || 'Assessment'}</p>
                                                                            <p className={`mt-1 text-[10px] leading-5 line-clamp-2 ${subjectTheme.cardSubtextClass}`}>
                                                                                {item.description || 'No description provided yet.'}
                                                                            </p>
                                                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${subjectTheme.chipClass}`}>
                                                                                    {item.topic || 'No topic'} &middot; {item.difficulty || 'Medium'}
                                                                                </span>
                                                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${subjectTheme.chipClass}`}>
                                                                                    {item.item_count ?? item.items?.length ?? 0} items
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {rubrics.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-emerald-400">
                                                            <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-600">No rubrics yet</h4>
                                                    <p className="mt-1 max-w-xs text-xs text-slate-400">Create your first rubric to see it here.</p>
                                                </div>
                                            ) : (
                                                rubrics.map((rubric) => (
                                                    <div
                                                        key={rubric.rubric_set_id}
                                                        className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/50"
                                                    >
                                                        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-teal-600" />
                                                        <div className="flex flex-col gap-3 p-4 pl-5">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
                                                                        {rubric.rubric_name?.charAt(0)?.toUpperCase() || 'R'}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <h3 className="text-sm font-bold text-slate-900 truncate">{rubric.rubric_name}</h3>
                                                                            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                                                                                Criteria
                                                                            </span>
                                                                        </div>
                                                                        <p className="mt-0.5 text-xs text-slate-500">{formatDate(rubric.created_at)}</p>
                                                                        <p className="mt-1 text-xs leading-5 text-slate-600">
                                                                            {rubric.criteria || 'No criteria added yet.'}
                                                                        </p>
                                                                        {rubric.ai_instructions && (
                                                                            <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/70 px-2.5 py-2">
                                                                                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-blue-600">AI Instructions</p>
                                                                                <p className="mt-1 text-xs leading-5 text-slate-600">{rubric.ai_instructions}</p>
                                                                            </div>
                                                                        )}
                                                                        {Array.isArray(rubric.level_definitions) && rubric.level_definitions.length > 0 && (
                                                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                                                {rubric.level_definitions.map((level, index) => (
                                                                                    <span
                                                                                        key={`${rubric.rubric_set_id}-modal-level-${index}`}
                                                                                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                                                                                    >
                                                                                        {formatLevelLabel(level)}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            {showAssessmentDetail && selectedAssessmentDetail &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
                        onClick={() => setShowAssessmentDetail(false)}
                    >
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-3xl max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.28)]">

                            <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-8 pb-6 pt-7">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/90">
                                                {selectedAssessmentDetail.subject || 'Assessment'}
                                            </span>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                                String(selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || 'Draft').toLowerCase() === 'graded'
                                                    ? 'bg-emerald-400/20 text-emerald-100'
                                                    : String(selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || 'Draft').toLowerCase() === 'pending'
                                                        ? 'bg-amber-400/20 text-amber-100'
                                                        : 'bg-blue-300/20 text-blue-100'
                                            }`}>
                                                {selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || 'Draft'}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">{selectedAssessmentDetail.title}</h3>
                                        {selectedAssessmentDetail.description && (
                                            <p className="max-w-lg text-sm text-blue-100/80 line-clamp-2">{selectedAssessmentDetail.description}</p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowAssessmentDetail(false)}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
                                    >
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-1 min-h-0 flex-col overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                                <div className="px-8 py-6">
                                    <div className="mb-6 grid grid-cols-3 gap-3">
                                        <div className="rounded-2xl border-l-[3px] border-l-blue-300 bg-blue-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500">Questions</p>
                                            <p className="mt-1 text-3xl font-black text-blue-600">{selectedAssessmentDetail.items?.length ?? 0}</p>
                                            <p className="mt-0.5 text-[11px] font-medium text-blue-400">Total items</p>
                                        </div>
                                        <div className="rounded-2xl border-l-[3px] border-l-amber-300 bg-amber-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Total Points</p>
                                            <p className="mt-1 text-3xl font-black text-amber-600">
                                                {(selectedAssessmentDetail.items || []).reduce((sum, item) => sum + (item.max_score ?? 0), 0)}
                                            </p>
                                            <p className="mt-0.5 text-[11px] font-medium text-amber-400">Maximum score</p>
                                        </div>
                                        <div className="rounded-2xl border-l-[3px] border-l-emerald-300 bg-emerald-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Due Date</p>
                                            <p className="mt-1 text-3xl font-black text-emerald-600">
                                                {(() => {
                                                    const due = getDueDateStatus(selectedAssessmentDetail.due_date);
                                                    return due ? due.label : 'None';
                                                })()}
                                            </p>
                                            <p className="mt-0.5 text-[11px] font-medium text-emerald-400">Deadline status</p>
                                        </div>
                                    </div>

                                    <div className="mb-6 flex flex-wrap gap-1.5">
                                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-slate-400">
                                                <path d="M2 4.5A2.5 2.5 0 014.5 2h7A2.5 2.5 0 0114 4.5v7a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 012 11.5v-7z" />
                                            </svg>
                                            {selectedAssessmentDetail.topic || 'No topic'}
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            {selectedAssessmentDetail.difficulty || 'Medium'}
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            {selectedAssessmentDetail.item_count ?? selectedAssessmentDetail.items?.length ?? 0} items
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            Created {formatDate(selectedAssessmentDetail.date_created)}
                                        </span>
                                        {selectedAssessmentDetail.due_date && (() => {
                                            const due = getDueDateStatus(selectedAssessmentDetail.due_date);
                                            if (!due) return null;
                                            return (
                                                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-semibold ${due.color}`}>
                                                    {due.label}
                                                </span>
                                            );
                                        })()}
                                    </div>

                                    {selectedAssessmentDetail.subject_meta && (
                                        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">Subject Meta</p>
                                            <p className="mt-0.5 text-xs text-slate-600">{selectedAssessmentDetail.subject_meta}</p>
                                        </div>
                                    )}

                                    <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setDetailTab('questions')}
                                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${detailTab === 'questions'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                                                <path d="M2 4.5A2.5 2.5 0 014.5 2h7A2.5 2.5 0 0114 4.5v7a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 012 11.5v-7z" />
                                            </svg>
                                            Questions ({selectedAssessmentDetail.items?.length ?? 0})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDetailTab('tracker')}
                                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${detailTab === 'tracker'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                                                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                            </svg>
                                            Submission Tracker
                                        </button>
                                    </div>

                                    <AnimatePresence mode="wait">
                                    {detailTab === 'questions' && (
                                        <motion.div
                                            key="questions-content"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                                        >
                                        {(!selectedAssessmentDetail.items || selectedAssessmentDetail.items.length === 0) ? (
                                            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-blue-400">
                                                        <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <h4 className="text-sm font-bold text-slate-600">No questions yet</h4>
                                                <p className="mt-1 max-w-xs text-xs text-slate-400">This assessment has no items.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedAssessmentDetail.items.map((item, index) => (
                                                    <div
                                                        key={item.item_id ?? index}
                                                        className="group relative overflow-hidden rounded-xl border border-slate-100 bg-white p-4 transition-all duration-200 hover:border-slate-200 hover:shadow-sm"
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-[11px] font-bold text-blue-700">
                                                                    {item.item_no ?? index + 1}
                                                                </span>
                                                                <div>
                                                                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                                                        {item.question_type || 'Question'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                                                                {item.max_score ?? 0} pts
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-xs leading-6 text-slate-700">
                                                            <MathText text={item.question_content} />
                                                        </p>
                                                        {item.model_solution && (
                                                            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                                                                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-600">Model Solution</p>
                                                                <p className="mt-0.5 text-xs text-slate-700">{item.model_solution}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        </motion.div>
                                    )}

                                    {detailTab === 'tracker' && (
                                        <motion.div
                                            key="tracker-content"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                                            className="space-y-4"
                                        >
                                            {trackerLoading ? (
                                                <div className="flex items-center justify-center py-12">
                                                    <div className="relative">
                                                        <div className="h-8 w-8 rounded-full border-[3px] border-blue-200 border-t-blue-500 animate-spin" />
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                                        </div>
                                                    </div>
                                                    <span className="ml-3 text-sm font-medium text-slate-500">Loading tracker...</span>
                                                </div>
                                            ) : trackerError ? (
                                                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100">
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-rose-500">
                                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-rose-800">Error</p>
                                                        <p className="mt-0.5 text-xs text-rose-600">{trackerError}</p>
                                                    </div>
                                                </div>
                                            ) : trackerData ? (
                                                <>
                                                    <div className="rounded-2xl bg-slate-50 p-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex-1">
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Submission Progress</p>
                                                                <p className="mt-1 text-lg font-black text-slate-900">
                                                                    <span className="text-emerald-600">{trackerData.total_submitted}</span>
                                                                    <span className="text-slate-400"> / </span>
                                                                    {trackerData.total_enrolled}
                                                                    <span className="ml-1 text-sm font-medium text-slate-400">students</span>
                                                                </p>
                                                            </div>
                                                            <div className="h-14 w-14 shrink-0">
                                                                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                                                                    <circle cx="18" cy="18" r="15.91" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                                                                    <circle
                                                                        cx="18" cy="18" r="15.91" fill="none" stroke="#10b981" strokeWidth="3"
                                                                        strokeDasharray={`${trackerData.total_enrolled > 0 ? (trackerData.total_submitted / trackerData.total_enrolled) * 100 : 0} 100`}
                                                                        strokeLinecap="round"
                                                                    />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {trackerData.students.filter((s) => s.submitted).length > 0 && (
                                                        <div>
                                                            <div className="mb-2 flex items-center gap-2">
                                                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                                                                    Submitted ({trackerData.students.filter((s) => s.submitted).length})
                                                                </p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {trackerData.students.filter((s) => s.submitted).map((student) => {
                                                                    const stColor = String(student.status || '').toLowerCase() === 'graded'
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                        : String(student.status || '').toLowerCase() === 'needs review'
                                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                            : 'bg-amber-50 text-amber-700 border-amber-200';
                                                                    return (
                                                                        <div key={student.student_user_id} className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-white px-4 py-3 transition hover:shadow-sm">
                                                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 text-xs font-bold text-white">
                                                                                {(student.student_name || 'S').charAt(0).toUpperCase()}
                                                                            </div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="truncate text-sm font-semibold text-slate-900">{student.student_name}</p>
                                                                                <p className="text-[11px] text-slate-400">ID {student.student_id} {student.date_uploaded && `\u00B7 ${student.date_uploaded}`}</p>
                                                                            </div>
                                                                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${stColor}`}>
                                                                                {student.status || 'Submitted'}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {trackerData.students.filter((s) => !s.submitted).length > 0 && (
                                                        <div>
                                                            <div className="mb-2 flex items-center gap-2">
                                                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">
                                                                    Not Submitted ({trackerData.students.filter((s) => !s.submitted).length})
                                                                </p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {trackerData.students.filter((s) => !s.submitted).map((student) => (
                                                                    <div key={student.student_user_id} className="flex items-center gap-3 rounded-xl border border-amber-200/60 bg-white px-4 py-3 transition hover:shadow-sm">
                                                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-xs font-bold text-white">
                                                                            {(student.student_name || 'S').charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="truncate text-sm font-semibold text-slate-900">{student.student_name}</p>
                                                                            <p className="text-[11px] text-slate-400">ID {student.student_id}</p>
                                                                        </div>
                                                                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                                                                            No submission
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {trackerData.students.length === 0 && (
                                                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                                                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                                                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-slate-400">
                                                                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                                                </svg>
                                                            </div>
                                                            <h4 className="text-sm font-bold text-slate-600">No students enrolled</h4>
                                                            <p className="mt-1 max-w-xs text-xs text-slate-400">Enroll students in this subject to track their submissions.</p>
                                                        </div>
                                                    )}
                                                </>
                                            ) : null}
                                        </motion.div>
                                    )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-8 py-3">
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAssessmentDetail(false);
                                            navigate('/teacher/grade-submissions', { state: { exerciseId: selectedAssessmentDetail.exercise_id } });
                                        }}
                                        className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-300/50 active:scale-[0.97]"
                                    >
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                            <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
                                        </svg>
                                        View Submissions
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default ManageAssessments;
