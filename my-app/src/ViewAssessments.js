import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacherRecords } from './hooks/useTeacherRecords';

const ViewAssessments = ({ compact = false }) => {
    const navigate = useNavigate();
    const { assessments, rubrics, loading, statusMessage } = useTeacherRecords();
    const activeAssessments = assessments.filter((assessment) => assessment.assessment_status !== 'Graded');

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
        <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">View</p>
                        <h2 className="text-2xl font-semibold text-slate-900">Assessments</h2>
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
                    <div className="mt-4 grid gap-4">
                        {activeAssessments.length === 0 && !loading ? (
                            <p className="text-sm text-slate-500">
                                No active assessments yet. Use "View All" to see completed work.
                            </p>
                        ) : (
                            activeAssessments.map((assessment) => (
                                <article
                                    key={assessment.exercise_id}
                                    className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4"
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
                                        <span className={renderStatusBadge(assessment.assessment_status)}>
                                            {assessment.assessment_status || 'Draft'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600">{assessment.description}</p>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                        <span>Topic: {assessment.topic || '—'}</span>
                                        <span>Created: {formatDate(assessment.date_created)}</span>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                )}
            </section>

            <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">View</p>
                        <h2 className="text-2xl font-semibold text-slate-900">Rubrics</h2>
                    </div>
                    {loading && (
                        <span className="text-xs font-semibold uppercase tracking-[0.4em] text-blue-600">
                            Syncing...
                        </span>
                    )}
                </div>
                {statusMessage && !loading ? (
                    <p className="mt-4 text-sm text-rose-600">{statusMessage}</p>
                ) : (
                    <div className="mt-4 grid gap-4">
                        {rubrics.length === 0 && !loading ? (
                            <p className="text-sm text-slate-500">No rubrics saved yet.</p>
                        ) : (
                            rubrics.map((rubric) => (
                                <article
                                    key={rubric.rubric_set_id}
                                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
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
        </div>
    );
};

export default ViewAssessments;
