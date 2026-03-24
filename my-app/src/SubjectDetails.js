import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from './axiosClient';

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

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-blue-700">{subjectData.subject_name}</h1>
            <div className="mt-4 bg-white p-6 rounded-xl shadow-sm">
                <p><strong>Course:</strong> {subjectData.course}</p>
                <p><strong>Year & Section:</strong> {subjectData.year} - {subjectData.section}</p>
                <p><strong>Enrollment Code:</strong> {subjectData.enrollment_code}</p>
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
