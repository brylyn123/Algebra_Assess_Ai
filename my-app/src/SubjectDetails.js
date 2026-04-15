import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from './axiosClient';
import { getSubjectCardTheme } from './subjectCardThemes';

const SubjectDetails = () => {
    const { id } = useParams(); // Grabs the ID from the URL
    const [subjectData, setSubjectData] = useState(null);

    useEffect(() => {
        const fetchSubjectInfo = async () => {
            try {
                // Fetch only the details for THIS specific subject
                const response = await axios.get(`http://localhost/Algebra_Assess_Ai/algebra-api/get_single_subject.php?id=${id}`);
                setSubjectData(response.data);
            } catch (error) {
                console.error("Error fetching subject details:", error);
            }
        };

        fetchSubjectInfo();
    }, [id]);

    if (!subjectData) return <p>Loading subject details...</p>;

    const theme = getSubjectCardTheme(subjectData);

    return (
        <div className="p-8">
            <div className={`relative overflow-hidden rounded-[1.8rem] border p-6 shadow-sm ${theme.surfaceClass}`}>
                <div className={`absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r ${theme.accentClass}`} />
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.35em] text-slate-400">Subject</p>
                        <h1 className="mt-2 text-3xl font-black text-slate-900">{subjectData.subject_name}</h1>
                        <p className="mt-2 text-sm text-slate-600">{subjectData.course}</p>
                    </div>
                    <div className={`rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm ${theme.chipClass}`}>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Enrollment Code</p>
                        <p className="mt-1 font-mono text-slate-700">{subjectData.enrollment_code}</p>
                    </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${theme.badgeClass}`}>
                        {subjectData.year} - {subjectData.section}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${theme.badgeClass}`}>
                        {subjectData.semester || 'Semester not set'}
                    </span>
                </div>
            </div>
            
            {/* This is where you'll later add your Algebra Assessments */}
            <div className="mt-8">
                <h2 className="text-xl font-semibold">Assessments</h2>
                <button className="mt-2 bg-indigo-500 text-white px-4 py-2 rounded">
                    + Create New Assessment
                </button>
            </div>
        </div>
    );
};

export default SubjectDetails;
