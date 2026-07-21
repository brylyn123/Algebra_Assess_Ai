import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from './axiosClient';
import { API_BASE_URL } from './apiBase';
import { loadSubjects, saveSubjects } from './subjectsStore';
import { findLocalUser, getCurrentLocalUserEmail, storeLocalUser } from './localAuthStore';
import { getSubjectCardTheme } from './subjectCardThemes';
import { useTeacherRecords } from './hooks/useTeacherRecords';

const SEMESTER_OPTIONS = ['1st Semester', '2nd Semester', 'Summer'];
const YEAR_DROPDOWN_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SECTION_OPTIONS = ['A', 'B', 'C'];

const buildLocalSchoolYearFallbacks = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const startYear = month >= 6 ? year : year - 1;

    return [
        `${startYear - 1}-${startYear}`,
        `${startYear}-${startYear + 1}`,
        `${startYear + 1}-${startYear + 2}`,
    ];
};

const ManageSubjects = () => {
    const [subjects, setSubjects] = useState([]);
    const [newSubject, setNewSubject] = useState({
        name: '',
        courseId: '',
        yearId: '',
        sectionId: '',
        schoolYear: '',
        semester: ''
    });
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [editingSubject, setEditingSubject] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [toast, setToast] = useState(null);
    const [copiedJoinCode, setCopiedJoinCode] = useState(null);
    const [subjectEnrollments, setSubjectEnrollments] = useState({});
    const toastTimer = useRef(null);
    const [toastVisible, setToastVisible] = useState(false);
    const currentTeacherEmail = getCurrentLocalUserEmail();
    const storedTeacher = currentTeacherEmail ? findLocalUser(currentTeacherEmail) : null;
    const teacherId = storedTeacher?.user_id ?? storedTeacher?.teacher_id ?? storedTeacher?.id;
    const [subjectFilters, setSubjectFilters] = useState({
        years: [],
        sections: [],
        schoolYears: [],
        semesters: []
    });
    const [registrationOptions, setRegistrationOptions] = useState({
        courses: [],
        sections: [],
        years: []
    });
    const [showArchivedSubjects, setShowArchivedSubjects] = useState(false);
    const [showAddSubjectForm, setShowAddSubjectForm] = useState(false);
    const { assessments } = useTeacherRecords();

    const showToast = (message, variant = 'default', details = null) => {
        setToast({ message, variant, details });
        setToastVisible(true);
        if (toastTimer.current) {
            clearTimeout(toastTimer.current);
        }
        toastTimer.current = setTimeout(() => {
            setToastVisible(false);
            setTimeout(() => setToast(null), 220);
        }, 3200);
    };

    const closeToast = () => {
        if (!toast) return;
        setToastVisible(false);
        if (toastTimer.current) {
            clearTimeout(toastTimer.current);
        }
        setTimeout(() => setToast(null), 220);
    };

    const copyJoinCode = async (code) => {
        if (!code || !navigator?.clipboard?.writeText) {
            return;
        }
        try {
            await navigator.clipboard.writeText(code);
            setCopiedJoinCode(code);
            setTimeout(() => setCopiedJoinCode((prev) => (prev === code ? null : prev)), 2200);
        } catch (error) {
            console.error('Copy failed', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewSubject(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleAddSubject = async (e) => {
        e.preventDefault();

        // If teacherId is not available locally, try to recover session from the server
        let resolvedTeacherId = teacherId;
        if (!resolvedTeacherId) {
            try {
                const sessionResp = await axios.get(`${API_BASE_URL}/session.php`);
                if (sessionResp?.data?.status === 'success' && sessionResp.data.user) {
                    // Save minimal server user into local storage so other parts of the app can read it
                    // Importing storeLocalUser at top is required for this to work
                    try {
                        storeLocalUser(sessionResp.data.user);
                    } catch (err) {
                        // ignore if storeLocalUser is not available or fails
                        console.warn('Could not store server session locally', err);
                    }

                    resolvedTeacherId = sessionResp.data.user.user_id ?? sessionResp.data.user.id ?? resolvedTeacherId;
                }
            } catch (err) {
                console.warn('Session recover failed', err);
            }
        }

        if (!resolvedTeacherId) {
            showToast('Teacher ID missing. Please log in again.', 'error');
            return;
        }

        if (!newSubject.name || !newSubject.courseId || !newSubject.yearId || !newSubject.sectionId || !newSubject.schoolYear || !newSubject.semester) {
            showToast('Please fill out all fields before adding a subject.');
            return;
        }

        setIsAdding(true);

        const payload = {
            subject_name: newSubject.name,
            course_id: Number(newSubject.courseId),
            year_id: Number(newSubject.yearId),
            section_id: Number(newSubject.sectionId),
            school_year: newSubject.schoolYear,
            semester: newSubject.semester,
            teacher_id: resolvedTeacherId
        };

        console.log('Adding subject payload:', payload);

        try {
            const response = await axios.post(`${API_BASE_URL}/add_subject.php`, payload);
            const responseData = response.data || {};

            console.log('Add subject response:', response.status, responseData);

            if (responseData.status === 'success') {
                showToast(`"${newSubject.name}" added!`, 'success', {
                    joinCode: responseData.join_code ?? 'Not Set'
                });
                setNewSubject({ name: '', courseId: '', yearId: '', sectionId: '', schoolYear: '', semester: '' });
                fetchSubjects();
            } else {
                console.error('Add subject failed', responseData);
                const errorMessage = responseData.message || 'Error adding subject.';
                showToast(errorMessage, 'error', responseData);
            }
        } catch (error) {
            console.error('Connection Error adding subject:', error);
            if (error?.response?.data) {
                const serverData = error.response.data;
                if (typeof serverData === 'string') {
                    showToast(`Server error: ${serverData.substring(0, 200)}`, 'error');
                } else {
                    const serverMsg = serverData.message || JSON.stringify(serverData);
                    showToast(`Server error: ${serverMsg}`, 'error');
                }
            } else {
                showToast('Could not connect to the server.', 'error');
            }
        } finally {
            setIsAdding(false);
        }
    };

    const normalizeSubject = (raw) => ({
        // Use the exact column names from your phpMyAdmin screenshot
        id: raw.subject_id,
        name: raw.subject_name, // This matches "subject_name" in DB
        courseId: raw.course_id ?? '',
        yearId: raw.year_id ?? '',
        sectionId: raw.section_id ?? '',
        course: raw.course ?? '',
        year: raw.year ?? '',
        section: raw.section ?? '',
        schoolYear: raw.school_year ?? '',
        semester: raw.semester ?? '',
        joinCode: raw.join_code ?? 'Not Set', // Handles NULL and makes the field visible
        archived: Boolean(raw.archived),
        studentCount: 0,
        activeAssessments: 0
    });

    const fetchSubjects = useCallback(async () => {
        try {
            // Ensure you are passing the teacherId in the URL as a query parameter
            const response = await axios.get(`${API_BASE_URL}/get_subjects.php?teacher_id=${teacherId}`);

            // Change this line to look for 'subjects' inside the response object
            const subjectsSource = Array.isArray(response.data.subjects)
                ? response.data.subjects
                : Array.isArray(response.data)
                    ? response.data
                    : [];
            const normalized = subjectsSource.map(normalizeSubject);
            console.log("Normalized Subjects for UI:", normalized);
            setSubjects(normalized);
        } catch (error) {
            console.error("Error fetching subjects:", error);
        }
    }, [teacherId]);

    const fetchEnrollments = useCallback(async () => {
        if (!teacherId) {
            setSubjectEnrollments({});
            return;
        }
        try {
            const response = await axios.get(`${API_BASE_URL}/get_enrollments.php`, {
                params: { teacher_id: teacherId },
            });
            const enrollments = Array.isArray(response.data.enrollments) ? response.data.enrollments : [];
            const map = {};
            enrollments.forEach((entry) => {
                if (!entry || !entry.subject_id) return;
                map[entry.subject_id] = Array.isArray(entry.students)
                    ? entry.students
                    : [];
            });
            setSubjectEnrollments(map);
        } catch (error) {
            console.error('Error fetching enrollments:', error);
        }
    }, [teacherId]);

    // 3. Load subjects on mount
    useEffect(() => {
        if (!teacherId) {
            console.warn('Teacher ID is missing; subjects cannot be loaded.');
            setSubjects([]);
            return;
        }
        const stored = loadSubjects(teacherId);
        if (stored.length > 0) {
            setSubjects(stored);
        }
        fetchSubjects();
    }, [fetchSubjects, teacherId]);

    useEffect(() => {
        fetchEnrollments();
    }, [fetchEnrollments]);

    useEffect(() => {
        let isMounted = true;

        const loadRegistrationOptions = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/get_registration_options.php`);
                const data = response.data || {};
                if (!isMounted || data.status !== 'success') {
                    return;
                }

                setRegistrationOptions({
                    courses: Array.isArray(data.courses) ? data.courses : [],
                    sections: Array.isArray(data.sections) ? data.sections : [],
                    years: Array.isArray(data.years) ? data.years : []
                });
            } catch (error) {
                console.error('Failed to load registration options:', error);
            }
        };

        loadRegistrationOptions();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!teacherId) {
            return undefined;
        }

        const intervalId = setInterval(() => {
            fetchEnrollments();
        }, selectedSubject ? 4000 : 10000);

        return () => clearInterval(intervalId);
    }, [fetchEnrollments, selectedSubject, teacherId]);

    const fetchSubjectFilters = useCallback(async () => {
        if (!teacherId) {
            return;
        }
        try {
            const response = await axios.get(`${API_BASE_URL}/get_subject_filters.php`, {
                params: { teacher_id: teacherId }
            });
            const data = response.data || {};
            setSubjectFilters({
                years: Array.isArray(data.years) ? data.years : [],
                sections: Array.isArray(data.sections) ? data.sections : [],
                schoolYears: Array.isArray(data.school_years) ? data.school_years : [],
                semesters: Array.isArray(data.semesters) ? data.semesters : []
            });
        } catch (error) {
            console.error('Failed to load subject filters:', error);
        }
    }, [teacherId]);

    const fetchArchivedSubjects = useCallback(async () => {
        if (!teacherId) {
            setArchivedSubjects([]);
            return;
        }
        try {
            const response = await axios.get(`${API_BASE_URL}/get_archived_subjects.php`, {
                params: { teacher_id: teacherId }
            });
            const archivedData = Array.isArray(response.data) ? response.data : [];
            const normalizedArchived = archivedData.map(raw => ({
                ...normalizeSubject(raw),
                archived: true
            }));
            setArchivedSubjects(normalizedArchived);
        } catch (error) {
            console.error('Failed to fetch archived subjects:', error);
            setArchivedSubjects([]);
        }
    }, [teacherId]);

    useEffect(() => {
        fetchSubjectFilters();
    }, [fetchSubjectFilters]);

    useEffect(() => {
        fetchArchivedSubjects();
    }, [fetchArchivedSubjects]);

    const handleEditSubject = (subject) => {
        setEditingSubject({
            id: subject.id,
            name: subject.name,
            course: subject.course,
            year: subject.year,
            section: subject.section,
            schoolYear: subject.schoolYear,
            semester: subject.semester,
            joinCode: subject.joinCode
        });
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditingSubject(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSaveEditedSubject = () => {
        if (!editingSubject) return;
        setSubjects(prev =>
            prev.map((item) =>
                item.id === editingSubject.id
                    ? {
                        ...item,
                        name: editingSubject.name,
                        course: editingSubject.course,
                        year: editingSubject.year,
                        section: editingSubject.section,
                        schoolYear: editingSubject.schoolYear,
                        semester: editingSubject.semester,
                    }
                    : item
            )
        );
        showToast(`"${editingSubject.name}" updated.`);
        setEditingSubject(null);
    };

    const [archivedSubjects, setArchivedSubjects] = useState([]);

    const handleArchive = async (subject) => {
        try {
            await axios.post(`${API_BASE_URL}/archive_subject.php`, {
                subject_id: subject.id,
                teacher_id: teacherId
            });
            setSubjects(prev => prev.filter((item) => item.id !== subject.id));
            if (selectedSubject?.id === subject.id) {
                setSelectedSubject(null);
            }
            showToast(`"${subject.name}" archived.`);
            fetchArchivedSubjects();
        } catch (error) {
            console.error('Archive request failed', error);
            showToast('Could not archive the subject.', 'error');
        }
    };


    useEffect(() => {
        if (teacherId) {
            saveSubjects(teacherId, subjects);
        }
    }, [subjects, teacherId]);

    useEffect(() => {
        return () => clearTimeout(toastTimer.current);
    }, []);

    useEffect(() => {
        if (toast?.details?.joinCode) {
            copyJoinCode(toast.details.joinCode);
        } else {
            setCopiedJoinCode(null);
        }
    }, [toast?.details?.joinCode]);

    const normalizedSubjects = Array.isArray(subjects) ? subjects : [];
    const subjectsWithCounts = normalizedSubjects.map((subject) => {
        const enrolledStudents = subjectEnrollments[subject.id] || [];
        return {
            ...subject,
            studentCount: enrolledStudents.length,
        };
    });
    const selectedSubjectRecord = selectedSubject
        ? subjectsWithCounts.find((subject) => subject.id === selectedSubject.id) || selectedSubject
        : null;
    const enrolledList = selectedSubjectRecord ? (subjectEnrollments[selectedSubjectRecord.id] || []) : [];
    const selectedSubjectAssessmentStats = useMemo(() => {
        if (!selectedSubjectRecord) {
            return { pending: 0, graded: 0 };
        }

        const subjectLabel = String(selectedSubjectRecord.name || selectedSubjectRecord.course || '').trim().toLowerCase();
        const matchingAssessments = assessments.filter((assessment) => {
            const assessmentSubject = String(
                assessment.subject || assessment.subject_name || assessment.subject_display || ''
            ).trim().toLowerCase();
            return subjectLabel && assessmentSubject === subjectLabel;
        });

        return matchingAssessments.reduce(
            (acc, assessment) => {
                const status = String(assessment.assessment_status || assessment.status || 'Draft').toLowerCase();
                if (status === 'graded') {
                    acc.graded += 1;
                } else {
                    acc.pending += 1;
                }
                return acc;
            },
            { pending: 0, graded: 0 }
        );
    }, [assessments, selectedSubjectRecord]);

    useEffect(() => {
        if (!selectedSubjectRecord && !editingSubject) {
            return undefined;
        }

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [editingSubject, selectedSubjectRecord]);

    const activeSubjects = subjectsWithCounts;
    const dropdownYearOptions = Array.from(new Set([
        ...registrationOptions.years.map((year) => year.year_level).filter(Boolean),
        ...YEAR_DROPDOWN_OPTIONS,
        ...subjectFilters.years,
        ...normalizedSubjects.map((subject) => subject.year).filter(Boolean),
    ])).filter(Boolean);
    const dropdownSectionOptions = Array.from(new Set([
        ...registrationOptions.sections.map((section) => section.section_name).filter(Boolean),
        ...SECTION_OPTIONS,
        ...subjectFilters.sections,
        ...normalizedSubjects.map((subject) => subject.section).filter(Boolean),
    ])).filter(Boolean);
    const dropdownSchoolYearOptions = Array.from(new Set([
        ...buildLocalSchoolYearFallbacks(),
        ...subjectFilters.schoolYears,
        ...normalizedSubjects.map((subject) => subject.schoolYear).filter(Boolean),
    ])).filter(Boolean);
    const dropdownSemesterOptions = Array.from(new Set([
        ...SEMESTER_OPTIONS,
        ...subjectFilters.semesters,
        ...normalizedSubjects.map((subject) => subject.semester).filter(Boolean),
    ])).filter(Boolean);

    const toastCardStateClass = toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4';
    const overlayOpacityClass = toastVisible ? 'opacity-100' : 'opacity-0';

    const visibleSubjectList = showArchivedSubjects ? archivedSubjects : activeSubjects;
    const subjectListEmptyMessage = showArchivedSubjects
        ? 'No archived subjects match your search yet.'
        : 'No subjects match your search. Add the first class on the left to get started.';

    return (
        <>
            {toast && (
                <div className="fixed inset-0 flex items-center justify-center px-4 py-6 pointer-events-none">
                    {toast.variant === 'success' && (
                        <div
                            className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-none ${overlayOpacityClass}`}
                        />
                    )}
                    <div className="relative w-full max-w-sm pointer-events-auto">
                        <div
                            className={`rounded-[1.75rem] p-5 shadow-[0_25px_60px_rgba(15,23,42,0.3)]
                                border
                                ${toast.variant === 'success' ? 'bg-white border-emerald-100 text-slate-900' : ''}
                                ${toast.variant === 'error' ? 'bg-amber-50 border-amber-200 text-amber-900' : ''}
                                ${toast.variant === 'default' ? 'bg-slate-900 text-white border-transparent' : ''}
                                transition-all duration-400 ease-out ${toastCardStateClass}
                            `}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.4em] font-semibold text-slate-400 mb-1">
                                        {toast.variant === 'success' ? 'Success' : toast.variant === 'error' ? 'Error' : 'Notification'}
                                    </p>
                                    <p className="text-base font-semibold leading-snug">
                                        {toast.message}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeToast}
                                    className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 hover:text-slate-900"
                                >
                                    Close
                                </button>
                            </div>
                            {toast.details?.joinCode && (
                                <div className="mt-4 rounded-2xl bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-100 flex items-center justify-between gap-3">
                                    <span>
                                        Join Code: <span className="font-mono text-slate-900">{toast.details.joinCode}</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => copyJoinCode(toast.details.joinCode)}
                                        className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 hover:text-slate-900"
                                    >
                                        {copiedJoinCode === toast.details.joinCode ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <div className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col gap-3 overflow-hidden px-4 pt-3 sm:px-6 md:px-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="teacher-eyebrow">Subjects</p>
                        <h2 className="teacher-heading">View Subjects</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Browse your classes and jump into enrollment details quickly.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setShowAddSubjectForm(true)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
                        >
                            Add Subject
                        </button>
                    </div>
                </div>

                <div className="inline-flex w-full max-w-[430px] rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowArchivedSubjects(false)}
                        className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                            !showArchivedSubjects
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        Active
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowArchivedSubjects(true)}
                        className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                            showArchivedSubjects
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        Archived ({archivedSubjects.length})
                    </button>
                </div>

                <div className="teacher-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-2 pb-4">
                    {visibleSubjectList.length > 0 ? (
                        visibleSubjectList.map((subject) => {
                            const theme = getSubjectCardTheme(subject);

                            return (
                                <div
                                    key={subject.id}
                                    className={`teacher-float-card p-3 ${theme.surfaceClass}`}
                                >
                                    <div className={`absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r ${theme.accentClass}`} />
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                                                {subject.course || 'Subject'}
                                            </p>
                                            <p className="mt-0.5 text-sm font-bold text-slate-900">{subject.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {subject.course} - {subject.year} - {subject.section}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                                ID {subject.id}
                                            </span>
                                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${theme.badgeClass}`}>
                                                {subject.archived ? 'Archived' : 'Active'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] text-slate-600">
                                            {subject.year} · Sec {subject.section}
                                        </span>
                                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] text-slate-600">
                                            SY {subject.schoolYear}
                                        </span>
                                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] text-slate-600">
                                            {subject.semester}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold ${theme.badgeClass}`}>
                                                {subject.studentCount ?? 0} students
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                fetchEnrollments();
                                                setSelectedSubject(subject);
                                            }}
                                            className="rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-blue-600 transition hover:border-blue-300 hover:bg-blue-50"
                                        >
                                            View enrolled
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="teacher-float-card px-4 py-4 text-center text-sm text-slate-400">
                            {subjectListEmptyMessage}
                        </p>
                    )}

                    {archivedSubjects.length > 0 && !showArchivedSubjects && (
                        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                            {archivedSubjects.length} archived subject(s) hidden.
                        </p>
                    )}
                </div>
            </div>

            {showAddSubjectForm && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-3xl rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_25px_60px_rgba(15,23,42,0.35)] space-y-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm uppercase tracking-[0.4em] text-slate-400 mb-1">Create</p>
                                <h3 className="text-2xl font-bold text-slate-900">Add New Subject</h3>
                                <p className="text-sm text-slate-500">Create a new class and generate a join code for students.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddSubjectForm(false)}
                                className="text-sm font-semibold text-slate-500 hover:text-slate-900"
                            >
                                Cancel
                            </button>
                        </div>
                        <form onSubmit={handleAddSubject} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Subject Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={newSubject.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Algebra 101"
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Course</label>
                                <select
                                    name="courseId"
                                    value={newSubject.courseId}
                                    onChange={handleInputChange}
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                                >
                                    <option value="" disabled hidden>Select course</option>
                                    {registrationOptions.courses.map((courseOption) => (
                                        <option key={courseOption.course_id} value={courseOption.course_id}>
                                            {courseOption.course_code || courseOption.course_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Year</label>
                                    <select
                                        name="yearId"
                                        value={newSubject.yearId}
                                        onChange={handleInputChange}
                                        className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                                    >
                                        <option value="" disabled hidden>Select year</option>
                                        {registrationOptions.years.map((yearOption) => (
                                            <option key={yearOption.year_id} value={yearOption.year_id}>
                                                {yearOption.year_level}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Section</label>
                                    <select
                                        name="sectionId"
                                        value={newSubject.sectionId}
                                        onChange={handleInputChange}
                                        className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                                    >
                                        <option value="" disabled hidden>Select section</option>
                                        {registrationOptions.sections.map((sectionOption) => (
                                            <option key={sectionOption.section_id} value={sectionOption.section_id}>
                                                {sectionOption.section_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">School Year</label>
                                    <select
                                        name="schoolYear"
                                        value={newSubject.schoolYear}
                                        onChange={handleInputChange}
                                        className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                                    >
                                        <option value="" disabled hidden>Select school year</option>
                                        {dropdownSchoolYearOptions.map((schoolYear) => (
                                            <option key={schoolYear} value={schoolYear}>
                                                {schoolYear}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Semester</label>
                                    <select
                                        name="semester"
                                        value={newSubject.semester}
                                        onChange={handleInputChange}
                                        className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                                    >
                                        <option value="" disabled hidden>Select semester</option>
                                        {dropdownSemesterOptions.map((semester) => (
                                            <option key={semester} value={semester}>
                                                {semester}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddSubjectForm(false)}
                                    className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                                >
                                    {isAdding ? 'Adding...' : 'Add Subject'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {selectedSubjectRecord && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-5xl max-h-[calc(100vh-4rem)] overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-8 shadow-[0_25px_60px_rgba(15,23,42,0.35)]">
                        <div className="teacher-scrollbar flex h-full min-h-0 flex-col gap-8 overflow-y-auto pr-2">
                        <div className="flex flex-col gap-6 pt-1 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                                <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Enrollment</p>
                                <h3 className="text-3xl font-bold text-slate-900">{selectedSubjectRecord.name}</h3>
                                <p className="text-lg text-slate-600">{selectedSubjectRecord.course}</p>
                                <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                                    <span>{selectedSubjectRecord.year} · {selectedSubjectRecord.section}</span>
                                    <span>SY {selectedSubjectRecord.schoolYear}</span>
                                    <span>{selectedSubjectRecord.semester}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span>
                                        Join Code: <span className="font-mono text-slate-700">{selectedSubjectRecord.joinCode}</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => copyJoinCode(selectedSubjectRecord.joinCode)}
                                        className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500 hover:text-slate-900"
                                    >
                                        {copiedJoinCode === selectedSubjectRecord.joinCode ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col items-stretch gap-2 lg:min-w-[260px] lg:items-end">
                                <button
                                    type="button"
                                    onClick={() => setSelectedSubject(null)}
                                    className="w-full rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 lg:w-auto"
                                >
                                    Close
                                </button>
                                <div className="flex flex-wrap justify-end gap-2">
                                    {!selectedSubjectRecord.archived && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleEditSubject(selectedSubjectRecord)}
                                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleArchive(selectedSubjectRecord);
                                                    setSelectedSubject(null);
                                                }}
                                                className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-600 transition hover:bg-amber-100"
                                            >
                                                Archive
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="teacher-stat-card teacher-stat-card-blue">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">Enrolled</p>
                                    <p className="mt-1 text-2xl font-black leading-none text-white">{enrolledList.length}</p>
                                </div>
                                <div className="mt-2">
                                    <p className="text-xs font-bold text-white">Students currently in this subject</p>
                                </div>
                            </div>
                            <div className="teacher-stat-card teacher-stat-card-amber">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">Pending</p>
                                    <p className="mt-1 text-2xl font-black leading-none text-white">{selectedSubjectAssessmentStats.pending}</p>
                                </div>
                                <div className="mt-2">
                                    <p className="text-xs font-bold text-white">Awaiting review</p>
                                </div>
                            </div>
                            <div className="teacher-stat-card teacher-stat-card-emerald">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">Graded</p>
                                    <p className="mt-1 text-2xl font-black leading-none text-white">{selectedSubjectAssessmentStats.graded}</p>
                                </div>
                                <div className="mt-2">
                                    <p className="text-xs font-bold text-white">Already graded</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">Students</p>
                                <p className="text-xs text-slate-500">{enrolledList.length} recorded</p>
                            </div>
                            {enrolledList.length > 0 ? (
                                <div className="teacher-scrollbar grid max-h-[40vh] gap-3 overflow-y-auto pr-2">
                                    {enrolledList.map((student) => (
                                        <div
                                            key={student.enrollment_id ?? student.student_id}
                                        className="rounded-[1.4rem] border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                                        >
                                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-base font-bold text-slate-900">
                                                        {student.student_name || student.student_id}
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                                        <span>ID {student.student_id}</span>
                                                        <span>Enrolled {student.date_enrolled ?? '—'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
                                                        {student.enrollment_status || 'enrolled'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-2xl bg-white/80 p-8 text-center text-sm text-slate-400">
                                    No enrolled students recorded yet.
                                </div>
                            )}
                        </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {editingSubject && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-3xl rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_25px_60px_rgba(15,23,42,0.35)] space-y-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm uppercase tracking-[0.4em] text-slate-400 mb-1">Edit Subject</p>
                                <h3 className="text-2xl font-bold text-slate-900">{editingSubject.name}</h3>
                                <p className="text-xs text-slate-500">Join Code: <span className="font-mono text-slate-700">{editingSubject.joinCode}</span></p>
                            </div>
                            <button
                                onClick={() => setEditingSubject(null)}
                                className="text-sm font-semibold text-slate-500 hover:text-slate-900"
                            >
                                Cancel
                            </button>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.4em] mb-2">Subject Name</label>
                                <input
                                    name="name"
                                    value={editingSubject.name}
                                    onChange={handleEditInputChange}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.4em] mb-2">Course</label>
                                <input
                                    name="course"
                                    value={editingSubject.course}
                                    onChange={handleEditInputChange}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.4em] mb-2">Year</label>
                                <select
                                    name="year"
                                    value={editingSubject.year}
                                    onChange={handleEditInputChange}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700"
                                >
                                    <option value="" disabled hidden>Select year</option>
                                    {dropdownYearOptions.map((yearOption) => (
                                        <option key={yearOption} value={yearOption}>
                                            {yearOption}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.4em] mb-2">Section</label>
                                <select
                                    name="section"
                                    value={editingSubject.section}
                                    onChange={handleEditInputChange}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700"
                                >
                                    <option value="" disabled hidden>Select section</option>
                                    {dropdownSectionOptions.map((sectionOption) => (
                                        <option key={sectionOption} value={sectionOption}>
                                            {sectionOption}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.4em] mb-2">School Year</label>
                                <select
                                    name="schoolYear"
                                    value={editingSubject.schoolYear}
                                    onChange={handleEditInputChange}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700"
                                >
                                    <option value="" disabled hidden>Select school year</option>
                                    {dropdownSchoolYearOptions.map((schoolYear) => (
                                        <option key={schoolYear} value={schoolYear}>
                                            {schoolYear}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.4em] mb-2">Semester</label>
                                <select
                                    name="semester"
                                    value={editingSubject.semester}
                                    onChange={handleEditInputChange}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700"
                                >
                                    <option value="" disabled hidden>Select semester</option>
                                    {dropdownSemesterOptions.map((semester) => (
                                        <option key={semester} value={semester}>
                                            {semester}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setEditingSubject(null)}
                                className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEditedSubject}
                                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-white shadow-lg shadow-blue-200 hover:bg-blue-700"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default ManageSubjects;
