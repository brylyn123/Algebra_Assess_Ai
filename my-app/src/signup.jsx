import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { storeLocalUser } from './localAuthStore';
import { API_BASE_URL } from './apiBase';
import { apiFetch } from './fetchClient';
import Select from './components/Select';

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
    const [errors, setErrors] = useState({});
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
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (errors[name]) {
            setErrors({ ...errors, [name]: '' });
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        } else if (formData.firstName.length > 100) {
            newErrors.firstName = 'First name must be under 100 characters';
        }
        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        } else if (formData.lastName.length > 100) {
            newErrors.lastName = 'Last name must be under 100 characters';
        }
        if (!formData.idNumber.trim()) {
            newErrors.idNumber = 'ID number is required';
        } else if (formData.idNumber.length > 50) {
            newErrors.idNumber = 'ID number must be under 50 characters';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        } else if (formData.email.length > 255) {
            newErrors.email = 'Email must be under 255 characters';
        }
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        } else if (formData.password.length > 128) {
            newErrors.password = 'Password must be under 128 characters';
        }
        if (role === 'student' && !formData.courseId) {
            newErrors.courseId = 'Please select a course';
        }
        if (role === 'student' && !formData.sectionId) {
            newErrors.sectionId = 'Please select a section';
        }
        if (role === 'student' && !formData.yearId) {
            newErrors.yearId = 'Please select a year level';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
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
            collegeName: '',
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

        if (!validateForm()) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const normalizedCollegeId = formData.collegeId;
        const normalizedCourseId = formData.courseId;

        if (role === 'teacher' && registrationOptions.colleges.length === 0) {
            const err = 'No colleges are available yet. Please ask an admin to add a college first.';
            setMessage(err);
            showToast(err, 'error');
            setLoading(false);
            return;
        }

        if (role === 'student' && registrationOptions.courses.length === 0) {
            const err = 'No courses are available yet. Please ask an admin to add a course first.';
            setMessage(err);
            showToast(err, 'error');
            setLoading(false);
            return;
        }

        const payload = {
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: formData.lastName,
            idNumber: formData.idNumber,
            email: formData.email,
            password: formData.password,
            role,
            collegeId: normalizedCollegeId,
            collegeName: '',
            courseId: normalizedCourseId,
            courseName: '',
            sectionId: formData.sectionId,
            yearId: formData.yearId,
        };

        const selectedCollege = registrationOptions.colleges.find((college) => String(college.college_id) === String(normalizedCollegeId));
        const selectedCourse = registrationOptions.courses.find((course) => String(course.course_id) === String(normalizedCourseId));
        const selectedSection = registrationOptions.sections.find((section) => String(section.section_id) === String(formData.sectionId));
        const selectedYear = registrationOptions.years.find((year) => String(year.year_id) === String(formData.yearId));

        try {
            const response = await apiFetch('/signup.php', {
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
                    collegeName: selectedCollege?.college_name ?? '',
                    courseId: normalizedCourseId,
                    courseName: selectedCourse?.course_name ?? formData.courseName,
                    sectionId: formData.sectionId,
                    sectionName: selectedSection?.section_name ?? '',
                    yearId: formData.yearId,
                    yearLevel: selectedYear?.year_level ?? '',
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

    const inputClassName = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 font-medium outline-none transition focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100';
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

                <header className="sticky top-0 z-20 bg-blue-500 text-white shadow-sm">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-10">
                        <div
                            onClick={() => navigate('/')}
                            className="flex cursor-pointer items-center gap-2"
                            role="button"
                            aria-label="Go back to landing page"
                        >
                            <div className="rounded-lg bg-white/20 p-1.5 text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-black tracking-tight text-white">AlgebraAssess</p>
                            </div>
                        </div>
                        <Link
                            to="/"
                            className="rounded-full border border-white/20 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10 hover:text-white"
                        >
                            Back to Landing
                        </Link>
                    </div>
                </header>

                <main className="mx-auto flex min-h-[calc(100vh-56px)] max-w-7xl items-center justify-center px-6 py-6 lg:px-10">
                    <motion.section initial="hidden" animate="show" variants={pageVariants} className="relative w-full max-w-sm">
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm backdrop-blur-xl">
                            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                                <div className="mb-4 flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-inner">
                                    {roleOptions.map((option) => (
                                        <motion.button
                                            key={option.value}
                                            type="button"
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleRoleChange(option.value)}
                                            className={`relative flex-1 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${role === option.value
                                                ? 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 text-white shadow-md shadow-sky-200/80'
                                                : 'text-slate-500 hover:text-indigo-500'
                                                }`}
                                        >
                                            {option.label}
                                        </motion.button>
                                    ))}
                                </div>

                                <div className="mb-5 text-center">
                                    <div className="relative mb-2 h-7">
                                        <AnimatePresence initial={false} mode="wait">
                                            <motion.h1
                                                key={role}
                                                className="absolute inset-0 text-lg font-black text-slate-900"
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
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
                                            className={`mb-3 w-full rounded-xl border px-3 py-2 text-[11px] font-semibold ${toast.type === 'success'
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                : 'border-rose-200 bg-rose-50 text-rose-700'
                                                }`}
                                        >
                                            {toast.text}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {message && (
                                    <motion.div
                                        className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[11px] font-medium text-rose-600"
                                        variants={shakeVariants}
                                        initial="idle"
                                        animate="error"
                                    >
                                        {message}
                                    </motion.div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-2.5">
                                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                                        <div>
                                            <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
                                            <input
                                                name="firstName"
                                                required
                                                onChange={handleChange}
                                                className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-[11px] text-slate-700 font-medium outline-none transition ${errors.firstName ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100'}`}
                                            />
                                            {errors.firstName && (
                                                <p className="mt-0.5 ml-1 text-[9px] font-medium text-rose-600">{errors.firstName}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Middle Name</label>
                                            <input
                                                name="middleName"
                                                onChange={handleChange}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 font-medium outline-none transition focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                                            <input
                                                name="lastName"
                                                required
                                                onChange={handleChange}
                                                className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-[11px] text-slate-700 font-medium outline-none transition ${errors.lastName ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100'}`}
                                            />
                                            {errors.lastName && (
                                                <p className="mt-0.5 ml-1 text-[9px] font-medium text-rose-600">{errors.lastName}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="relative mb-1 h-3">
                                            <AnimatePresence initial={false} mode="wait">
                                                <motion.label
                                                    key={role}
                                                    className="absolute inset-0 ml-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500"
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
                                            className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-[11px] text-slate-700 font-medium outline-none transition ${errors.idNumber ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100'}`}
                                        />
                                        {errors.idNumber && (
                                            <p className="mt-0.5 ml-1 text-[9px] font-medium text-rose-600">{errors.idNumber}</p>
                                        )}
                                    </div>

                                    <div className="min-h-[72px]">
                                        <AnimatePresence mode="wait" initial={false}>
                                            {role === 'teacher' ? (
                                                <motion.div
                                                    key="collegeField"
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -8 }}
                                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                                >
                                                    <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">College</label>
                                                    {registrationOptions.colleges.length > 0 ? (
                                                        <Select
                                                            name="collegeId"
                                                            required
                                                            value={formData.collegeId}
                                                            onChange={handleChange}
                                                            disabled={optionsLoading}
                                                            placeholder="Select college"
                                                        >
                                                            {registrationOptions.colleges.map((college) => (
                                                                <option key={college.college_id} value={college.college_id}>
                                                                    {college.college_name}
                                                                </option>
                                                            ))}
                                                        </Select>
                                                    ) : (
                                                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                                                            No colleges are available yet. Please ask an admin to add one before signing up.
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
                                                        <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Course</label>
                                                        {hasCourseOptions ? (
                                                            <Select
                                                                name="courseId"
                                                                required
                                                                value={formData.courseId}
                                                                onChange={handleChange}
                                                                disabled={optionsLoading}
                                                                placeholder="Select course"
                                                            >
                                                                {registrationOptions.courses.map((course) => (
                                                                    <option key={course.course_id} value={course.course_id}>
                                                                        {course.course_name} ({course.course_code})
                                                                    </option>
                                                                ))}
                                                            </Select>
                                                        ) : (
                                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                                                                No courses are available yet. Please ask an admin to add one before signing up.
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Year Level</label>
                                                        <Select
                                                            name="yearId"
                                                            required
                                                            value={formData.yearId}
                                                            onChange={handleChange}
                                                            disabled={optionsLoading}
                                                            placeholder="Select year level"
                                                        >
                                                            {registrationOptions.years.map((year) => (
                                                                <option key={year.year_id} value={year.year_id}>
                                                                    {year.year_level}
                                                                </option>
                                                            ))}
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Section</label>
                                                        <Select
                                                            name="sectionId"
                                                            required
                                                            value={formData.sectionId}
                                                            onChange={handleChange}
                                                            disabled={optionsLoading}
                                                            placeholder="Select section"
                                                        >
                                                            {registrationOptions.sections.map((section) => (
                                                                <option key={section.section_id} value={section.section_id}>
                                                                    {section.section_name}
                                                                </option>
                                                            ))}
                                                        </Select>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div>
                                        <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Email address</label>
                                        <input
                                            type="email"
                                            name="email"
                                            required
                                            onChange={handleChange}
                                            className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-[11px] text-slate-700 font-medium outline-none transition ${errors.email ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100'}`}
                                        />
                                        {errors.email && (
                                            <p className="mt-0.5 ml-1 text-[9px] font-medium text-rose-600">{errors.email}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Password</label>
                                        <input
                                            type="password"
                                            name="password"
                                            required
                                            onChange={handleChange}
                                            className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-[11px] text-slate-700 font-medium outline-none transition ${errors.password ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100'}`}
                                        />
                                        {errors.password && (
                                            <p className="mt-0.5 ml-1 text-[9px] font-medium text-rose-600">{errors.password}</p>
                                        )}
                                    </div>

                                    <motion.button
                                        whileHover={{ y: -1 }}
                                        whileTap={{ scale: 0.99 }}
                                        type="submit"
                                        className={`w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-md transition duration-300 ${loading
                                            ? 'cursor-wait bg-sky-400 shadow-sky-200'
                                            : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 shadow-sky-200/80 hover:shadow-lg'
                                            }`}
                                        disabled={loading}
                                    >
                                        {loading ? 'Submitting...' : 'Sign Up'}
                                    </motion.button>
                                </form>

                                <div className="mt-4 text-center">
                                    <p className="text-[11px] font-medium text-slate-500">
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
