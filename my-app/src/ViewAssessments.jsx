import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacherRecords } from './hooks/useTeacherRecords';

const ViewAssessments = ({ compact = false }) => {
    const navigate = useNavigate();
    const { assessments, rubrics, loading, statusMessage } = useTeacherRecords();
    const [activePanel, setActivePanel] = React.useState('assessments');
    const activeAssessments = assessments.filter(
        (assessment) => (assessment.assessment_status || assessment.status || 'Draft') !== 'Graded'
    );

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
            {!compact && (
                <section className="page-hero-card p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">View</p>
                            <h2 className="text-lg font-semibold text-slate-900">
                                {activePanel === 'assessments' ? 'Assessments' : 'Rubrics'}
                            </h2>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            <button
                                type="button"
                                onClick={() => setActivePanel('assessments')}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                    activePanel === 'assessments'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Assessments ({activeAssessments.length})
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

                    {loading && (
                        <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-blue-600">
                            {activePanel === 'assessments' ? 'Loading...' : 'Syncing...'}
                        </div>
                    )}

                    {statusMessage && !loading ? (
                        <p className="mt-2 text-sm text-rose-600">{statusMessage}</p>
                    ) : activePanel === 'assessments' ? (
                        <div className="teacher-scrollbar mt-3 max-h-[calc(100vh-300px)] space-y-2 overflow-y-auto pr-1">
                            {activeAssessments.length === 0 && !loading ? (
                                <p className="teacher-float-card px-4 py-4 text-sm text-slate-500">
                                    No active assessments yet. Use "View All" to see completed work.
                                </p>
                            ) : (
                                activeAssessments.map((assessment) => (
                                    <article
                                        key={assessment.exercise_id}
                                        className="teacher-float-card p-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                                                    {assessment.subject}
                                                </p>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {assessment.title}
                                                </p>
                                            </div>
                                            <span className={renderStatusBadge(assessment.assessment_status || assessment.status)}>
                                                {assessment.assessment_status || assessment.status || 'Draft'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-slate-600">{assessment.description}</p>
                                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{assessment.topic || '—'}</span>
                                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{assessment.difficulty || 'Medium'}</span>
                                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{assessment.item_count ?? assessment.items?.length ?? 0} items</span>
                                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{formatDate(assessment.date_created)}</span>
                                            {assessment.due_date && (() => {
                                                const now = new Date();
                                                const due = new Date(assessment.due_date);
                                                if (Number.isNaN(due.getTime())) return null;
                                                const diffMs = due.getTime() - now.getTime();
                                                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                                                let cls = 'bg-blue-50 text-blue-700';
                                                let label = `Due in ${diffDays}d`;
                                                if (diffDays < 0) { cls = 'bg-red-50 text-red-700'; label = 'Overdue'; }
                                                else if (diffDays === 0) { cls = 'bg-amber-50 text-amber-700'; label = 'Due today'; }
                                                else if (diffDays <= 3) { cls = 'bg-orange-50 text-orange-700'; }
                                                return (
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>
                                                );
                                            })()}
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="teacher-scrollbar mt-3 max-h-[calc(100vh-300px)] space-y-2 overflow-y-auto pr-1">
                            {rubrics.length === 0 && !loading ? (
                                <p className="teacher-float-card px-4 py-4 text-sm text-slate-500">No rubrics saved yet.</p>
                            ) : (
                                rubrics.map((rubric) => (
                                    <article
                                        key={rubric.rubric_set_id}
                                        className="teacher-float-card p-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {rubric.rubric_name}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {formatDate(rubric.created_at)}
                                                </p>
                                            </div>
                                            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                                                Criteria
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-slate-600">{rubric.criteria}</p>
                                        {rubric.ai_instructions && (
                                            <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-2.5 py-2">
                                                <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-blue-600">
                                                    AI Instructions
                                                </p>
                                                <p className="mt-1 text-xs text-slate-600">{rubric.ai_instructions}</p>
                                            </div>
                                        )}
                                        {Array.isArray(rubric.level_definitions) && rubric.level_definitions.length > 0 && (
                                            <div className="mt-2">
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {rubric.level_definitions.map((level, index) => (
                                                <span
                                                    key={`${rubric.rubric_set_id}-level-${index}`}
                                                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                                        >
                                                            {formatLevelLabel(level)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="mt-3 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    navigate('/teacher/assessments/new-rubric', {
                                                        state: { editingRubric: rubric },
                                                    })
                                                }
                                                className="rounded-full bg-blue-600 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white shadow-sm transition hover:bg-blue-700"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>
                    )}
                </section>
            )}

            {compact && (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">View</p>
            <h3 className="text-base font-semibold text-slate-900">Assessments & rubrics</h3>
            <p className="text-xs text-slate-500">Tap 'View All' to inspect every assessment and rubric you created.</p>
        </div>
    )}

            {compact && statusMessage && (
                <p className="text-xs text-rose-500">{statusMessage}</p>
            )}
        </div>
    );
};

export default ViewAssessments;
