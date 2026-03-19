import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const baseUrl = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const ViewAssessments = ({ compact = false }) => {
    const [assessments, setAssessments] = useState([]);
    const [rubrics, setRubrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const currentEmail = getCurrentLocalUserEmail();
    const teacherUser = useMemo(() => {
        if (!currentEmail) return null;
        return findLocalUser(currentEmail);
    }, [currentEmail]);
    const teacherId = teacherUser?.teacher_id ?? teacherUser?.user_id ?? teacherUser?.id ?? null;

    useEffect(() => {
        if (!teacherId) {
            setStatusMessage('Log in as a teacher to see your assessments and rubrics.');
            setAssessments([]);
            setRubrics([]);
            setLoading(false);
            return;
        }

        let isMounted = true;
        const cancelToken = axios.CancelToken.source();
        const fetchData = async () => {
            setLoading(true);
            setStatusMessage('');
            try {
                const [assessmentRes, rubricRes] = await Promise.all([
                    axios.get(`${baseUrl}/get_assessments.php`, {
                        params: { teacher_id: teacherId },
                        cancelToken: cancelToken.token,
                    }),
                    axios.get(`${baseUrl}/get_rubric_sets.php`, {
                        params: { teacher_id: teacherId },
                        cancelToken: cancelToken.token,
                    }),
                ]);
                if (assessmentRes.data.status !== 'success' || rubricRes.data.status !== 'success') {
                    throw new Error('Unable to load assessments and rubrics right now.');
                }
                if (isMounted) {
                    setAssessments(assessmentRes.data.assessments || []);
                    setRubrics(rubricRes.data.rubrics || []);
                }
            } catch (error) {
                if (!axios.isCancel(error) && isMounted) {
                    console.error('Failed to load assessments or rubrics:', error);
                    setStatusMessage(error.message || 'Failed to load assessments and rubrics.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
            cancelToken.cancel('Component unmounted');
        };
    }, [teacherId]);

    const formatDate = (value) => {
        if (!value) return '—';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return value;
        }
        return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    if (compact) {
        const renderList = (items, emptyMessage) => (
            <div className="space-y-3">
                {items.length === 0 ? (
                    <p className="text-xs text-slate-400">{emptyMessage}</p>
                ) : (
                    items.slice(0, 3).map((item) => (
                        <div key={item.exercise_id ?? item.rubric_set_id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-sm font-semibold text-slate-900">{item.title ?? item.rubric_name}</p>
                            <p className="text-xs text-slate-500">
                                {item.subject ?? item.criteria}
                            </p>
                        </div>
                    ))
                )}
            </div>
        );

        return (
            <div className="space-y-4 text-sm">
                <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Assessments</p>
                    <h3 className="text-base font-semibold text-slate-900">Latest</h3>
                    {renderList(assessments, 'No assessments saved yet.')}
                </div>
                <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Rubrics</p>
                    <h3 className="text-base font-semibold text-slate-900">Saved</h3>
                    {renderList(rubrics, 'No rubrics saved yet.')}
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
                        {assessments.length === 0 && !loading ? (
                            <p className="text-sm text-slate-500">No assessments yet.</p>
                        ) : (
                            assessments.map((assessment) => (
                                <article
                                    key={assessment.exercise_id}
                                    className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4"
                                >
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                                            {assessment.subject}
                                        </p>
                                        <h3 className="text-lg font-semibold text-slate-900">
                                            {assessment.title}
                                        </h3>
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
