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
        <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
            {!compact && (
                <section className="page-hero-card p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">View</p>
                            <h2 className="text-2xl font-semibold text-slate-900">
                                {activePanel === 'assessments' ? 'Assessments' : 'Rubrics'}
                            </h2>
                        </div>
                        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                            <button
                                type="button"
                                onClick={() => setActivePanel('assessments')}
                                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
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

                    {loading && (
                        <div className="mt-4 text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">
                            {activePanel === 'assessments' ? 'Loading...' : 'Syncing...'}
                        </div>
                    )}

                    {statusMessage && !loading ? (
                        <p className="mt-4 text-sm text-rose-600">{statusMessage}</p>
                    ) : activePanel === 'assessments' ? (
                        <div className="teacher-scrollbar mt-4 grid max-h-[calc(100vh-360px)] gap-5 overflow-y-auto pr-2">
                            {activeAssessments.length === 0 && !loading ? (
                                <p className="teacher-float-card px-5 py-6 text-sm text-slate-500">
                                    No active assessments yet. Use "View All" to see completed work.
                                </p>
                            ) : (
                                activeAssessments.map((assessment) => (
                                    <article
                                        key={assessment.exercise_id}
                                        className="teacher-float-card flex flex-col gap-3 p-5"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                                                    {assessment.subject}
                                                </p>
                                                <h3 className="text-lg font-semibold text-slate-900">
                                                    {assessment.title}
                                                </h3>
                                            </div>
                                            <span className={renderStatusBadge(assessment.assessment_status || assessment.status)}>
                                                {assessment.assessment_status || assessment.status || 'Draft'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600">{assessment.description}</p>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                            <span>Topic: {assessment.topic || '—'}</span>
                                            <span>Difficulty: {assessment.difficulty || 'Medium'}</span>
                                            <span>Items: {assessment.item_count ?? assessment.items?.length ?? 0}</span>
                                            <span>Created: {formatDate(assessment.date_created)}</span>
                                        </div>
                                        {assessment.ideal_solution && (
                                            <p className="text-xs text-slate-500">
                                                Ideal solution: {assessment.ideal_solution}
                                            </p>
                                        )}
                                    </article>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="teacher-scrollbar mt-4 grid max-h-[calc(100vh-360px)] gap-5 overflow-y-auto pr-2">
                            {rubrics.length === 0 && !loading ? (
                                <p className="teacher-float-card px-5 py-6 text-sm text-slate-500">No rubrics saved yet.</p>
                            ) : (
                                rubrics.map((rubric) => (
                                    <article
                                        key={rubric.rubric_set_id}
                                        className="teacher-float-card p-5"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900">
                                                    {rubric.rubric_name}
                                                </h3>
                                                <p className="text-xs text-slate-500">
                                                    {formatDate(rubric.created_at)}
                                                </p>
                                            </div>
                                            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                                                Criteria
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">{rubric.criteria}</p>
                                        {rubric.ai_instructions && (
                                            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-600">
                                                    AI Instructions
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">{rubric.ai_instructions}</p>
                                            </div>
                                        )}
                                        {Array.isArray(rubric.level_definitions) && rubric.level_definitions.length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                                                    Point Levels
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {rubric.level_definitions.map((level, index) => (
                                                <span
                                                    key={`${rubric.rubric_set_id}-level-${index}`}
                                                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                                                        >
                                                            {formatLevelLabel(level)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {rubric.items && rubric.items.length > 0 && (
                                            <ul className="mt-3 space-y-2 text-sm text-slate-700">
                                                {rubric.items.map((item, index) => (
                                                    <li
                                                        key={`${rubric.rubric_set_id}-${index}`}
                                                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                                                    >
                                                        <span>{item.description}</span>
                                                        <span className="text-xs font-semibold text-slate-500">
                                                            {item.points} pts
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <div className="mt-4 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    navigate('/teacher/assessments/new-rubric', {
                                                        state: { editingRubric: rubric },
                                                    })
                                                }
                                                className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-sm transition hover:bg-blue-700"
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
