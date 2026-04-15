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
        <div className="h-full min-h-0 overflow-hidden px-4 py-4 md:px-6 md:py-5">
            <div className="mx-auto flex h-full min-h-0 max-w-[1400px] flex-col gap-8 pb-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-2">
                        <p className="teacher-eyebrow">Overview</p>
                        <h1 className="teacher-heading">Assessments & Rubrics</h1>
                        <p className="text-sm text-slate-500">Review everything you created for teaching.</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleBack}
                        className="teacher-secondary-btn"
                    >
                        Back to Assessments
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                    <ViewAssessments />
                </div>
            </div>
        </div>
    );
};

export default ViewAssessmentsPage;
