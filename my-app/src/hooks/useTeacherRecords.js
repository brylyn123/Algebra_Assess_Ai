import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../axiosClient';
import { findLocalUser, getCurrentLocalUserEmail } from '../localAuthStore';

const baseUrl = 'http://localhost/Algebra_Assess_Ai/algebra-api';

export const useTeacherRecords = () => {
    const currentEmail = getCurrentLocalUserEmail();
    const teacherUser = useMemo(() => {
        if (!currentEmail) return null;
        return findLocalUser(currentEmail);
    }, [currentEmail]);
    const teacherId = teacherUser?.teacher_id ?? teacherUser?.user_id ?? teacherUser?.id ?? null;

    const [assessments, setAssessments] = useState([]);
    const [rubrics, setRubrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [refreshIndex, setRefreshIndex] = useState(0);

    const refreshRecords = useCallback(() => {
        setRefreshIndex((prev) => prev + 1);
    }, []);

    useEffect(() => {
        if (!teacherId) {
            setStatusMessage('Log in as a teacher to see your assessments and rubrics.');
            setAssessments([]);
            setRubrics([]);
            setLoading(false);
            return;
        }

        let isMounted = true;
        const controller = new AbortController();

        const fetchData = async () => {
            setLoading(true);
            setStatusMessage('');
            try {
                const [assessmentRes, rubricRes] = await Promise.all([
                axios.get(`${baseUrl}/get_assessments.php`, {
                        params: { teacher_id: teacherId },
                        signal: controller.signal,
                    }),
                    axios.get(`${baseUrl}/get_rubric_sets.php`, {
                        params: { teacher_id: teacherId },
                        signal: controller.signal,
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
                if ((axios.isCancel?.(error) || error.name === 'CanceledError') || !isMounted) {
                    return;
                }
                console.error('Failed to load assessments or rubrics:', error);
                setStatusMessage(error.message || 'Failed to load assessments and rubrics.');
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [teacherId, refreshIndex]);

    const deleteAssessment = useCallback(
        async (exerciseId) => {
            if (!teacherId) {
                alert('Log in as a teacher to delete assessments.');
                return;
            }
            try {
                await axios.post(
                    `${baseUrl}/delete_assessment.php`,
                    { teacher_id: teacherId, exercise_id: exerciseId },
                    { headers: { 'Content-Type': 'application/json' } }
                );
                refreshRecords();
            } catch (error) {
                console.error('Failed to delete assessment:', error);
                alert('Unable to delete assessment at this time.');
            }
        },
        [teacherId, refreshRecords]
    );

    const deleteRubric = useCallback(
        async (rubricSetId) => {
            if (!teacherId) {
                alert('Log in as a teacher to delete rubrics.');
                return;
            }
            try {
                await axios.post(
                    `${baseUrl}/delete_rubric_set.php`,
                    { teacher_id: teacherId, rubric_set_id: rubricSetId },
                    { headers: { 'Content-Type': 'application/json' } }
                );
                refreshRecords();
            } catch (error) {
                console.error('Failed to delete rubric:', error);
                alert('Unable to delete rubric right now.');
            }
        },
        [teacherId, refreshRecords]
    );

    return {
        assessments,
        rubrics,
        loading,
        statusMessage,
        refreshRecords,
        deleteAssessment,
        deleteRubric,
    };
};
