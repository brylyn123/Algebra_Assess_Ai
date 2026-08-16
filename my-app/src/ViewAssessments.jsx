import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTeacherRecords } from './hooks/useTeacherRecords';
import { getSubjectThemeByName } from './subjectCardThemes';
import MathText from './MathText';

const formatDate = (value) => {
    if (!value) return 'Not dated yet';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const ViewAssessments = ({ compact = false }) => {
    const navigate = useNavigate();
    const { assessments, rubrics, loading, statusMessage } = useTeacherRecords();
    const [activePanel, setActivePanel] = useState('assessments');
    const [selectedAssessment, setSelectedAssessment] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    const activeAssessments = assessments.filter(
        (a) => (a.assessment_status || a.status || 'Draft') !== 'Graded'
    );

    const formatLevelLabel = (level) => {
        const label = String(level?.label ?? '').trim();
        const points = Number(level?.points ?? 0);
        return label ? `${label} - ${points} pts` : `${points} pts`;
    };

    const getStatusClasses = (statusValue) => {
        const lower = String(statusValue).toLowerCase();
        if (lower === 'graded') return { badge: 'bg-emerald-50 text-emerald-700' };
        if (lower === 'pending') return { badge: 'bg-amber-50 text-amber-700' };
        return { badge: 'bg-blue-50 text-blue-700' };
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

    if (compact) {
        return (
            <div className="space-y-4 text-sm">
                <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">View</p>
                    <h3 className="text-base font-semibold text-slate-900">Assessments & rubrics</h3>
                    <p className="text-xs text-slate-500">Tap 'View All' to inspect every assessment and rubric you created.</p>
                </div>
                {statusMessage && (
                    <p className="text-xs text-rose-500">{statusMessage}</p>
                )}
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            <section className="flex flex-1 min-h-0 flex-col rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-4 sm:px-6 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="inline-flex max-w-[320px] rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                            <button
                                type="button"
                                onClick={() => setActivePanel('assessments')}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                    activePanel === 'assessments'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200/60'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                            >
                                <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-bold ${
                                    activePanel === 'assessments' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {assessments.length}
                                </span>
                                Assessments
                            </button>
                            <button
                                type="button"
                                onClick={() => setActivePanel('rubrics')}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                    activePanel === 'rubrics'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200/60'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                            >
                                <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-bold ${
                                    activePanel === 'rubrics' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {rubrics.length}
                                </span>
                                Rubrics
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
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
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Your Assessments</p>
                                <p className="text-[10px] text-slate-400">{assessments.length} total</p>
                            </div>
                            {assessments.length === 0 && !loading ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-blue-400">
                                            <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM9 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-700">No assessments yet</h4>
                                    <p className="mt-1 max-w-xs text-xs text-slate-400">No assessments have been created yet.</p>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {assessments.map((item) => {
                                        const statusValue = String(item.assessment_status || item.status || 'Draft');
                                        const statusBadge = getStatusClasses(statusValue);
                                        const subjectTheme = getSubjectThemeByName(item.subject || item.subject_name);
                                        return (
                                            <div
                                                key={item.exercise_id}
                                                onClick={() => {
                                                    setSelectedAssessment(item);
                                                    setShowDetail(true);
                                                }}
                                                className={`group relative overflow-hidden rounded-xl sm:rounded-[1.1rem] border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer flex flex-col min-h-[110px] sm:min-h-[180px] ${subjectTheme.cardClass}`}
                                            >
                                                <div className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${subjectTheme.accentClass}`} />
                                                <div className="flex flex-1 flex-col gap-1.5 sm:gap-2.5 p-3 pl-4 sm:p-4 sm:pl-5">
                                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                                        <div className={`flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl ${subjectTheme.cardBadgeClass} text-[10px] sm:text-xs font-bold`}>
                                                            {item.title?.charAt(0)?.toUpperCase() || 'A'}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <h3 className={`text-xs sm:text-sm font-bold truncate ${subjectTheme.cardTextClass}`}>{item.title}</h3>
                                                                <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[7px] sm:text-[8px] font-bold uppercase tracking-wider ${statusBadge.badge}`}>
                                                                    {statusValue}
                                                                </span>
                                                            </div>
                                                            <p className={`mt-0.5 text-[10px] sm:text-[11px] truncate ${subjectTheme.cardSubtextClass}`}>
                                                                {item.subjects?.length > 0
                                                                    ? item.subjects.map((s) => s.subject_name).join(', ')
                                                                    : item.subject || 'No subject yet'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {item.description && (
                                                        <p className={`hidden sm:block text-[10px] leading-4 line-clamp-2 ${subjectTheme.cardSubtextClass}`}>{item.description}</p>
                                                    )}
                                                    <div className="mt-auto flex flex-wrap gap-1">
                                                        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium ${subjectTheme.chipClass}`}>
                                                            {item.topic || 'No topic'}
                                                        </span>
                                                        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium ${subjectTheme.chipClass}`}>
                                                            {item.difficulty || 'Medium'}
                                                        </span>
                                                        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium ${subjectTheme.chipClass}`}>
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
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Your Rubrics</p>
                                <p className="text-[10px] text-slate-400">{rubrics.length} total</p>
                            </div>
                            {rubrics.length === 0 && !loading ? (
                                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-emerald-400">
                                            <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-700">No rubrics yet</h4>
                                    <p className="mt-1 max-w-xs text-xs text-slate-400">No rubrics have been created yet.</p>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {rubrics.map((rubric) => (
                                        <div
                                            key={rubric.rubric_set_id}
                                            className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex flex-col min-h-[110px] sm:min-h-[180px]"
                                        >
                                            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-teal-600" />
                                            <div className="flex flex-1 flex-col gap-1.5 sm:gap-2.5 p-3 pl-4 sm:p-4 sm:pl-5">
                                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                                    <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs font-bold">
                                                        {rubric.rubric_name?.charAt(0)?.toUpperCase() || 'R'}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{rubric.rubric_name}</h3>
                                                            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[7px] sm:text-[8px] font-bold uppercase tracking-wider text-emerald-700">
                                                                Criteria
                                                            </span>
                                                        </div>
                                                        <p className="mt-0.5 text-[10px] sm:text-[11px] text-emerald-600/80">{formatDate(rubric.created_at)}</p>
                                                    </div>
                                                </div>
                                                <p className="hidden sm:block text-[10px] leading-4 text-slate-600 line-clamp-2">
                                                    {rubric.criteria || 'No criteria added yet.'}
                                                </p>
                                                {rubric.ai_instructions && (
                                                    <div className="hidden sm:block rounded-lg border border-blue-100 bg-blue-50/70 px-2 py-1.5">
                                                        <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-blue-600">AI Instructions</p>
                                                        <p className="mt-0.5 text-[9px] leading-4 text-slate-600 line-clamp-2">{rubric.ai_instructions}</p>
                                                    </div>
                                                )}
                                                {Array.isArray(rubric.level_definitions) && rubric.level_definitions.length > 0 && (
                                                    <div className="mt-auto flex flex-wrap gap-1">
                                                        {rubric.level_definitions.map((level, index) => (
                                                            <span
                                                                key={`${rubric.rubric_set_id}-level-${index}`}
                                                                className="rounded-full border border-emerald-200 bg-white px-1.5 py-0.5 text-[8px] sm:text-[9px] font-semibold text-emerald-700"
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
            </section>

            {showDetail && selectedAssessment &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
                        onClick={() => setShowDetail(false)}
                    >
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-3xl max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.28)]">
                            <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-8 pb-6 pt-7">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/90">
                                                {selectedAssessment.subject || 'Assessment'}
                                            </span>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                                String(selectedAssessment.assessment_status || selectedAssessment.status || 'Draft').toLowerCase() === 'graded'
                                                    ? 'bg-emerald-400/20 text-emerald-100'
                                                    : String(selectedAssessment.assessment_status || selectedAssessment.status || 'Draft').toLowerCase() === 'pending'
                                                        ? 'bg-amber-400/20 text-amber-100'
                                                        : 'bg-blue-300/20 text-blue-100'
                                            }`}>
                                                {selectedAssessment.assessment_status || selectedAssessment.status || 'Draft'}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">{selectedAssessment.title}</h3>
                                        {selectedAssessment.description && (
                                            <p className="max-w-lg text-sm text-blue-100/80 line-clamp-2">{selectedAssessment.description}</p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowDetail(false)}
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
                                    <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                                        <div className="rounded-xl sm:rounded-2xl border-l-[3px] border-l-blue-300 bg-blue-50 p-3 sm:p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500">Questions</p>
                                            <p className="mt-1 text-2xl sm:text-3xl font-black text-blue-600">{selectedAssessment.items?.length ?? selectedAssessment.item_count ?? 0}</p>
                                            <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-blue-400">Total items</p>
                                        </div>
                                        <div className="rounded-xl sm:rounded-2xl border-l-[3px] border-l-amber-300 bg-amber-50 p-3 sm:p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Total Points</p>
                                            <p className="mt-1 text-2xl sm:text-3xl font-black text-amber-600">
                                                {(selectedAssessment.items || []).reduce((sum, item) => sum + (item.max_score ?? 0), 0)}
                                            </p>
                                            <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-amber-400">Maximum score</p>
                                        </div>
                                        <div className="rounded-xl sm:rounded-2xl border-l-[3px] border-l-emerald-300 bg-emerald-50 p-3 sm:p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Due Date</p>
                                            <p className="mt-1 text-2xl sm:text-3xl font-black text-emerald-600">
                                                {(() => {
                                                    const due = getDueDateStatus(selectedAssessment.due_date);
                                                    return due ? due.label : 'None';
                                                })()}
                                            </p>
                                            <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-emerald-400">Deadline status</p>
                                        </div>
                                    </div>

                                    <div className="mb-6 flex flex-wrap gap-1.5">
                                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            {selectedAssessment.topic || 'No topic'}
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            {selectedAssessment.difficulty || 'Medium'}
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            {selectedAssessment.item_count ?? selectedAssessment.items?.length ?? 0} items
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            Created {formatDate(selectedAssessment.date_created)}
                                        </span>
                                        {selectedAssessment.due_date && (() => {
                                            const due = getDueDateStatus(selectedAssessment.due_date);
                                            if (!due) return null;
                                            return (
                                                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-semibold ${due.color}`}>
                                                    {due.label}
                                                </span>
                                            );
                                        })()}
                                    </div>

                                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Questions</p>
                                    {(!selectedAssessment.items || selectedAssessment.items.length === 0) ? (
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
                                            {selectedAssessment.items.map((item, index) => (
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
                                </div>
                            </div>

                            <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-8 py-3">
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDetail(false);
                                            navigate('/teacher/grade-submissions', { state: { exerciseId: selectedAssessment.exercise_id } });
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

export default ViewAssessments;
