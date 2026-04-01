import React from 'react';
import { useNavigate } from 'react-router-dom';
import ViewAssessments from './ViewAssessments';
import ViewHistoryCard from './ViewHistoryCard';

const ManageAssessments = () => {
    const navigate = useNavigate();

    return (
        <div className="p-4 md:p-8">
            {/* Header Section */}
            <div className="mb-8">
                <p className="text-slate-500 uppercase tracking-[0.3em] text-xs mb-1">
                    Assessments
                </p>
                <h1 className="text-2xl font-bold text-slate-900">Manage Your Work</h1>
            </div>

            {/* Layout Container: This prevents the "squeezed" look */}
            <div className="flex flex-col gap-10">

                {/* Quick actions shown side by side to avoid horizontal scrolling */}
                <div className="grid gap-8 md:grid-cols-3">
                    <div className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 flex flex-col text-center transition-transform hover:scale-[1.02]">
                        <div className="flex-grow flex flex-col items-center justify-center space-y-4 mb-6">
                            <span className="text-5xl">📄</span>
                            <h2 className="text-xl font-bold text-slate-900">New Assessment</h2>
                            <p className="text-slate-500">
                                Create a new quiz, homework, or exam.
                            </p>
                        </div>

                        {/* Fixed Button: Removed the nested buttons that caused errors */}
                        <button
                            onClick={() => navigate('/teacher/assessments/new')}
                            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-md hover:bg-blue-700 transition"
                        >
                            + Start New Assessment
                        </button>
                    </div>
                    {/* 1. New Rubric Section */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 flex flex-col text-center transition-transform hover:scale-[1.02]">
                        <div className="flex-grow flex flex-col items-center justify-center space-y-4 mb-6">
                            <span className="text-5xl">✏️</span>
                            <h2 className="text-xl font-bold text-slate-900">New Rubric</h2>
                            <p className="text-slate-500">
                                Create a new rubric for grading assessments.
                            </p>
                        </div>
                        {/* Button to navigate to the new rubric creation page */}
                        <button
                            onClick={() => navigate('/teacher/assessments/new-rubric')}
                            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-md hover:bg-emerald-700 transition"
                        >
                            + Start New Rubric
                        </button>
                    </div>
                    {/* 2. View Assessments Section */}
                    <div className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 transition-transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quick Glance</p>
                                <h2 className="text-xl font-bold text-slate-900">View Assessments & Rubrics</h2>
                            </div>
                        </div>
                        <ViewAssessments compact />
                        <div className="mt-4">
                            <button
                                onClick={() => navigate('/teacher/assessments/view')}
                                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-md hover:bg-indigo-700 transition"
                            >
                                View All
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-10">
                    <ViewHistoryCard maxHeight="280px" />
                </div>

            </div>
        </div>
    );
};

export default ManageAssessments;

