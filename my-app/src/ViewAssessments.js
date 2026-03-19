import React from 'react';

// Dummy assessment data
const assessments = [
    { id: 1, title: 'Quiz 1', subject: 'Algebra' },
    { id: 2, title: 'Midterm Exam', subject: 'Geometry' },
    { id: 3, title: 'Final Exam', subject: 'Calculus' }
];

const ViewAssessments = () => {
    return (
        <div>
            <h2>Existing Assessments</h2>
            <ul>
                {assessments.map(assessment => (
                    <li key={assessment.id}>
                        {assessment.title} - {assessment.subject}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ViewAssessments;