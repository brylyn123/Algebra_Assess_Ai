import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { storeLocalUser } from './localAuthStore';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const shakeVariants = {
    idle: { x: 0 },
    error: {
        x: [0, -6, 6, -4, 4, 0],
        transition: { duration: 0.45, ease: 'easeOut' },
    },
};

const pageVariants = {
    hidden: { opacity: 0, y: 18 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: 'easeOut' },
    },
};

const Signup = () => {
    const navigate = useNavigate();
    const [role, setRole] = useState('teacher');
    const [formData, setFormData] = useState({
        firstName: '',
        middleName: '',
        lastName: '',
        idNumber: '',
        collegeId: '',
        collegeName: '',
        courseId: '',
        courseName: '',
        sectionId: '',
        yearId: '',
        email: '',
        password: '',
    });

    const [message, setMessage] = useState('');
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);
    const [registrationOptions, setRegistrationOptions] = useState({
        colleges: [],
        courses: [],
        sections: [],
        years: [],
    });
    const [optionsLoading, setOptionsLoading] = useState(false);
    const toastTimer = useRef(null);
    const navigationTimer = useRef(null);

    useEffect(() => {
        return () => {
            clearTimeout(toastTimer.current);
            clearTimeout(navigationTimer.current);
        };
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const showToast = (text, type = 'success') => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ text, type });
        toastTimer.current = setTimeout(() => setToast(null), 3200);
    };

    const handleRoleChange = (newRole) => {
        setRole(newRole);
        setFormData((prev) => ({
            ...prev,
            collegeId: newRole === 'teacher' ? prev.collegeId : '',
            collegeName: newRole === 'teacher' ? prev.collegeName : '',
            courseId: '',
            courseName: '',
            sectionId: '',
            yearId: '',
        }));
    };

    useEffect(() => {
        if (!formData.collegeId) {
            return;
        }

        const selectedCourseStillMatches = registrationOptions.courses.some((course) => (
            String(course.course_id) === String(formData.courseId)
            && (!course.college_id || String(course.college_id) === String(formData.collegeId))
        ));

        if (!selectedCourseStillMatches && formData.courseId) {
            setFormData((prev) => ({
                ...prev,
                courseId: '',
            }));
        }
    }, [formData.collegeId, formData.courseId, registrationOptions.courses]);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const loadOptions = async () => {
            setOptionsLoading(true);

            try {
                const response = await fetch(`${API_BASE_URL}/get_registration_options.php`, {
                    signal: controller.signal,
                });
                const text = await response.text();

                if (!response.ok) {
                    throw new Error(text || 'Unable to load registration options.');
                }

                const payload = JSON.parse(text);
                if (payload.status !== 'success') {
                    throw new Error(payload.message || 'Unable to load registration options.');
                }

                if (isMounted) {
                    setRegistrationOptions({
                        colleges: Array.isArray(payload.colleges) ? payload.colleges : [],
                        courses: Array.isArray(payload.courses) ? payload.courses : [],
                        sections: Array.isArray(payload.sections) ? payload.sections : [],
                        years: Array.isArray(payload.years) ? payload.years : [],
                    });
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                if (isMounted) {
                    setRegistrationOptions({ colleges: [], courses: [], sections: [], years: [] });
                }
            } finally {
                if (isMounted) {
                    setOptionsLoading(false);
                }
            }
        };

        loadOptions();

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);

        const normalizedCollegeId = formData.collegeId === '__custom__' ? '' : formData.collegeId;
        const normalizedCourseId = formData.courseId === '__custom__' ? '' : formData.courseId;

        const payload = {
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: formData.lastName,
            idNumber: formData.idNumber,
            email: formData.email,
            password: formData.password,
            role,
            collegeId: normalizedCollegeId,
            collegeName: formData.collegeName,
            courseId: normalizedCourseId,
            courseName: formData.courseName,
            sectionId: formData.sectionId,
            yearId: formData.yearId,
        };

        const selectedCollege = registrationOptions.colleges.find((college) => String(college.college_id) === String(normalizedCollegeId));
        const selectedCourse = registrationOptions.courses.find((course) => String(course.course_id) === String(normalizedCourseId));
        const selectedSection = registrationOptions.sections.find((section) => String(section.section_id) === String(formData.sectionId));
        const selectedYear = registrationOptions.years.find((year) => String(year.year_id) === String(formData.yearId));

        try {
            const response = await fetch('http://localhost/Algebra_Assess_Ai/algebra-api/signup.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            if (result.status === 'success') {
                const userSession = {
                    id: result.user_id,
                    role,
                    name: `${formData.firstName} ${formData.lastName}`,
                    email: formData.email,
                };

                localStorage.setItem('user', JSON.stringify(userSession));
                storeLocalUser({
                    ...userSession,
                    firstName: formData.firstName,
                    middleName: formData.middleName,
                    lastName: formData.lastName,
                    idNumber: formData.idNumber,
                    collegeId: normalizedCollegeId,
                    collegeName: selectedCollege?.college_name ?? formData.collegeName,
                    courseId: normalizedCourseId,
                    courseName: selectedCourse?.course_name ?? formData.courseName,
                    sectionId: formData.sectionId,
                    sectionName: selectedSection?.section_name ?? '',
                    yearId: formData.yearId,
                    yearLevel: selectedYear?.year_level ?? '',
                    password: formData.password,
                });
                showToast('Account created successfully!', 'success');
                navigationTimer.current = setTimeout(() => navigate('/login'), 1100);
            } else {
                const errorText = result.message || 'Registration failed.';
                setMessage(errorText);
                showToast(errorText, 'error');
            }
        } catch (error) {
            const err = 'Error connecting to server.';
            setMessage(err);
            showToast(err, 'error');
        } finally {
            setLoading(false);
        }
    };

    const roleOptions = [
        { label: 'I am a Teacher', value: 'teacher' },
        { label: 'I am a Student', value: 'student' },
    ];
    const hasCourseOptions = registrationOptions.courses.length > 0;
    const useCustomCourse = !hasCourseOptions || formData.courseId === '__custom__';
    const filteredCourseOptions = registrationOptions.courses;

    const inputClassName = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 font-medium outline-none transition focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100';
    const selectClassName = `${inputClassName} disabled:cursor-not-allowed disabled:opacity-70`;

    return (
        <div
            className="min-h-screen overflow-hidden bg-slate-50 text-slate-800"
            style={{
                backgroundImage: 'linear-gradient(#cbd7ed 1px, transparent 1px), linear-gradient(90deg, #cbd7ed 1px, transparent 1px)',
                backgroundSize: '30px 30px',
                backgroundColor: '#e0edff',
            }}
        >
            <div className="relative min-h-screen">
                <div className="absolute left-[8%] top-20 -z-10 h-48 w-48 rounded-full bg-white/35 blur-3xl" />
                <div className="absolute right-[10%] top-24 -z-10 h-56 w-56 rounded-full bg-indigo-100/30 blur-3xl" />

                <header className="sticky top-0 z-20 bg-blue-600 text-white shadow-md">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
                        <div
                            onClick={() => navigate('/')}
                            className="flex cursor-pointer items-center gap-3"
                            role="button"
                            aria-label="Go back to landing page"
                        >
                            <div className="rounded-2xl bg-white/20 p-2.5 text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-lg font-black tracking-tight text-white">AlgebraAssess</p>
                            </div>
                        </div>
                        <Link
                            to="/"
                            className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/85 transition hover:bg-white/10 hover:text-white"
                        >
                            Back to Landing
                        </Link>
                    </div>
                </header>

                <main className="mx-auto flex min-h-[calc(100vh-88px)] max-w-7xl items-center justify-center px-6 py-10 lg:px-10">
                    <motion.section initial="hidden" animate="show" variants={pageVariants} className="relative w-full max-w-md">
                        <div className="rounded-[2rem] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.18)] backdrop-blur-xl sm:p-6">
                            <div className="rounded-[1.7rem] border border-slate-100 bg-slate-50/90 p-6 sm:p-8">
                                <div className="mb-6 flex rounded-2xl border border-slate-200 bg-white p-1 shadow-inner">
                                    {roleOptions.map((option) => (
                                        <motion.button
                                            key={option.value}
                                            type="button"
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleRoleChange(option.value)}
                                            className={`relative flex-1 rounded-2xl px-5 py-3 text-sm font-semibold transition ${role === option.value
                                                    ? 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-200/80'
                                                    : 'text-slate-500 hover:text-indigo-500'
                                                }`}
                                        >
                                            {option.label}
                                        </motion.button>
                                    ))}
                                </div>

                                <div className="mb-7 text-center">
                                    <div className="relative mb-3 h-10">
                                        <AnimatePresence initial={false} mode="wait">
                                            <motion.h1
                                                key={role}
                                                className="absolute inset-0 text-3xl font-black text-slate-900"
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                transition={{ duration: 0.24 }}
                                            >
                                                {role === 'teacher' ? 'Teacher Sign Up' : 'Student Sign Up'}
                                            </motion.h1>
                                        </AnimatePresence>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {toast && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            className={`mb-4 w-full rounded-2xl border px-5 py-3 text-sm font-semibold ${toast.type === 'success'
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-lg shadow-emerald-200/70'
                                                    : 'border-rose-200 bg-rose-50 text-rose-700 shadow-lg shadow-rose-200/70'
                                                }`}
                                        >
                                            {toast.text}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {message && (
                                    <motion.div
                                        className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-600"
                                        variants={shakeVariants}
                                        initial="idle"
                                        animate="error"
                                    >
                                        {message}
                                    </motion.div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                        <div>
                                            <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
                                            <input
                                                name="firstName"
                                                required
                                                onChange={handleChange}
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 font-medium outline-none transition focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Middle Name</label>
                                            <input
                                                name="middleName"
                                                onChange={handleChange}
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 font-medium outline-none transition focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                                            <input
                                                name="lastName"
                                                required
                                                onChange={handleChange}
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 font-medium outline-none transition focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="relative mb-2 h-3">
                                            <AnimatePresence initial={false} mode="wait">
                                                <motion.label
                                                    key={role}
                                                    className="absolute inset-0 ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    {role === 'teacher' ? 'Employee ID' : 'Student ID'}
                                                </motion.label>
                                            </AnimatePresence>
                                        </div>
                                        <input
                                            name="idNumber"
                                            required
                                            onChange={handleChange}
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 font-medium outline-none transition focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100"
                                        />
                                    </div>

                                    <div className="min-h-[88px]">
                                        <AnimatePresence mode="wait" initial={false}>
                                            {role === 'teacher' ? (
                                                <motion.div
                                                    key="collegeField"
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -8 }}
                                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                                >
                                                    <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">College</label>
                                                    {registrationOptions.colleges.length > 0 ? (
                                                        <select
                                                            name="collegeId"
                                                            required={formData.collegeId !== '__custom__'}
                                                            value={formData.collegeId}
                                                            onChange={handleChange}
                                                            disabled={optionsLoading}
                                                            className={selectClassName}
                                                        >
                                                            <option value="" disabled hidden>Select college</option>
                                                            {registrationOptions.colleges.map((college) => (
                                                                <option key={college.college_id} value={college.college_id}>
                                                                    {college.college_name}
                                                                </option>
                                                            ))}
                                                            <option value="__custom__">Add new college</option>
                                                        </select>
                                                    ) : null}
                                                    {(registrationOptions.colleges.length === 0 || formData.collegeId === '__custom__') && (
                                                        <div className={registrationOptions.colleges.length > 0 ? 'mt-3' : ''}>
                                                            <input
                                                                name="collegeName"
                                                                value={formData.collegeName}
                                                                onChange={handleChange}
                                                                placeholder="Enter college name"
                                                                required
                                                                className={inputClassName}
                                                            />
                                                        </div>
                                                    )}
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="studentFields"
                                                    className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -8 }}
                                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                                >
                                                    <div className="sm:col-span-2">
                                                        <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Course</label>
                                                        {hasCourseOptions ? (
                                                            <select
                                                                name="courseId"
                                                                required={!useCustomCourse}
                                                                value={formData.courseId}
                                                                onChange={handleChange}
                                                                disabled={optionsLoading}
                                                                className={selectClassName}
                                                            >
                                                                <option value="" disabled hidden>Select course</option>
                                                                {filteredCourseOptions.map((course) => (
                                                                    <option key={course.course_id} value={course.course_id}>
                                                                        {course.course_name} ({course.course_code})
                                                                    </option>
                                                                ))}
                                                                <option value="__custom__">Add new course</option>
                                                            </select>
                                                        ) : null}
                                                        {useCustomCourse && (
                                                            <div className={hasCourseOptions ? 'mt-3' : ''}>
                                                                <input
                                                                    name="courseName"
                                                                    value={formData.courseName}
                                                                    onChange={handleChange}
                                                                    placeholder="Enter course name"
                                                                    required
                                                                    className={inputClassName}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Year Level</label>
                                                        <select
                                                            name="yearId"
                                                            required
                                                            value={formData.yearId}
                                                            onChange={handleChange}
                                                            disabled={optionsLoading}
                                                            className={selectClassName}
                                                        >
                                                            <option value="" disabled hidden>Select year level</option>
                                                            {registrationOptions.years.map((year) => (
                                                                <option key={year.year_id} value={year.year_id}>
                                                                    {year.year_level}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Section</label>
                                                        <select
                                                            name="sectionId"
                                                            required
                                                            value={formData.sectionId}
                                                            onChange={handleChange}
                                                            disabled={optionsLoading}
                                                            className={selectClassName}
                                                        >
                                                            <option value="" disabled hidden>Select section</option>
                                                            {registrationOptions.sections.map((section) => (
                                                                <option key={section.section_id} value={section.section_id}>
                                                                    {section.section_name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div>
                                        <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Email address</label>
                                        <input
                                            type="email"
                                            name="email"
                                            required
                                            onChange={handleChange}
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 font-medium outline-none transition focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Password</label>
                                        <input
                                            type="password"
                                            name="password"
                                            required
                                            onChange={handleChange}
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 font-medium outline-none transition focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100"
                                        />
                                    </div>

                                    <motion.button
                                        whileHover={{ y: -2 }}
                                        whileTap={{ scale: 0.99 }}
                                        type="submit"
                                        className={`w-full rounded-2xl py-4 font-bold text-white shadow-lg transition duration-300 ${loading
                                                ? 'cursor-wait bg-sky-400 shadow-sky-200'
                                                : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 shadow-sky-200/80 hover:shadow-xl'
                                            }`}
                                        disabled={loading}
                                    >
                                        {loading ? 'Submitting...' : 'Sign Up'}
                                    </motion.button>
                                </form>

                                <div className="mt-7 text-center">
                                    <p className="text-sm font-medium text-slate-500">
                                        Already have an account?
                                        <button onClick={() => navigate('/login')} className="ml-1 font-bold text-indigo-500 transition hover:text-indigo-600">
                                            Login
                                        </button>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.section>
                </main>
            </div>
        </div>
    );
};

export default Signup;
