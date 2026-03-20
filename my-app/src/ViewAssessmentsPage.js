import React from 'react';
import { useNavigate } from 'react-router-dom';
import ViewAssessments from './ViewAssessments';

const ViewAssessmentsPage = () => {
    const navigate = useNavigate();

    return (
        <div className="p-4 md:p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Overview</p>
                    <h1 className="text-3xl font-bold text-slate-900">Assessments & Rubrics</h1>
                    <p className="mt-1 text-sm text-slate-500">Review everything you created for teaching.</p>
                </div>
                <button
                    onClick={() => navigate('/teacher/assessments')}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 hover:border-slate-300"
                >
                    Back
                </button>
            </div>
            <ViewAssessments />
        </div>
    );
};

export default ViewAssessmentsPage;
