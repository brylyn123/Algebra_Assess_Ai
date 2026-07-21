import React from 'react';
import { useTeacherRecords } from './hooks/useTeacherRecords';

const ViewHistoryCard = ({ maxHeight = '260px' }) => {
    const { assessments, rubrics, loading, statusMessage } = useTeacherRecords();

    const formatLevelLabel = (level) => {
        const label = String(level?.label ?? '').trim();
        const points = Number(level?.points ?? 0);
        if (!label) {
            return `${points} pts`;
        }
        return `${label} - ${points} pts`;
    };

    const formatDate = (value) => {
        if (!value) return '—';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return value;
        }
        return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const renderStatusBadge = (value) => {
        const normalized = (value || 'Draft').toLowerCase();
        const base = 'px-2 py-1 rounded-full text-[10px] uppercase tracking-[0.3em] font-semibold';
        if (normalized === 'graded') {
            return `${base} bg-blue-50 text-blue-700`;
        }
        if (normalized === 'pending') {
            return `${base} bg-blue-100 text-blue-800`;
        }
        return `${base} bg-blue-50 text-blue-700`;
    };

    return (
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">History</p>
                    <h2 className="text-2xl font-semibold text-slate-900">All created assessments & rubrics</h2>
                </div>
                {loading && (
                    <span className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">
                        Loading...
                    </span>
                )}
            </div>
            {statusMessage && !loading ? (
                <p className="mt-4 text-sm text-rose-600">{statusMessage}</p>
            ) : (
                <div
                    className="mt-4 space-y-4 overflow-y-auto teacher-scrollbar pr-1"
                    style={{ maxHeight }}
                >
                    <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">Assessments</p>
                        <div className="space-y-2">
                            {assessments.length === 0 ? (
                                <p className="text-xs text-slate-400">No assessments recorded yet.</p>
                            ) : (
                                assessments.map((item) => (
                                    <div
                                        key={item.exercise_id}
                                        className="space-y-2 rounded-2xl border border-slate-200 bg-white/90 p-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-slate-900">{item.title}</p>
                                                <p className="text-xs text-slate-500">{item.subject || '—'}</p>
                                            </div>
                                            <span className={renderStatusBadge(item.assessment_status || item.status)}>
                                                {item.assessment_status || item.status || 'Draft'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                            <span>Topic: {item.topic || '—'}</span>
                                            <span>Difficulty: {item.difficulty || 'Medium'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                            <span>Items: {item.item_count ?? item.items?.length ?? 0}</span>
                                            <span>{formatDate(item.date_created)}</span>
                                        </div>
                                        <div className="flex justify-end">
                                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                                                Saved
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">Rubrics</p>
                        <div className="space-y-2">
                            {rubrics.length === 0 ? (
                                <p className="text-xs text-slate-400">No rubrics stored yet.</p>
                            ) : (
                                rubrics.map((rubric) => (
                                    <div
                                        key={rubric.rubric_set_id}
                                        className="space-y-2 rounded-2xl border border-slate-200 bg-white/90 p-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-slate-900">{rubric.rubric_name}</p>
                                                <p className="text-[11px] text-slate-500">{formatDate(rubric.created_at)}</p>
                                            </div>
                                            <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500">
                                                Criteria
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">{rubric.criteria}</p>
                                        {rubric.ai_instructions && (
                                            <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-600">
                                                {rubric.ai_instructions}
                                            </p>
                                        )}
                                        {Array.isArray(rubric.level_definitions) && rubric.level_definitions.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {rubric.level_definitions.map((level, index) => (
                                                    <span
                                                        key={`${rubric.rubric_set_id}-history-level-${index}`}
                                                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600"
                                                    >
                                                        {formatLevelLabel(level)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex justify-end">
                                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                                                Saved
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ViewHistoryCard;
