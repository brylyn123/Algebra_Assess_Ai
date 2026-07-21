import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTeacherRecords } from './hooks/useTeacherRecords';

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

    const actionCards = [
        {
            title: 'New Assessment',
            description: 'Create a quiz, homework task, or exam with a clean guided flow.',
            tone:
                'bg-[linear-gradient(135deg,rgba(96,165,250,0.95),rgba(37,99,235,0.96))] text-white shadow-[0_24px_60px_rgba(59,130,246,0.18)]',
            buttonLabel: 'Create Assessment',
            buttonClass: 'text-blue-700',
            copyClass: 'text-white/85',
            onClick: () => navigate('/teacher/assessments/new'),
        },
        {
            title: 'New Rubric',
            description: 'Build a grading rubric with point levels and AI instructions.',
            tone:
                'bg-[linear-gradient(135deg,rgba(52,211,153,0.95),rgba(5,150,105,0.96))] text-white shadow-[0_24px_60px_rgba(16,185,129,0.16)]',
            buttonLabel: 'Create Rubric',
            buttonClass: 'text-emerald-700',
            copyClass: 'text-white/85',
            onClick: () => navigate('/teacher/assessments/new-rubric'),
        },
    ];

    return (
        <div className="h-full min-h-0 overflow-y-auto teacher-scrollbar px-4 py-3 md:px-6 md:py-4">
            <div className="mx-auto flex h-full min-h-0 max-w-[1400px] flex-col gap-4">
                <section>
                    <p className="teacher-eyebrow">Assessments</p>
                    <h1 className="teacher-heading">Manage Your Work</h1>
                </section>

                <section className="grid gap-3 lg:grid-cols-2">
                    {actionCards.map((card, index) => (
                        <motion.article
                            key={card.title}
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                            transition={{ duration: 0.28, delay: index * 0.06, ease: 'easeOut' }}
                            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                            className={`teacher-feature-card ${card.tone} p-4`}
                        >
                            <div className="flex h-full flex-col justify-between gap-3">
                                <div className="space-y-1">
                                        <h2 className="text-lg font-black leading-tight tracking-tight text-inherit">
                                            {card.title}
                                        </h2>
                                        <p className={`max-w-sm text-xs leading-5 ${card.copyClass}`}>
                                            {card.description}
                                        </p>
                                </div>

                                <div className="flex justify-start">
                                    <button
                                        type="button"
                                        onClick={card.onClick}
                                        className={`inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] shadow-md transition hover:-translate-y-0.5 ${card.buttonClass}`}
                                    >
                                        {card.buttonLabel}
                                    </button>
                                </div>
                            </div>
                        </motion.article>
                    ))}
                </section>

                <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="teacher-eyebrow">History</p>
                            <h2 className="text-lg font-bold tracking-tight text-slate-950">
                                All created assessments & rubrics
                            </h2>
                        </div>
                        <div className="flex flex-wrap gap-1 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                            <button
                                type="button"
                                onClick={() => setActivePanel('assessments')}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                    activePanel === 'assessments'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Assessments ({assessments.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActivePanel('rubrics')}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                    activePanel === 'rubrics'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Rubrics ({rubrics.length})
                            </button>
                        </div>
                    </div>

                    {statusMessage && !loading ? (
                        <p className="mt-2 text-sm text-rose-600">{statusMessage}</p>
                    ) : activePanel === 'assessments' ? (
                        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400">
                                    Assessments
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                                        {['all', 'pending', 'graded'].map((filter) => (
                                            <button
                                                key={filter}
                                                type="button"
                                                onClick={() => setAssessmentFilter(filter)}
                                                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize transition ${
                                                    assessmentFilter === filter
                                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                        : 'text-slate-500 hover:text-slate-900'
                                                }`}
                                            >
                                                {filter}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowHistoryModal(true)}
                                        className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                                    >
                                        View All
                                    </button>
                                </div>
                            </div>

                            <div className="teacher-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                                {filteredAssessments.length === 0 ? (
                                    <div className="teacher-float-card px-3 py-3 text-xs text-slate-500">
                                        No assessments match this filter yet.
                                    </div>
                                ) : (
                                    filteredAssessments.map((item) => {
                                        const statusValue = String(item.assessment_status || item.status || 'Draft');
                                        return (
                                            <article
                                                key={item.exercise_id}
                                                onClick={() => {
                                                    setSelectedAssessmentDetail(item);
                                                    setShowAssessmentDetail(true);
                                                }}
                                                className="teacher-float-card cursor-pointer p-2.5 transition hover:border-blue-200"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                                                        <p className="text-[10px] text-slate-500">{item.subject || 'No subject yet'}</p>
                                                    </div>
                                                    <span
                                                        className={`shrink-0 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                                                            statusValue.toLowerCase() === 'graded'
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : statusValue.toLowerCase() === 'pending'
                                                                    ? 'bg-amber-50 text-amber-700'
                                                                    : 'bg-blue-50 text-blue-700'
                                                        }`}
                                                    >
                                                        {statusValue}
                                                    </span>
                                                </div>

                                                <p className="mt-1 text-[10px] leading-5 text-slate-500 line-clamp-2">
                                                    {item.description || 'No description provided yet.'}
                                                </p>

                                                <div className="mt-1.5 flex flex-wrap gap-1 text-[9px] text-slate-400">
                                                    <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5">
                                                        {item.topic || 'No topic'}
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5">
                                                        {item.difficulty || 'Medium'}
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5">
                                                        {item.item_count ?? item.items?.length ?? 0} items
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5">
                                                        {formatDate(item.date_created)}
                                                    </span>
                                                </div>
                                            </article>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400">
                                    Rubrics
                                </p>
                                <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    {rubrics.length}
                                </span>
                            </div>

                            <div className="teacher-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                                {rubrics.length === 0 ? (
                                    <div className="teacher-float-card px-3 py-3 text-xs text-slate-500">
                                        No rubrics stored yet.
                                    </div>
                                ) : (
                                    rubrics.map((rubric) => (
                                        <article
                                            key={rubric.rubric_set_id}
                                            className="teacher-float-card p-2.5 transition hover:border-emerald-200"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-slate-900">{rubric.rubric_name}</p>
                                                    <p className="text-xs text-slate-500">{formatDate(rubric.created_at)}</p>
                                                </div>
                                                <span className="inline-flex shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                                    Criteria
                                                </span>
                                            </div>

                                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                                {rubric.criteria || 'No criteria added yet.'}
                                            </p>

                                            {rubric.ai_instructions && (
                                                <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/70 px-2.5 py-2">
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-blue-600">
                                                        AI Instructions
                                                    </p>
                                                    <p className="mt-1 text-xs leading-5 text-slate-600">
                                                        {rubric.ai_instructions}
                                                    </p>
                                                </div>
                                            )}

                                            {Array.isArray(rubric.level_definitions) && rubric.level_definitions.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {rubric.level_definitions.map((level, index) => (
                                                        <span
                                                            key={`${rubric.rubric_set_id}-level-${index}`}
                                                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                                                        >
                                                            {formatLevelLabel(level)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </article>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {showHistoryModal &&
                createPortal(
                    <motion.div
                        className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/65 px-4 py-6 backdrop-blur-xl md:px-6 md:py-8"
                        initial={prefersReducedMotion ? false : { opacity: 0 }}
                        animate={prefersReducedMotion ? undefined : { opacity: 1 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        onClick={() => setShowHistoryModal(false)}
                    >
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.22),transparent_38%)]" />
                        <motion.div
                            className="relative w-full max-w-[700px]"
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
                            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.24, ease: 'easeOut' }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="teacher-float-card overflow-hidden rounded-[1.5rem] border-white/70 bg-white/95 shadow-[0_20px_60px_rgba(59,130,246,0.15)] backdrop-blur-xl">
                                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">View</p>
                                        <h2 className="text-base font-bold text-slate-900">Assessments & Rubrics History</h2>
                                        <p className="text-xs text-slate-500">Review everything you have created from one floating panel.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowHistoryModal(false)}
                                        className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
                                    >
                                        Cancel
                                    </button>
                                </div>

                                <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-2">
                                    <div className="flex flex-wrap gap-1 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                                        <button
                                            type="button"
                                            onClick={() => setHistoryPanel('assessments')}
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                historyPanel === 'assessments'
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                                    : 'text-slate-500 hover:text-slate-900'
                                            }`}
                                        >
                                            Assessments ({assessments.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHistoryPanel('rubrics')}
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                historyPanel === 'rubrics'
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                                    : 'text-slate-500 hover:text-slate-900'
                                            }`}
                                        >
                                            Rubrics ({rubrics.length})
                                        </button>
                                    </div>
                                </div>

                                <div className="teacher-scrollbar max-h-[calc(100vh-14rem)] overflow-y-auto px-4 py-3">
                                    {historyPanel === 'assessments' ? (
                                        <div className="space-y-2">
                                            {assessments.length === 0 ? (
                                                <div className="teacher-float-card px-4 py-4 text-sm text-slate-500">
                                                    No assessments stored yet.
                                                </div>
                                            ) : (
                                                assessments.map((item) => {
                                                    const statusValue = String(item.assessment_status || item.status || 'Draft');
                                                    return (
                                                        <article
                                                            key={item.exercise_id}
                                                            onClick={() => {
                                                                setSelectedAssessmentDetail(item);
                                                                setShowAssessmentDetail(true);
                                                            }}
                                                            className="teacher-float-card cursor-pointer p-2.5 transition hover:border-blue-200"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                                                                        {item.subject || 'Assessment'}
                                                                    </p>
                                                                    <p className="mt-0.5 text-sm font-bold text-slate-900">{item.title}</p>
                                                                </div>
                                                                <span
                                                                    className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                                        statusValue.toLowerCase() === 'graded'
                                                                            ? 'bg-emerald-50 text-emerald-700'
                                                                            : statusValue.toLowerCase() === 'pending'
                                                                                ? 'bg-amber-50 text-amber-700'
                                                                                : 'bg-blue-50 text-blue-700'
                                                                    }`}
                                                                >
                                                                    {statusValue}
                                                                </span>
                                                            </div>
                                                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                                                {item.description || 'No description provided yet.'}
                                                            </p>
                                                            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                                                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                                                    {item.topic || 'No topic'} - {item.difficulty || 'Medium'}
                                                                </span>
                                                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                                                    {item.item_count ?? item.items?.length ?? 0} items
                                                                </span>
                                                            </div>
                                                        </article>
                                                    );
                                                })
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {rubrics.length === 0 ? (
                                                <div className="teacher-float-card px-4 py-4 text-sm text-slate-500">
                                                    No rubrics stored yet.
                                                </div>
                                            ) : (
                                                rubrics.map((rubric) => (
                                                    <article
                                                        key={rubric.rubric_set_id}
                                                        className="teacher-float-card p-2.5 transition hover:border-emerald-200"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Rubric</p>
                                                                <p className="mt-0.5 text-sm font-bold text-slate-900">{rubric.rubric_name}</p>
                                                                <p className="text-xs text-slate-500">{formatDate(rubric.created_at)}</p>
                                                            </div>
                                                            <span className="shrink-0 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                                                Criteria
                                                            </span>
                                                        </div>

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
                                                    </article>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>,
                    document.body
                )}
            {showAssessmentDetail && selectedAssessmentDetail &&
                createPortal(
                    <motion.div
                        className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/65 px-4 py-6 backdrop-blur-xl md:px-6 md:py-8"
                        initial={prefersReducedMotion ? false : { opacity: 0 }}
                        animate={prefersReducedMotion ? undefined : { opacity: 1 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        onClick={() => setShowAssessmentDetail(false)}
                    >
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.22),transparent_38%)]" />
                        <motion.div
                            className="relative w-full max-w-[700px]"
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
                            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.24, ease: 'easeOut' }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="teacher-float-card overflow-hidden rounded-[1.5rem] border-white/70 bg-white/95 shadow-[0_20px_60px_rgba(59,130,246,0.15)] backdrop-blur-xl">
                                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">
                                            {selectedAssessmentDetail.subject || 'Assessment'}
                                        </p>
                                        <h2 className="text-base font-bold text-slate-900">{selectedAssessmentDetail.title}</h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                            String(selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || 'Draft').toLowerCase() === 'graded'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : String(selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || 'Draft').toLowerCase() === 'pending'
                                                    ? 'bg-amber-50 text-amber-700'
                                                    : 'bg-blue-50 text-blue-700'
                                        }`}>
                                            {selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || 'Draft'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowAssessmentDetail(false)}
                                            className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>

                                <div className="teacher-scrollbar max-h-[calc(100vh-14rem)] overflow-y-auto px-4 py-3">
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[11px] leading-6 text-slate-600">{selectedAssessmentDetail.description || 'No description provided.'}</p>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                                                {selectedAssessmentDetail.topic || 'No topic'}
                                            </span>
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                                                {selectedAssessmentDetail.difficulty || 'Medium'}
                                            </span>
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                                                {selectedAssessmentDetail.item_count ?? selectedAssessmentDetail.items?.length ?? 0} items
                                            </span>
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                                                Created {formatDate(selectedAssessmentDetail.date_created)}
                                            </span>
                                            {selectedAssessmentDetail.due_date && (() => {
                                                const now = new Date();
                                                const due = new Date(selectedAssessmentDetail.due_date);
                                                if (Number.isNaN(due.getTime())) return null;
                                                const diffMs = due.getTime() - now.getTime();
                                                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                                                let cls = 'bg-blue-50 text-blue-700';
                                                let label = `Due in ${diffDays}d`;
                                                if (diffDays < 0) { cls = 'bg-red-50 text-red-700'; label = 'Overdue'; }
                                                else if (diffDays === 0) { cls = 'bg-amber-50 text-amber-700'; label = 'Due today'; }
                                                else if (diffDays <= 3) { cls = 'bg-orange-50 text-orange-700'; }
                                                return (
                                                    <span className={`rounded-full px-2 py-0.5 font-semibold ${cls}`}>{label}</span>
                                                );
                                            })()}
                                        </div>

                                        {selectedAssessmentDetail.subject_meta && (
                                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">Subject Meta</p>
                                                <p className="mt-0.5 text-xs text-slate-600">{selectedAssessmentDetail.subject_meta}</p>
                                            </div>
                                        )}

                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400">
                                                Questions ({selectedAssessmentDetail.items?.length ?? 0})
                                            </p>
                                            {(!selectedAssessmentDetail.items || selectedAssessmentDetail.items.length === 0) ? (
                                                <p className="mt-2 text-xs text-slate-500">No items in this assessment.</p>
                                            ) : (
                                                <ul className="mt-2 space-y-2">
                                                    {selectedAssessmentDetail.items.map((item, index) => (
                                                        <li
                                                            key={item.item_id ?? index}
                                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">
                                                                        {item.item_no ?? index + 1}
                                                                    </span>
                                                                    <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                                                                        {item.question_type || 'Question'}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-medium text-slate-500">
                                                                    {item.max_score ?? 0} pts
                                                                </span>
                                                            </div>
                                                            <p className="mt-1.5 text-xs leading-6 text-slate-800">
                                                                {item.question_content}
                                                            </p>
                                                            {item.model_solution && (
                                                                <div className="mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2 py-1.5">
                                                                    <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-emerald-600">Solution</p>
                                                                    <p className="mt-0.5 text-xs text-slate-700">{item.model_solution}</p>
                                                                </div>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>

                                        <div className="flex justify-end gap-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowAssessmentDetail(false);
                                                    navigate('/teacher/grade-submissions', { state: { exerciseId: selectedAssessmentDetail.exercise_id } });
                                                }}
                                                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                                            >
                                                View Submissions
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>,
                    document.body
                )}
        </div>
    );
};

export default ManageAssessments;
