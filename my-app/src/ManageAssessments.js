import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTeacherRecords } from './hooks/useTeacherRecords';

const ManageAssessments = () => {
    const navigate = useNavigate();
    const prefersReducedMotion = useReducedMotion();
    const { assessments, rubrics, loading, statusMessage } = useTeacherRecords();
    const [activePanel, setActivePanel] = useState('assessments');
    const [assessmentFilter, setAssessmentFilter] = useState('all');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyPanel, setHistoryPanel] = useState('assessments');

    const formatDate = (value) => {
        if (!value) return 'Not dated yet';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return value;
        }
        return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
        <div className="h-full min-h-0 overflow-hidden px-4 py-4 md:px-6 md:py-5">
            <div className="mx-auto flex h-full min-h-0 max-w-[1400px] flex-col gap-8 pb-6">
                <section className="space-y-2">
                    <p className="teacher-eyebrow">Assessments</p>
                    <h1 className="teacher-heading">Manage Your Work</h1>
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                    {actionCards.map((card, index) => (
                        <motion.article
                            key={card.title}
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                            transition={{ duration: 0.28, delay: index * 0.06, ease: 'easeOut' }}
                            whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                            className={`teacher-feature-card ${card.tone} min-h-[210px] p-5 md:p-6`}
                        >
                            <div className="flex h-full flex-col justify-between gap-4">
                                <div className="space-y-2">
                                        <h2 className="text-xl font-black leading-tight tracking-tight text-inherit md:text-[1.7rem]">
                                            {card.title}
                                        </h2>
                                        <p className={`max-w-sm text-xs leading-6 md:text-sm md:leading-7 ${card.copyClass}`}>
                                            {card.description}
                                        </p>
                                </div>

                                <div className="flex justify-start">
                                    <button
                                        type="button"
                                        onClick={card.onClick}
                                        className={`inline-flex items-center justify-center rounded-full bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.28em] shadow-lg transition hover:-translate-y-0.5 md:px-5 md:py-3 md:text-xs ${card.buttonClass}`}
                                    >
                                        {card.buttonLabel}
                                    </button>
                                </div>
                            </div>
                        </motion.article>
                    ))}
                </section>

                <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="teacher-eyebrow">History</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                                All created assessments & rubrics
                            </h2>
                        </div>
                        <div className="flex flex-wrap gap-2 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                            <button
                                type="button"
                                onClick={() => setActivePanel('assessments')}
                                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
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
                                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
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
                        <p className="mt-4 text-sm text-rose-600">{statusMessage}</p>
                    ) : activePanel === 'assessments' ? (
                        <div className="mt-5 flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-slate-400">
                                    Assessments
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                                        {['all', 'pending', 'graded'].map((filter) => (
                                            <button
                                                key={filter}
                                                type="button"
                                                onClick={() => setAssessmentFilter(filter)}
                                                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                                                    assessmentFilter === filter
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
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
                                        className="rounded-full border border-blue-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                                    >
                                        View All
                                    </button>
                                </div>
                            </div>

                            <div className="teacher-scrollbar min-h-0 h-[calc(100vh-430px)] space-y-4 overflow-y-auto pr-4 pb-64 sm:h-[calc(100vh-410px)] sm:pb-72">
                                {filteredAssessments.length === 0 ? (
                                    <div className="teacher-float-card px-4 py-7 text-sm text-slate-500">
                                        No assessments match this filter yet.
                                    </div>
                                ) : (
                                    filteredAssessments.map((item) => {
                                        const statusValue = String(item.assessment_status || item.status || 'Draft');
                                        return (
                                            <article
                                                key={item.exercise_id}
                                                className="teacher-float-card p-4 transition hover:border-blue-200 hover:shadow-[0_12px_30px_rgba(148,163,184,0.14)]"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="text-[0.95rem] font-semibold text-slate-900">{item.title}</p>
                                                        <p className="mt-1 text-xs text-slate-500">{item.subject || 'No subject yet'}</p>
                                                    </div>
                                                    <span
                                                        className={`teacher-status-pill ${
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

                                                <p className="mt-2 text-xs leading-6 text-slate-600 md:text-sm">
                                                    {item.description || 'No description provided yet.'}
                                                </p>

                                                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500 md:text-[11px]">
                                                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                                                        Topic: {item.topic || 'Not set'}
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                                                        Difficulty: {item.difficulty || 'Medium'}
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                                                        Items: {item.item_count ?? item.items?.length ?? 0}
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
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
                        <div className="mt-5 flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-slate-400">
                                    Rubrics
                                </p>
                                <span className="teacher-status-pill bg-emerald-50 text-emerald-700">
                                    {rubrics.length}
                                </span>
                            </div>

                            <div className="teacher-scrollbar min-h-0 h-[calc(100vh-430px)] space-y-4 overflow-y-auto pr-4 pb-64 sm:h-[calc(100vh-410px)] sm:pb-72">
                                {rubrics.length === 0 ? (
                                    <div className="teacher-float-card px-4 py-7 text-sm text-slate-500">
                                        No rubrics stored yet.
                                    </div>
                                ) : (
                                    rubrics.map((rubric) => (
                                        <article
                                            key={rubric.rubric_set_id}
                                            className="teacher-float-card p-4 transition hover:border-emerald-200 hover:shadow-[0_12px_30px_rgba(148,163,184,0.14)]"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-[0.95rem] font-semibold text-slate-900">{rubric.rubric_name}</p>
                                                    <p className="mt-1 text-xs text-slate-500">{formatDate(rubric.created_at)}</p>
                                                </div>
                                                <span className="teacher-status-pill bg-emerald-50 text-emerald-700">
                                                    Criteria
                                                </span>
                                            </div>

                                            <p className="mt-3 text-xs leading-6 text-slate-600">
                                                {rubric.criteria || 'No criteria added yet.'}
                                            </p>

                                            {rubric.ai_instructions && (
                                                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2.5">
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600">
                                                        AI Instructions
                                                    </p>
                                                    <p className="mt-1.5 text-xs leading-6 text-slate-600 md:text-sm">
                                                        {rubric.ai_instructions}
                                                    </p>
                                                </div>
                                            )}

                                            {Array.isArray(rubric.level_definitions) && rubric.level_definitions.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {rubric.level_definitions.map((level, index) => (
                                                        <span
                                                            key={`${rubric.rubric_set_id}-level-${index}`}
                                                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm"
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
                            className="relative w-full max-w-[800px]"
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
                            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.24, ease: 'easeOut' }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="teacher-float-card overflow-hidden rounded-[2rem] border-white/70 bg-white/95 shadow-[0_30px_90px_rgba(59,130,246,0.2)] backdrop-blur-xl">
                                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 md:px-6">
                                    <div className="space-y-0.5">
                                        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">View</p>
                                        <h2 className="text-lg font-bold text-slate-900">Assessments & Rubrics History</h2>
                                        <p className="text-sm text-slate-500">Review everything you have created from one floating panel.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowHistoryModal(false)}
                                        className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                                    >
                                        Cancel
                                    </button>
                                </div>

                                <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 md:px-6">
                                    <div className="flex flex-wrap gap-2 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                                        <button
                                            type="button"
                                            onClick={() => setHistoryPanel('assessments')}
                                            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
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
                                            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                                                historyPanel === 'rubrics'
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                                    : 'text-slate-500 hover:text-slate-900'
                                            }`}
                                        >
                                            Rubrics ({rubrics.length})
                                        </button>
                                    </div>
                                </div>

                                <div className="teacher-scrollbar max-h-[calc(100vh-18rem)] overflow-y-auto px-4 py-4 md:px-6 md:py-5">
                                    {historyPanel === 'assessments' ? (
                                        <div className="space-y-3">
                                            {assessments.length === 0 ? (
                                                <div className="rounded-[1.3rem] border border-slate-900/10 bg-slate-100/70 px-6 py-7 text-sm text-slate-500 shadow-[0_14px_32px_rgba(148,163,184,0.14)] backdrop-blur-sm">
                                                    No assessments stored yet.
                                                </div>
                                            ) : (
                                                assessments.map((item) => {
                                                    const statusValue = String(item.assessment_status || item.status || 'Draft');
                                                    const statusTone =
                                                        statusValue.toLowerCase() === 'graded'
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : statusValue.toLowerCase() === 'pending'
                                                                ? 'bg-amber-50 text-amber-700'
                                                                : 'bg-blue-50 text-blue-700';
                                                    return (
                                                        <article
                                                            key={item.exercise_id}
                                                            className="relative overflow-hidden rounded-[1.3rem] border border-slate-900/10 bg-slate-100/70 p-3.5 shadow-[0_14px_32px_rgba(148,163,184,0.14)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_36px_rgba(148,163,184,0.18)]"
                                                        >
                                                            <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />
                                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                                <div className="min-w-0">
                                                                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">
                                                                        {item.subject || 'Assessment'}
                                                                    </p>
                                                                    <h3 className="mt-1.5 text-[1.02rem] font-bold text-slate-900">
                                                                        {item.title}
                                                                    </h3>
                                                                    <p className="mt-1 text-xs text-slate-500">
                                                                        {item.topic || 'No topic set'} - {item.difficulty || 'Medium'}
                                                                    </p>
                                                                </div>
                                                                <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-center text-xs text-slate-500 shadow-sm">
                                                                    <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                                                                        ID {item.exercise_id}
                                                                    </p>
                                                                    <p className="mt-1 font-medium text-slate-600 capitalize">
                                                                        {statusValue}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <p className="mt-3 text-xs leading-6 text-slate-600">
                                                                {item.description || 'No description provided yet.'}
                                                            </p>

                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                                                                    {item.item_count ?? item.items?.length ?? 0} items
                                                                </span>
                                                                <span className={`rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold shadow-sm ${statusTone}`}>
                                                                    {statusValue}
                                                                </span>
                                                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                                                                    Created {formatDate(item.date_created)}
                                                                </span>
                                                            </div>
                                                        </article>
                                                    );
                                                })
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {rubrics.length === 0 ? (
                                                <div className="rounded-[1.3rem] border border-slate-900/10 bg-slate-100/70 px-6 py-7 text-sm text-slate-500 shadow-[0_14px_32px_rgba(148,163,184,0.14)] backdrop-blur-sm">
                                                    No rubrics stored yet.
                                                </div>
                                            ) : (
                                                rubrics.map((rubric) => (
                                                    <article
                                                        key={rubric.rubric_set_id}
                                                        className="relative overflow-hidden rounded-[1.3rem] border border-slate-900/10 bg-slate-100/70 p-3.5 shadow-[0_14px_32px_rgba(148,163,184,0.14)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_16px_36px_rgba(148,163,184,0.18)]"
                                                    >
                                                        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-blue-500 to-sky-400" />
                                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="min-w-0">
                                                                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400">Rubric</p>
                                                                <h3 className="mt-1.5 text-[1.02rem] font-bold text-slate-900">{rubric.rubric_name}</h3>
                                                                <p className="mt-1 text-xs text-slate-500">{formatDate(rubric.created_at)}</p>
                                                            </div>
                                                            <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-center text-xs text-slate-500 shadow-sm">
                                                                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                                                                    ID {rubric.rubric_set_id}
                                                                </p>
                                                                <p className="mt-1 font-medium text-slate-600">
                                                                    Criteria
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <p className="mt-3 text-xs leading-6 text-slate-600">
                                                            {rubric.criteria || 'No criteria added yet.'}
                                                        </p>
                                                        {rubric.ai_instructions && (
                                                            <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2.5">
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600">
                                                                    AI Instructions
                                                                </p>
                                                                <p className="mt-1.5 text-xs leading-6 text-slate-600 md:text-sm">
                                                                    {rubric.ai_instructions}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {Array.isArray(rubric.level_definitions) && rubric.level_definitions.length > 0 && (
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {rubric.level_definitions.map((level, index) => (
                                                                    <span
                                                                        key={`${rubric.rubric_set_id}-modal-level-${index}`}
                                                                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm"
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
        </div>
    );
};

export default ManageAssessments;
