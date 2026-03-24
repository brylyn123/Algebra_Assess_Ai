import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from './axiosClient';
import { loadSubjects, saveSubjects } from './subjectsStore';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const FALL_SCHOOL_YEAR_DEFAULTS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];
const SEMESTER_OPTIONS = ['1st Semester', '2nd Semester', 'Summer'];
const YEAR_DROPDOWN_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const SECTION_OPTIONS = ['A', 'B', 'C'];

const ManageSubjects = () => {
    const [subjects, setSubjects] = useState([]);
    const [newSubject, setNewSubject] = useState({
        name: '',
        course: '',
        year: '',
        section: '',
        schoolYear: '',
        semester: ''
    });
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [editingSubject, setEditingSubject] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCourse, setFilterCourse] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [toast, setToast] = useState(null);
    const [copiedJoinCode, setCopiedJoinCode] = useState(null);
    const [subjectEnrollments, setSubjectEnrollments] = useState({});
    const toastTimer = useRef(null);
    const [toastVisible, setToastVisible] = useState(false);
    const currentTeacherEmail = getCurrentLocalUserEmail();
    const storedTeacher = currentTeacherEmail ? findLocalUser(currentTeacherEmail) : null;
    const teacherId = storedTeacher?.teacher_id ?? storedTeacher?.user_id ?? storedTeacher?.id;
    const [subjectFilters, setSubjectFilters] = useState({
        years: [],
        sections: [],
        schoolYears: [],
        semesters: []
    });

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

        if (!teacherId) {
            showToast('Teacher ID missing. Please log in again.', 'error');
            return;
        }

        if (!newSubject.name || !newSubject.course || !newSubject.year || !newSubject.section || !newSubject.schoolYear || !newSubject.semester) {
            showToast('Please fill out all fields before adding a subject.');
            return;
        }

        setIsAdding(true);

        try {
            const response = await axios.post('http://localhost/Algebra_Assess_Ai/algebra-api/add_subject.php', {
                subject_name: newSubject.name,
                course: newSubject.course,
                year: newSubject.year,
                section: newSubject.section,
                school_year: newSubject.schoolYear,
                semester: newSubject.semester,
                teacher_id: teacherId
            });

            const responseData = response.data || {};
            if (responseData.status === 'success') {
                showToast(`"${newSubject.name}" added!`, 'success', {
                    joinCode: response.data.join_code ?? 'Not Set'
                });
                setNewSubject({ name: '', course: '', year: '', section: '', schoolYear: '', semester: '' });
                fetchSubjects();
            } else {
                console.error('Add subject failed', responseData);
                const statusText = response.statusText || '';
                const errorMessage =
                    responseData.message ||
                    (statusText && statusText.toLowerCase() !== 'ok' ? statusText : 'Error adding subject.');
                showToast(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Connection Error:', error);
            showToast('Could not connect to the server.', 'error');
        } finally {
            setIsAdding(false);
        }
    };

    const normalizeSubject = (raw) => ({
        // Use the exact column names from your phpMyAdmin screenshot
        id: raw.subject_id,
        name: raw.subject_name, // This matches "subject_name" in DB
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
            const response = await axios.get(`http://localhost/Algebra_Assess_Ai/algebra-api/get_subjects.php?teacher_id=${teacherId}`);

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
            const response = await axios.get('http://localhost/Algebra_Assess_Ai/algebra-api/get_enrollments.php', {
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
            const response = await axios.get('http://localhost/Algebra_Assess_Ai/algebra-api/get_subject_filters.php', {
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
            const response = await axios.get('http://localhost/Algebra_Assess_Ai/algebra-api/get_archived_subjects.php', {
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

    const handleRemoveSubject = (id) => {
        setSubjects(prevSubjects => prevSubjects.filter(subject => subject.id !== id));
        showToast('Subject removed.');
    };

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
            await axios.post('http://localhost/Algebra_Assess_Ai/algebra-api/archive_subject.php', {
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
    const activeSubjects = subjectsWithCounts;
    const searchLower = searchQuery.trim().toLowerCase();
    const filteredSubjects = activeSubjects.filter((subject) => {
        const matchesSearch =
            subject.name.toLowerCase().includes(searchLower) ||
            subject.course.toLowerCase().includes(searchLower) ||
            subject.year.toLowerCase().includes(searchLower) ||
            subject.section.toLowerCase().includes(searchLower) ||
            subject.schoolYear.toLowerCase().includes(searchLower) ||
            subject.semester.toLowerCase().includes(searchLower);
        const matchesCourse = filterCourse ? subject.course === filterCourse : true;
        const matchesYear = filterYear ? subject.year === filterYear : true;
        return matchesSearch && matchesCourse && matchesYear;
    });
    const courseOptions = Array.from(new Set(normalizedSubjects.map((subject) => subject.course))).filter(Boolean);
    const yearOptions = Array.from(new Set(normalizedSubjects.map((subject) => subject.year))).filter(Boolean);
    const dropdownYearOptions = Array.from(new Set([
        ...YEAR_DROPDOWN_OPTIONS,
        ...subjectFilters.years,
        ...normalizedSubjects.map((subject) => subject.year).filter(Boolean),
    ])).filter(Boolean);
    const dropdownSectionOptions = Array.from(new Set([
        ...SECTION_OPTIONS,
        ...subjectFilters.sections,
        ...normalizedSubjects.map((subject) => subject.section).filter(Boolean),
    ])).filter(Boolean);
    const dropdownSchoolYearOptions = Array.from(new Set([
        ...FALL_SCHOOL_YEAR_DEFAULTS,
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
            <div className="grid lg:grid-cols-2 gap-8 items-start">
                {/* Add Subject Card */}
                <div className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 space-y-6">
                    <h2 className="text-xl font-bold text-slate-900">Add New Subject</h2>
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
                            <input
                                type="text"
                                name="course"
                                value={newSubject.course}
                                onChange={handleInputChange}
                                placeholder="e.g., BSCS"
                                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Year</label>
                                <select
                                    name="year"
                                    value={newSubject.year}
                                    onChange={handleInputChange}
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                                >
                                    <option value="">Select year</option>
                                    {dropdownYearOptions.map((yearOption) => (
                                        <option key={yearOption} value={yearOption}>
                                            {yearOption}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Section</label>
                                <select
                                    name="section"
                                    value={newSubject.section}
                                    onChange={handleInputChange}
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                                >
                                    <option value="">Select section</option>
                                    {dropdownSectionOptions.map((sectionOption) => (
                                        <option key={sectionOption} value={sectionOption}>
                                            {sectionOption}
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
                                    <option value="">Select school year</option>
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
                                    <option value="">Select semester</option>
                                    {dropdownSemesterOptions.map((semester) => (
                                        <option key={semester} value={semester}>
                                            {semester}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isAdding}
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition duration-300 disabled:cursor-wait disabled:opacity-60"
                        >
                            {isAdding ? 'Adding...' : 'Add Subject'}
                        </button>
                    </form>
                </div>

                {/* View Subjects Card */}
                <div className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 space-y-6">
                    <h2 className="text-xl font-bold text-slate-900">View Subjects</h2>
                    <div className="flex flex-wrap gap-3 items-center">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by subject, course, year"
                            className="flex-1 min-w-[180px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-400"
                        />
                        <select
                            value={filterCourse}
                            onChange={(e) => setFilterCourse(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="">All Courses</option>
                            {courseOptions.map((course) => (
                                <option key={course} value={course}>
                                    {course}
                                </option>
                            ))}
                        </select>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="">All Years</option>
                            {yearOptions.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="teacher-scrollbar space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {filteredSubjects.length > 0 ? (
                            filteredSubjects.map((subject) => (
                                <div key={subject.id} className="bg-slate-50 rounded-xl p-4 flex flex-col gap-3">
                                    <div className="flex justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-800">{subject.name}</p>
                                            <p className="text-sm text-slate-500">{subject.course} | {subject.year} - Section {subject.section}</p>
                                            <p className="text-xs text-slate-400">SY {subject.schoolYear} | Semester {subject.semester}</p>
                                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                                                    {subject.studentCount ?? 0} Students
                                                </span>
                                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                                                    {subject.activeAssessments ?? 0} Pending Assessments
                                                </span>
                                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                                                    Join Code: {subject.joinCode}
                                                </span>
                                                {subject.archived && (
                                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-600">
                                                        Archived
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 text-right">
                                            <p>ID {subject.id}</p>
                                            <p>Status {subject.archived ? 'Inactive' : 'Active'}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                fetchEnrollments();
                                                setSelectedSubject(subject);
                                            }}
                                            className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        >
                                            View Enrolled
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEditSubject(subject)}
                                            className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:border-slate-400 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleArchive(subject)}
                                            className="rounded-full border border-amber-200 bg-amber-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-600 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200"
                                        >
                                            Archive
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-slate-400 py-8">
                                No subjects match your search. Add the first class on the left to get started.
                            </p>
                        )}
                        {archivedSubjects.length > 0 && (
                            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 pt-2">
                                {archivedSubjects.length} archived subject(s) hidden. Archived subjects keep their history safe.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {selectedSubjectRecord && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-6">
                    <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-8 shadow-[0_25px_60px_rgba(15,23,42,0.4)]">
                        <div className="teacher-scrollbar max-h-[calc(90vh-4rem)] space-y-8 overflow-y-auto pr-2">
                        <div className="flex items-start justify-between gap-6">
                            <div className="space-y-2">
                                <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Enrollment</p>
                                <h3 className="text-3xl font-bold text-slate-900">{selectedSubjectRecord.name}</h3>
                                <p className="text-lg text-slate-600">{selectedSubjectRecord.course}</p>
                                <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                                    <span>{selectedSubjectRecord.year} · Section {selectedSubjectRecord.section}</span>
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
                            <div className="flex items-center gap-3 self-start">
                                <button
                                    type="button"
                                    onClick={() => fetchEnrollments()}
                                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                >
                                    Refresh
                                </button>
                                <button
                                    onClick={() => setSelectedSubject(null)}
                                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">Enrolled</p>
                                <p className="mt-3 text-3xl font-black text-slate-900">{enrolledList.length}</p>
                                <p className="mt-1 text-sm text-slate-500">Students currently in this subject</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">Join Code</p>
                                <p className="mt-3 font-mono text-2xl font-black text-slate-900">{selectedSubjectRecord.joinCode}</p>
                                <p className="mt-1 text-sm text-slate-500">Share this code so students can enroll</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">Schedule</p>
                                <p className="mt-3 text-lg font-bold text-slate-900">{selectedSubjectRecord.semester}</p>
                                <p className="mt-1 text-sm text-slate-500">SY {selectedSubjectRecord.schoolYear}</p>
                            </div>
                        </div>
                        <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">Students</p>
                                <p className="text-xs text-slate-500">{enrolledList.length} recorded</p>
                            </div>
                            {enrolledList.length > 0 ? (
                                <div className="teacher-scrollbar grid max-h-[360px] gap-3 overflow-y-auto pr-2">
                                    {enrolledList.map((student) => (
                                        <div
                                            key={student.enrollment_id ?? student.student_id}
                                            className="rounded-[1.35rem] border border-white bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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
                </div>
            )}
            {editingSubject && (
                <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 bg-slate-900/40">
                    <div className="w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-[0_35px_70px_rgba(15,23,42,0.35)] border border-slate-100 space-y-6">
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
                                    <option value="">Select year</option>
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
                                    <option value="">Select section</option>
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
                                    <option value="">Select school year</option>
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
                                    <option value="">Select semester</option>
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
                </div>
            )}
        </>
    );
};

export default ManageSubjects;
