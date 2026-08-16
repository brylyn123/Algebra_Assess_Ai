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
        navigate('/teacher/grade-submissions');
    };

    return (
        <div className="h-full min-h-0 overflow-y-auto teacher-scrollbar px-4 py-4 md:px-6 md:py-5">
            <div className="mx-auto flex h-full min-h-0 w-full flex-col gap-8 pb-6">
                <div className="shrink-0 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-4 py-3 mb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                        <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM9 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <h2 className="text-lg font-bold text-white">Assessments & Rubrics</h2>
                            </div>
                            <p className="text-xs text-blue-100 ml-[42px]">Review everything you created for teaching.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleBack}
                            className="inline-flex items-center rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25"
                        >
                            Back to Grade Submissions
                        </button>
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto teacher-scrollbar">
                    <ViewAssessments />
                </div>
            </div>
        </div>
    );
};

export default ViewAssessmentsPage;
