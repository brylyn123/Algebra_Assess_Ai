import React from 'react';
import { useNavigate } from 'react-router-dom';
import ViewAssessments from './ViewAssessments';

const ViewAssessmentsPage = () => {
    const navigate = useNavigate();
    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        navigate('/teacher/assessments');
    };

    return (
        <div className="p-4 md:p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Overview</p>
                    <h1 className="text-3xl font-bold text-slate-900">Assessments & Rubrics</h1>
                    <p className="mt-1 text-sm text-slate-500">Review everything you created for teaching.</p>
                </div>
                <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-600 bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-sm transition hover:border-blue-700 hover:bg-blue-700"
                >
                    <span aria-hidden="true">←</span>
                    Back to Assessments
                </button>
            </div>
            <ViewAssessments />
        </div>
    );
};

export default ViewAssessmentsPage;
