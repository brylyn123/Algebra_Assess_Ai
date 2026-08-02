import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from './axiosClient';
import { API_BASE_URL } from './apiBase';
import { loadSubjects, saveSubjects } from './subjectsStore';
import { findLocalUser, getCurrentLocalUserEmail, storeLocalUser } from './localAuthStore';
import { getSubjectCardTheme } from './subjectCardThemes';
import { useTeacherRecords } from './hooks/useTeacherRecords';
import Select from './components/Select';

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
    const [archiveConfirmSubject, setArchiveConfirmSubject] = useState(null);
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
                const sessionResp = await axios.get('/session.php');
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
            const response = await axios.post('/add_subject.php', payload);
            const responseData = response.data || {};

            console.log('Add subject response:', response.status, responseData);

            if (responseData.status === 'success') {
                showToast(`"${newSubject.name}" added!`, 'success', {
                    joinCode: responseData.join_code ?? 'Not Set'
                });
                setNewSubject({ name: '', courseId: '', yearId: '', sectionId: '', schoolYear: '', semester: '' });
                setShowAddSubjectForm(false);
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
            const response = await axios.get(`/get_subjects.php?teacher_id=${teacherId}`);

            // Change this line to look for 'subjects' inside the response object
            const subjectsSource = Array.isArray(response.data.subjects)
                ? response.data.subjects
                : Array.isArray(response.data.data)
                    ? response.data.data
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
            const response = await axios.get('/get_enrollments.php', {
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
                const response = await axios.get('/get_registration_options.php');
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
                const response = await axios.get('/get_subject_filters.php', {
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
                const response = await axios.get('/get_archived_subjects.php', {
                params: { teacher_id: teacherId }
            });
            const archivedData = Array.isArray(response.data.data)
                ? response.data.data
                : Array.isArray(response.data)
                    ? response.data
                    : [];
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
            await axios.post('/archive_subject.php', {
                subject_id: subject.id,
                teacher_id: teacherId
            });
            setSubjects(prev => prev.filter((item) => item.id !== subject.id));
            if (selectedSubject?.id === subject.id) {
                setSelectedSubject(null);
            }
            setArchiveConfirmSubject(null);
            showToast(`"${subject.name}" has been archived successfully.`, 'success', {
                archivedName: subject.name,
                joinCode: subject.joinCode,
                studentCount: subjectEnrollments[subject.id]?.length ?? 0,
                course: subject.course,
                section: subject.section,
            });
            fetchArchivedSubjects();
        } catch (error) {
            console.error('Archive request failed', error);
            showToast('Could not archive the subject. Please try again.', 'error');
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
            {archiveConfirmSubject && (() => {
                const enrollCount = subjectEnrollments[archiveConfirmSubject.id]?.length ?? 0;
                return createPortal((
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
                        onClick={() => setArchiveConfirmSubject(null)}
                    />
                    <div
                        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_40px_100px_rgba(15,23,42,0.25)] ring-1 ring-black/5 animate-[slideUp_0.3s_cubic-bezier(0.16,1,0.3,1)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative overflow-hidden bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 px-7 py-6 text-white">
                            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
                            <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10" />
                            <div className="relative flex items-start justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-sm">
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Archive Subject</p>
                                        <h3 className="mt-0.5 text-xl font-extrabold tracking-tight">{archiveConfirmSubject.name}</h3>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setArchiveConfirmSubject(null)}
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="px-7 py-6">
                            <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 p-4">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                                    <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-amber-800">This action will hide the subject</p>
                                    <p className="mt-1 text-xs leading-relaxed text-amber-600/80">
                                        Students will no longer see <span className="font-semibold">"{archiveConfirmSubject.name}"</span> in their active subjects. You can restore it later from the Archived tab.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">Course</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-800">{archiveConfirmSubject.course || '—'}</p>
                                    <p className="text-xs text-slate-500">{archiveConfirmSubject.section || '—'}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">Students</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-800">{enrollCount} enrolled</p>
                                    <p className="text-xs text-slate-500">Will be hidden</p>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                                <span className="text-xs text-slate-500">Join Code</span>
                                <span className="font-mono text-sm font-bold tracking-wider text-slate-700">{archiveConfirmSubject.joinCode || '—'}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/50 px-7 py-4">
                            <button
                                type="button"
                                onClick={() => setArchiveConfirmSubject(null)}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm active:scale-[0.97]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleArchive(archiveConfirmSubject)}
                                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-amber-200/60 transition-all duration-200 hover:shadow-lg hover:shadow-amber-300/60 hover:brightness-110 active:scale-[0.97]"
                            >
                                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>
                                Confirm Archive
                            </button>
                        </div>
                    </div>
                </div>
                ), document.body);
            })()}

            {toast && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6 pointer-events-none">
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
                            {toast.details?.archivedName && (
                                <div className="mt-4 rounded-2xl bg-slate-50/80 border border-slate-100 px-4 py-3 space-y-1.5">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">Subject</span>
                                        <span className="font-medium text-slate-700">{toast.details.archivedName}</span>
                                    </div>
                                    {toast.details.course && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500">Course</span>
                                            <span className="font-medium text-slate-700">{toast.details.course} {toast.details.section ? `• ${toast.details.section}` : ''}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">Students</span>
                                        <span className="font-medium text-slate-700">{toast.details.studentCount ?? 0} enrolled</span>
                                    </div>
                                    <p className="text-xs text-slate-400 pt-1">You can restore this subject anytime from the Archived tab.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <div className="mx-auto w-full max-w-[1400px] px-4 pt-3 sm:px-6 md:px-8" style={{ height: 'calc(100vh - 6rem)' }}>
                <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)]">

                    <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-6 py-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-600 shadow-sm shadow-blue-200">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                                            <path d="M3.75 3a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5zM6 5.25A2.25 2.25 0 003.75 7.5h8.5A2.25 2.25 0 0014.5 5.25v-.75a.75.75 0 00-1.5 0v.75a.75.75 0 01-.75.75h-8.5a.75.75 0 01-.75-.75v-.75a.75.75 0 00-1.5 0v.75z" />
                                            <path d="M13.25 9a.75.75 0 000 1.5h-6.5a.75.75 0 000-1.5h6.5zM12 11.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM12 14.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM3.75 9a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5zM3 11.25a.75.75 0 01.75-.75H6a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75zM3.75 14a.75.75 0 000 1.5h.75a.75.75 0 000-1.5h-.75z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold tracking-tight text-slate-900">Subjects</h2>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-500 ml-10">
                                    Browse your classes and jump into enrollment details quickly.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="inline-flex w-full max-w-[320px] rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setShowArchivedSubjects(false)}
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${!showArchivedSubjects
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200/60'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                        }`}
                                >
                                    <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-bold ${!showArchivedSubjects ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {activeSubjects.length}
                                    </span>
                                    Active
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowArchivedSubjects(true)}
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${showArchivedSubjects
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200/60'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                        }`}
                                >
                                    <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-bold ${showArchivedSubjects ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {archivedSubjects.length}
                                    </span>
                                    Archived
                                </button>
                            </div>
                            <p className="text-xs text-slate-400">
                                {visibleSubjectList.length} subject{visibleSubjectList.length !== 1 ? 's' : ''} {showArchivedSubjects ? 'archived' : 'active'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-1 min-h-0 flex-col">
                        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                            <style>{`
                                .subject-scroll::-webkit-scrollbar { width: 6px; }
                                .subject-scroll::-webkit-scrollbar-track { background: transparent; }
                                .subject-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 9999px; }
                                .subject-scroll::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
                            `}</style>
                            <div className="subject-scroll grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {visibleSubjectList.length > 0 ? (
                                visibleSubjectList.map((subject, index) => {
                                    const theme = getSubjectCardTheme(subject);

                                    return (
                                        <div
                                            key={subject.id}
                                            className={`group relative overflow-hidden rounded-[1.05rem] border border-l-[3px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${theme.cardClass}`}
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <div className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${theme.accentClass}`} />
                                            <div className="flex flex-col gap-3 p-4 pl-5">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.cardBadgeClass} text-sm font-bold`}>
                                                        {subject.name?.charAt(0)?.toUpperCase() || 'S'}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className={`text-sm font-bold truncate ${theme.cardTextClass}`}>{subject.name}</h3>
                                                            <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${theme.cardBadgeClass}`}>
                                                                {subject.archived ? 'Archived' : 'Active'}
                                                            </span>
                                                        </div>
                                                        <p className={`mt-0.5 text-xs truncate ${theme.cardSubtextClass}`}>
                                                            {subject.course} · {subject.year} · {subject.section}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${theme.chipClass}`}>
                                                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 opacity-60">
                                                            <path d="M2 4.5A2.5 2.5 0 014.5 2h7A2.5 2.5 0 0114 4.5v7a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 012 11.5v-7z" />
                                                        </svg>
                                                        SY {subject.schoolYear}
                                                    </span>
                                                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${theme.chipClass}`}>
                                                        {subject.semester}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${theme.cardBadgeClass}`}>
                                                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                                                            <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                        </svg>
                                                        {subject.studentCount ?? 0}
                                                    </span>
                                                </div>
                                                <div className={`flex items-center gap-2 pt-1 border-t ${theme.chipClass}`}>
                                                    <span className={`rounded-lg border px-2 py-1 text-[10px] font-mono font-semibold ${theme.chipClass}`}>
                                                        {subject.joinCode}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            fetchEnrollments();
                                                            setSelectedSubject(subject);
                                                        }}
                                                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.97] ${theme.chipClass}`}
                                                    >
                                                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                                                            <path d="M2 4.5A2.5 2.5 0 014.5 2h7A2.5 2.5 0 0114 4.5v7a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 012 11.5v-7z" />
                                                        </svg>
                                                        View
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-blue-400">
                                            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                        </svg>
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-700">No subjects yet</h4>
                                    <p className="mt-1 max-w-xs text-xs text-slate-400">
                                        {showArchivedSubjects
                                            ? 'No archived subjects match your search.'
                                            : 'Get started by adding your first class using the button above.'}
                                    </p>
                                    {!showArchivedSubjects && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAddSubjectForm(true)}
                                            className="mt-4 flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-200/60 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
                                        >
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                            </svg>
                                            Add your first subject
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        </div>
                        <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-6 py-3 flex items-center justify-end">
                            <button
                                type="button"
                                onClick={() => setShowAddSubjectForm(true)}
                                className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-300/50 active:scale-[0.97]"
                            >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                </svg>
                                <span>Add Subject</span>
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {showAddSubjectForm && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.28)]">

                        <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-8 pb-8 pt-7">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-bold text-white">Add New Subject</h3>
                                    <p className="max-w-md text-sm text-blue-100/80">Fill in the details below to create a new class. Students can join using the auto-generated code.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAddSubjectForm(false)}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
                                >
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleAddSubject} className="px-8 pb-8 pt-6">
                            <div className="mb-6">
                                <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600">1</span>
                                    Subject Details
                                </p>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="sm:col-span-2">
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Subject Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={newSubject.name}
                                            onChange={handleInputChange}
                                            placeholder="e.g., Algebra 101"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Course</label>
                                        <Select
                                            name="courseId"
                                            value={newSubject.courseId}
                                            onChange={handleInputChange}
                                            placeholder="Select course"
                                        >
                                            {registrationOptions.courses.map((courseOption) => (
                                                <option key={courseOption.course_id} value={courseOption.course_id}>
                                                    {courseOption.course_code || courseOption.course_name}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6">
                                <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600">2</span>
                                    Schedule
                                </p>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Year Level</label>
                                        <Select
                                            name="yearId"
                                            value={newSubject.yearId}
                                            onChange={handleInputChange}
                                            placeholder="Select year"
                                        >
                                            {registrationOptions.years.map((yearOption) => (
                                                <option key={yearOption.year_id} value={yearOption.year_id}>
                                                    {yearOption.year_level}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Section</label>
                                        <Select
                                            name="sectionId"
                                            value={newSubject.sectionId}
                                            onChange={handleInputChange}
                                            placeholder="Select section"
                                        >
                                            {registrationOptions.sections.map((sectionOption) => (
                                                <option key={sectionOption.section_id} value={sectionOption.section_id}>
                                                    {sectionOption.section_name}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">School Year</label>
                                        <Select
                                            name="schoolYear"
                                            value={newSubject.schoolYear}
                                            onChange={handleInputChange}
                                            placeholder="Select school year"
                                        >
                                            {dropdownSchoolYearOptions.map((schoolYear) => (
                                                <option key={schoolYear} value={schoolYear}>
                                                    {schoolYear}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Semester</label>
                                        <Select
                                            name="semester"
                                            value={newSubject.semester}
                                            onChange={handleInputChange}
                                            placeholder="Select semester"
                                        >
                                            {dropdownSemesterOptions.map((semester) => (
                                                <option key={semester} value={semester}>
                                                    {semester}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3 mb-6">
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-blue-500">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                                </svg>
                                <p className="text-xs text-blue-700">A unique join code will be generated automatically for student enrollment.</p>
                            </div>

                            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                                <button
                                    type="button"
                                    onClick={() => setShowAddSubjectForm(false)}
                                    className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm active:scale-[0.97]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="flex items-center gap-2 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-300/50 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                                >
                                    {isAdding ? (
                                        <>
                                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            <span>Adding...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                            </svg>
                                            <span>Add Subject</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {selectedSubjectRecord && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
                    <div className="flex w-full max-w-4xl max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.28)]">

                        <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-8 pb-6 pt-7">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/90">Enrollment</span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white">{selectedSubjectRecord.name}</h3>
                                    <p className="text-sm text-blue-100/80">{selectedSubjectRecord.course} · {selectedSubjectRecord.year} · {selectedSubjectRecord.section}</p>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-blue-100/70">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M2 4.5A2.5 2.5 0 014.5 2h7A2.5 2.5 0 0114 4.5v7a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 012 11.5v-7z" /></svg>
                                            SY {selectedSubjectRecord.schoolYear}
                                        </span>
                                        <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1">{selectedSubjectRecord.semester}</span>
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-mono font-semibold text-white">
                                            {selectedSubjectRecord.joinCode}
                                            <button
                                                type="button"
                                                onClick={() => copyJoinCode(selectedSubjectRecord.joinCode)}
                                                className="ml-1 text-[9px] uppercase tracking-wider text-white/70 transition hover:text-white"
                                            >
                                                {copiedJoinCode === selectedSubjectRecord.joinCode ? 'Copied' : 'Copy'}
                                            </button>
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedSubject(null)}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
                                >
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                            <div className="px-8 py-6">
                                <div className="mb-6 grid grid-cols-3 gap-3">
                                    <div className="rounded-2xl bg-blue-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500">Enrolled</p>
                                        <p className="mt-1 text-3xl font-black text-blue-600">{enrolledList.length}</p>
                                        <p className="mt-0.5 text-[11px] font-medium text-blue-400">Students currently in this subject</p>
                                    </div>
                                    <div className="rounded-2xl bg-amber-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Pending</p>
                                        <p className="mt-1 text-3xl font-black text-amber-600">{selectedSubjectAssessmentStats.pending}</p>
                                        <p className="mt-0.5 text-[11px] font-medium text-amber-400">Awaiting review</p>
                                    </div>
                                    <div className="rounded-2xl bg-emerald-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Graded</p>
                                        <p className="mt-1 text-3xl font-black text-emerald-600">{selectedSubjectAssessmentStats.graded}</p>
                                        <p className="mt-0.5 text-[11px] font-medium text-emerald-400">Already graded</p>
                                    </div>
                                </div>

                                <div className="mb-6 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-500">
                                                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                            </svg>
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">Enrolled Students</p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                        {enrolledList.length} total
                                    </span>
                                </div>

                                {enrolledList.length > 0 ? (
                                    <div className="max-h-[35vh] space-y-2 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                                        {enrolledList.map((student, index) => (
                                            <div
                                                key={student.enrollment_id ?? student.student_id}
                                                className="group flex items-center gap-4 rounded-lg border border-slate-100 bg-white px-4 py-3 transition-all duration-200 hover:border-slate-200 hover:shadow-sm"
                                                style={{ animationDelay: `${index * 40}ms` }}
                                            >
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-500 text-xs font-bold text-white">
                                                    {(student.student_name || 'S').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold text-slate-900">{student.student_name || student.student_id}</p>
                                                    <p className="text-[11px] text-slate-400">ID {student.student_id} · Enrolled {student.date_enrolled ?? '—'}</p>
                                                </div>
                                                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                                                    {student.enrollment_status || 'enrolled'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-blue-400">
                                                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                            </svg>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-600">No students enrolled yet</h4>
                                        <p className="mt-1 max-w-xs text-xs text-slate-400">Share the join code with students so they can enroll in this subject.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-8 py-3">
                            <div className="flex items-center justify-end gap-2">
                                {!selectedSubjectRecord.archived && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleEditSubject(selectedSubjectRecord)}
                                            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm active:scale-[0.97]"
                                        >
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setArchiveConfirmSubject(selectedSubjectRecord)}
                                            className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-100 hover:shadow-sm active:scale-[0.97]"
                                        >
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path d="M1.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25H1.75zM0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75z" /></svg>
                                            Archive
                                        </button>
                                    </>
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
                                <Select
                                    name="year"
                                    value={editingSubject.year}
                                    onChange={handleEditInputChange}
                                    placeholder="Select year"
                                >
                                    {dropdownYearOptions.map((yearOption) => (
                                        <option key={yearOption} value={yearOption}>
                                            {yearOption}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.4em] mb-2">Section</label>
                                <Select
                                    name="section"
                                    value={editingSubject.section}
                                    onChange={handleEditInputChange}
                                    placeholder="Select section"
                                >
                                    {dropdownSectionOptions.map((sectionOption) => (
                                        <option key={sectionOption} value={sectionOption}>
                                            {sectionOption}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.4em] mb-2">School Year</label>
                                <Select
                                    name="schoolYear"
                                    value={editingSubject.schoolYear}
                                    onChange={handleEditInputChange}
                                    placeholder="Select school year"
                                >
                                    {dropdownSchoolYearOptions.map((schoolYear) => (
                                        <option key={schoolYear} value={schoolYear}>
                                            {schoolYear}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.4em] mb-2">Semester</label>
                                <Select
                                    name="semester"
                                    value={editingSubject.semester}
                                    onChange={handleEditInputChange}
                                    placeholder="Select semester"
                                >
                                    {dropdownSemesterOptions.map((semester) => (
                                        <option key={semester} value={semester}>
                                            {semester}
                                        </option>
                                    ))}
                                </Select>
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
