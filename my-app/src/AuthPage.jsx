import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { storeLocalUser, findLocalUser, setCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';
import { apiFetch } from './fetchClient';
import { clearCsrfToken } from './csrf';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import Select from './components/Select';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const containerVariant = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
};

const fieldVariant = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const fadeIn = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
    exit: { opacity: 0, y: -12, transition: { duration: 0.25 } },
};

const AuthPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [mode, setMode] = useState('login');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [message, setMessage] = useState('');

    const [loginData, setLoginData] = useState({ email: '', password: '' });
    const [signupData, setSignupData] = useState({
        firstName: '',
        middleName: '',
        lastName: '',
        idNumber: '',
        collegeId: '',
        courseId: '',
        sectionId: '',
        yearId: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [role, setRole] = useState('teacher');
    const [registrationOptions, setRegistrationOptions] = useState({
        colleges: [],
        courses: [],
        sections: [],
        years: [],
    });
    const [optionsLoading, setOptionsLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const googleBtnRef = useRef(null);

    const handleGoogleCredential = useCallback(async (credential) => {
        setGoogleLoading(true);
        setMessage('');
        try {
            const response = await apiFetch('/google_auth.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential }),
            });
            const result = await response.json();
            if (result.status === 'success') {
                clearCsrfToken();
                const userData = result.user;
                const idToStore = userData.user_id || userData.teacher_id;
                if (idToStore) localStorage.setItem('teacher_id', idToStore);
                const existingLocalUser = findLocalUser(userData.email) || {};
                storeLocalUser({ ...existingLocalUser, ...userData });
                setCurrentLocalUserEmail(userData.email);
                navigateByRole(userData.role);
                return;
            }
            setMessage(result.message || 'Google sign-in failed.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Error connecting to the server.');
        } finally {
            setGoogleLoading(false);
        }
    }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID) return;

        const initGoogleSignIn = () => {
            if (!window.google || !window.google.accounts) return;

            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: (response) => {
                    if (response.credential) {
                        handleGoogleCredential(response.credential);
                    }
                },
                auto_select: false,
                lang: 'en',
            });

            if (googleBtnRef.current) {
                renderGoogleButton();
            }
        };

        const renderGoogleButton = () => {
            if (!googleBtnRef.current || !window.google || !window.google.accounts) return;
            googleBtnRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleBtnRef.current, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                width: '100%',
                text: 'continue_with',
                shape: 'rectangular',
                lang: 'en',
            });
        };

        const loadGoogleScript = () => {
            if (document.getElementById('google-identity-script')) {
                initGoogleSignIn();
                return;
            }

            const script = document.createElement('script');
            script.id = 'google-identity-script';
            script.src = 'https://accounts.google.com/gsi/client?hl=en';
            script.async = true;
            script.defer = true;
            script.onload = () => initGoogleSignIn();
            document.head.appendChild(script);
        };

        if (window.google && window.google.accounts) {
            initGoogleSignIn();
        } else {
            loadGoogleScript();
        }

        const retryInterval = setInterval(() => {
            if (googleBtnRef.current && window.google && window.google.accounts && googleBtnRef.current.childElementCount === 0) {
                renderGoogleButton();
            }
        }, 500);

        const stopRetry = setTimeout(() => clearInterval(retryInterval), 10000);

        return () => { clearInterval(retryInterval); clearTimeout(stopRetry); };
    }, [handleGoogleCredential, mode]);

    useEffect(() => {
        window.history.replaceState({}, '');
    }, []);

    useEffect(() => {
        if (mode !== 'signup') return;
        let isMounted = true;
        const controller = new AbortController();

        const loadOptions = async () => {
            setOptionsLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/get_registration_options.php`, {
                    signal: controller.signal,
                });
                const text = await response.text();
                if (!response.ok) throw new Error(text || 'Unable to load registration options.');
                const payload = JSON.parse(text);
                if (payload.status !== 'success') throw new Error(payload.message || 'Unable to load registration options.');
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
                if (isMounted) setRegistrationOptions({ colleges: [], courses: [], sections: [], years: [] });
            } finally {
                if (isMounted) setOptionsLoading(false);
            }
        };
        loadOptions();
        return () => { isMounted = false; controller.abort(); };
    }, [mode]);

    useEffect(() => {
        if (!signupData.collegeId) return;
        const selectedCourseStillMatches = registrationOptions.courses.some((course) => (
            String(course.course_id) === String(signupData.courseId)
            && (!course.college_id || String(course.college_id) === String(signupData.collegeId))
        ));
        if (!selectedCourseStillMatches && signupData.courseId) {
            setSignupData((prev) => ({ ...prev, courseId: '' }));
        }
    }, [signupData.collegeId, signupData.courseId, registrationOptions.courses]);

    const handleLoginChange = (e) => {
        const { name, value } = e.target;
        setLoginData({ ...loginData, [name]: value });
        if (errors[name]) setErrors({ ...errors, [name]: '' });
    };

    const handleSignupChange = (e) => {
        const { name, value } = e.target;
        setSignupData({ ...signupData, [name]: value });
        if (errors[name]) setErrors({ ...errors, [name]: '' });
    };

    const validateLogin = () => {
        const newErrors = {};
        if (!loginData.email.trim()) newErrors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email)) newErrors.email = 'Please enter a valid email';
        if (!loginData.password) newErrors.password = 'Password is required';
        else if (loginData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateSignup = () => {
        const newErrors = {};
        if (!signupData.firstName.trim()) newErrors.firstName = 'First name is required';
        if (!signupData.lastName.trim()) newErrors.lastName = 'Last name is required';
        if (!signupData.idNumber.trim()) newErrors.idNumber = 'ID number is required';
        if (!signupData.email.trim()) newErrors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupData.email)) newErrors.email = 'Please enter a valid email';
        if (!signupData.password) newErrors.password = 'Password is required';
        else if (signupData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
        if (!signupData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
        else if (signupData.confirmPassword !== signupData.password) newErrors.confirmPassword = 'Passwords do not match';
        if (role === 'student' && !signupData.courseId) newErrors.courseId = 'Please select a course';
        if (role === 'student' && !signupData.sectionId) newErrors.sectionId = 'Please select a section';
        if (role === 'student' && !signupData.yearId) newErrors.yearId = 'Please select a year level';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const navigateByRole = (roleName = 'teacher') => {
        navigate(roleName === 'student' ? '/student' : '/dashboard');
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        if (!validateLogin()) return;
        setLoading(true);
        try {
            const response = await apiFetch('/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData),
            });
            const responseText = await response.text();
            let result = null;
            try { result = responseText ? JSON.parse(responseText) : null; }
            catch { throw new Error(`Unexpected server response: ${responseText.slice(0, 120) || 'empty'}`); }
            if (!response.ok && (!result || !result.message)) throw new Error(`Request failed with status ${response.status}`);
            if (result.status === 'success') {
                clearCsrfToken();
                const userData = result.user;
                const idToStore = userData.user_id || userData.teacher_id;
                if (idToStore) localStorage.setItem('teacher_id', idToStore);
                const existingLocalUser = findLocalUser(userData.email) || {};
                storeLocalUser({ ...existingLocalUser, ...userData });
                setCurrentLocalUserEmail(userData.email);
                navigateByRole(userData.role);
                return;
            }
            setMessage(result.message || 'Invalid credentials.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Error connecting to the server.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignupSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        if (!validateSignup()) return;
        setLoading(true);
        const payload = {
            firstName: signupData.firstName,
            middleName: signupData.middleName,
            lastName: signupData.lastName,
            idNumber: signupData.idNumber,
            email: signupData.email,
            password: signupData.password,
            role,
            collegeId: signupData.collegeId,
            collegeName: '',
            courseId: signupData.courseId,
            courseName: '',
            sectionId: signupData.sectionId,
            yearId: signupData.yearId,
        };
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
                    name: `${signupData.firstName} ${signupData.lastName}`,
                    email: signupData.email,
                };
                localStorage.setItem('user', JSON.stringify(userSession));
                storeLocalUser({
                    ...userSession,
                    user_id: result.user_id,
                    student_id: result.user_id,
                    firstName: signupData.firstName,
                    middleName: signupData.middleName,
                    lastName: signupData.lastName,
                    idNumber: signupData.idNumber,
                    institutional_id: signupData.idNumber,
                    collegeId: signupData.collegeId,
                    courseId: signupData.courseId,
                    sectionId: signupData.sectionId,
                    yearId: signupData.yearId,
                });
                setMode('login');
                setMessage('');
                setLoginData({ email: signupData.email, password: '' });
            } else {
                setMessage(result.message || 'Registration failed.');
            }
        } catch {
            setMessage('Error connecting to server.');
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setErrors({});
        setMessage('');
        setShowPassword(false);
        setShowConfirmPassword(false);
    };

    const inputClasses = (hasError) =>
        `w-full rounded-xl border bg-slate-50/80 px-3.5 py-2.5 pl-10 text-sm text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-400 ${
            hasError
                ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100'
                : 'border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:bg-white'
        }`;

    const selectClasses = (hasError) =>
        `w-full appearance-none rounded-xl border bg-slate-50/80 px-3.5 py-2.5 pl-10 pr-10 text-sm text-slate-700 outline-none transition-all duration-200 ${
            hasError
                ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100'
                : 'border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:bg-white'
        } disabled:cursor-not-allowed disabled:opacity-60`;

    return (
        <div className="relative min-h-screen overflow-x-hidden">

            {/* Header */}
            <header className="sticky top-0 z-50 bg-blue-600 text-white shadow-md">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
                    <div
                        onClick={() => navigate('/')}
                        className="flex cursor-pointer items-center gap-2.5 sm:gap-3"
                        role="button"
                        aria-label="Go back to landing page"
                    >
                        <div className="rounded-xl bg-white/20 p-2 sm:p-2.5 text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm sm:text-lg font-black tracking-tight text-white">AlgebraAssess</p>
                            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-white/70">AI Classroom Grading</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="rounded-full border border-white/20 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
                    >
                        Back to Landing
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto flex min-h-[calc(100vh-60px)] items-center justify-center px-4 py-8 sm:py-12">
                <div
                    className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/88 shadow-[0_25px_70px_rgba(59,130,246,0.18)] backdrop-blur-xl sm:rounded-[2.25rem]"
                >
                    <div className="flex flex-col lg:flex-row">
                        {/* Left Panel */}
                        <div
                            className="relative flex min-h-[180px] flex-col items-center justify-center overflow-hidden px-6 py-10 sm:min-h-[200px] lg:min-h-[520px] lg:w-[38%]"
                            style={{
                                background: mode === 'login'
                                    ? 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #6366f1 100%)'
                                    : 'linear-gradient(135deg, #4f46e5 0%, #2563eb 50%, #0891b2 100%)',
                            }}
                        >
                            {/* Animated background circles */}
                            <div className="absolute inset-0 overflow-hidden">
                                <motion.div
                                    animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
                                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                                    className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/20"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
                                    transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                                    className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-white/15"
                                />
                                <motion.div
                                    animate={{ y: [0, -10, 0], opacity: [0.08, 0.15, 0.08] }}
                                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                                    className="absolute left-1/2 top-1/3 h-48 w-48 rounded-full bg-white/10"
                                />
                            </div>

                            {/* Floating badges */}
                            <div className="absolute left-4 top-6 hidden lg:block">
                                <motion.div
                                    animate={{ y: [0, -5, 0] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur-sm"
                                >
                                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                    AI-Powered Grading
                                </motion.div>
                            </div>
                            <div className="absolute right-4 top-10 hidden lg:block">
                                <motion.div
                                    animate={{ y: [0, -6, 0] }}
                                    transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
                                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur-sm"
                                >
                                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                                    Instant Feedback
                                </motion.div>
                            </div>
                            <div className="absolute bottom-6 left-4 hidden lg:block">
                                <motion.div
                                    animate={{ y: [0, -4, 0] }}
                                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur-sm"
                                >
                                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                    Rubric-First System
                                </motion.div>
                            </div>

                            {/* Center content */}
                            <div className="relative z-10 text-center">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.7, delay: 0.2 }}
                                >
                                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm sm:h-16 sm:w-16">
                                        {mode === 'login' ? (
                                            <svg viewBox="0 0 24 24" className="h-7 w-7 sm:h-8 sm:w-8 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                            </svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" className="h-7 w-7 sm:h-8 sm:w-8 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                                            </svg>
                                        )}
                                    </div>
                                    <h2 className="mb-2 text-2xl font-black text-white sm:text-2xl">
                                        {mode === 'login' ? 'Welcome Back!' : 'Join AlgebraAssess'}
                                    </h2>
                                    <p className="mb-6 max-w-[220px] text-xs text-white/75 sm:text-sm">
                                        {mode === 'login'
                                            ? 'Sign in to continue grading with AI-powered feedback'
                                            : 'Create your account to start grading smarter'}
                                    </p>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                                        className="rounded-full border-2 border-white/40 bg-white/10 px-7 py-2 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm transition-all duration-200 hover:border-white/60 hover:bg-white/20 sm:px-8 sm:py-2.5"
                                    >
                                        {mode === 'login' ? 'Sign Up' : 'Sign In'}
                                    </motion.button>
                                </motion.div>
                            </div>

                            {/* Feature bullets - bottom */}
                            <div className="absolute bottom-6 left-0 right-0 hidden px-6 lg:block">
                                <div className="space-y-2">
                                    {[
                                        'Handwriting OCR extraction',
                                        'Consistent rubric-based grading',
                                        'Instant student feedback',
                                    ].map((feature) => (
                                        <div key={feature} className="flex items-center gap-2.5 text-xs text-white/70">
                                            <svg className="h-4 w-4 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            {feature}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Panel - Form */}
                        <div className="flex w-full items-center justify-center px-5 py-7 sm:px-7 sm:py-8 lg:w-[62%] lg:px-10">
                            <div className="w-full max-w-sm">
                                <AnimatePresence mode="wait">
                                    {mode === 'login' ? (
                                        <motion.div key="login" variants={fadeIn} initial="hidden" animate="show" exit="exit">
                                            <h2 className="mb-1 text-xl font-black text-slate-950 sm:text-2xl">Sign In</h2>
                                            <p className="mb-5 text-xs text-slate-500">Enter your credentials to access your account</p>

                                            {message && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
                                                >
                                                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                                    </svg>
                                                    {message}
                                                </motion.div>
                                            )}

                                            <form onSubmit={handleLoginSubmit} className="space-y-3">
                                                <motion.div variants={fieldVariant}>
                                                    <label className="mb-1 block text-xs font-semibold text-slate-600">Email</label>
                                                    <div className="relative">
                                                        <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                                        </svg>
                                                        <input
                                                            type="email"
                                                            name="email"
                                                            value={loginData.email}
                                                            onChange={handleLoginChange}
                                                            placeholder="you@example.com"
                                                            className={inputClasses(errors.email)}
                                                        />
                                                    </div>
                                                    {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email}</p>}
                                                </motion.div>

                                                <motion.div variants={fieldVariant}>
                                                    <label className="mb-1 block text-xs font-semibold text-slate-600">Password</label>
                                                    <div className="relative">
                                                        <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                                        </svg>
                                                        <input
                                                            type={showPassword ? 'text' : 'password'}
                                                            name="password"
                                                            value={loginData.password}
                                                            onChange={handleLoginChange}
                                                            placeholder="Enter your password"
                                                            className={inputClasses(errors.password) + ' pr-11'}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                                                            tabIndex={-1}
                                                        >
                                                            {showPassword ? (
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.573 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                                                </svg>
                                                                ) : (
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                    {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
                                                </motion.div>

                                                <motion.div variants={fieldVariant} className="flex justify-end">
                                                    <button type="button" onClick={() => setShowForgotModal(true)} className="text-xs font-semibold text-blue-600 transition hover:text-blue-700">
                                                        Forgot Password?
                                                    </button>
                                                </motion.div>

                                                <motion.div variants={fieldVariant} className="flex justify-center">
                                                    {GOOGLE_CLIENT_ID ? (
                                                        <div ref={googleBtnRef} className="w-full [&>div]:w-full [&>div>div]:w-full" />
                                                    ) : (
                                                        <div className="w-full">
                                                            <button type="button" disabled className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-400 shadow-sm cursor-not-allowed opacity-50">
                                                                <svg viewBox="0 0 24 24" className="h-5 w-5">
                                                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                                                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                                                </svg>
                                                                <span>Sign in with Google</span>
                                                            </button>
                                                            <p className="mt-2 text-center text-[10px] text-slate-400">Set <code className="font-mono bg-slate-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> in <code className="font-mono bg-slate-100 px-1 rounded">.env</code> to enable</p>
                                                        </div>
                                                    )}
                                                </motion.div>

                                                <motion.div variants={fieldVariant}>
                                                    <motion.button
                                                        whileHover={{ scale: 1.01, y: -2 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        type="submit"
                                                        disabled={loading}
                                                        className={`w-full rounded-xl py-2.5 text-sm font-bold text-white shadow-lg transition-all duration-200 ${
                                                            loading
                                                                ? 'bg-blue-400 cursor-not-allowed shadow-blue-200/50'
                                                                : 'bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 shadow-blue-500/25 hover:shadow-[0_15px_40px_rgba(125,211,252,0.3)]'
                                                        }`}
                                                    >
                                                        {loading ? (
                                                            <span className="flex items-center justify-center gap-2">
                                                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                                </svg>
                                                                Signing in...
                                                            </span>
                                                        ) : 'Sign In'}
                                                    </motion.button>
                                                </motion.div>
                                            </form>
                                        </motion.div>
                                    ) : (
                                        <motion.div key="signup" variants={fadeIn} initial="hidden" animate="show" exit="exit">
                                            <h2 className="mb-1 text-xl font-black text-slate-950 sm:text-2xl">Create Account</h2>
                                            <p className="mb-4 text-xs text-slate-500">Fill in the form to create your account</p>

                                            {message && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
                                                >
                                                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                                    </svg>
                                                    {message}
                                                </motion.div>
                                            )}

                                            {/* Role Toggle */}
                                            <div className="mb-4 flex rounded-full border border-slate-200 bg-slate-50/80 p-1">
                                                {['teacher', 'student'].map((r) => (
                                                    <button
                                                        key={r}
                                                        type="button"
                                                        onClick={() => { setRole(r); setErrors({}); }}
                                                        className={`flex-1 rounded-full px-4 py-2.5 text-xs font-bold transition-all duration-300 ${
                                                            role === r
                                                                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/25'
                                                                : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50/50'
                                                        }`}
                                                    >
                                                        {r === 'teacher' ? 'Teacher' : 'Student'}
                                                    </button>
                                                ))}
                                            </div>

                                            <form onSubmit={handleSignupSubmit} className="space-y-3">
                                                <motion.div variants={containerVariant} initial="hidden" animate="show" className="space-y-3">
                                                    <motion.div variants={fieldVariant} className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="mb-1 block text-xs font-semibold text-slate-600">First Name</label>
                                                            <div className="relative">
                                                                <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                                                </svg>
                                                                <input name="firstName" value={signupData.firstName} onChange={handleSignupChange} placeholder="John" className={inputClasses(errors.firstName)} />
                                                            </div>
                                                            {errors.firstName && <p className="mt-1.5 text-xs text-red-500">{errors.firstName}</p>}
                                                        </div>
                                                        <div>
                                                            <label className="mb-1 block text-xs font-semibold text-slate-600">Last Name</label>
                                                            <div className="relative">
                                                                <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                                                </svg>
                                                                <input name="lastName" value={signupData.lastName} onChange={handleSignupChange} placeholder="Doe" className={inputClasses(errors.lastName)} />
                                                            </div>
                                                            {errors.lastName && <p className="mt-1.5 text-xs text-red-500">{errors.lastName}</p>}
                                                        </div>
                                                    </motion.div>

                                                    <motion.div variants={fieldVariant}>
                                                        <label className="mb-1 block text-xs font-semibold text-slate-600">Middle Name <span className="text-slate-400">(optional)</span></label>
                                                        <div className="relative">
                                                            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                                            </svg>
                                                            <input name="middleName" value={signupData.middleName} onChange={handleSignupChange} placeholder="Michael" className={inputClasses(false)} />
                                                        </div>
                                                    </motion.div>

                                                    <motion.div variants={fieldVariant}>
                                                        <label className="mb-1 block text-xs font-semibold text-slate-600">{role === 'teacher' ? 'Employee ID' : 'Student ID'}</label>
                                                        <div className="relative">
                                                            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                                                            </svg>
                                                            <input name="idNumber" value={signupData.idNumber} onChange={handleSignupChange} placeholder={role === 'teacher' ? 'e.g., EMP-2024-001' : 'e.g., STU-2024-001'} className={inputClasses(errors.idNumber)} />
                                                        </div>
                                                        {errors.idNumber && <p className="mt-1.5 text-xs text-red-500">{errors.idNumber}</p>}
                                                    </motion.div>

                                                    {role === 'teacher' ? (
                                                        <motion.div variants={fieldVariant}>
                                                            <label className="mb-1 block text-xs font-semibold text-slate-600">College</label>
                                                            <div className="relative">
                                                                <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                                                                </svg>
                                                                <Select name="collegeId" value={signupData.collegeId} onChange={handleSignupChange} disabled={optionsLoading} placeholder="Select College" className={selectClasses(false)}>
                                                                    {registrationOptions.colleges.map((c) => (
                                                                        <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                                                                    ))}
                                                                </Select>
                                                            </div>
                                                        </motion.div>
                                                    ) : (
                                                        <>
                                                            <motion.div variants={fieldVariant}>
                                                                <label className="mb-1 block text-xs font-semibold text-slate-600">Course</label>
                                                                <div className="relative">
                                                                    <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                                                    </svg>
                                                                    <Select name="courseId" value={signupData.courseId} onChange={handleSignupChange} disabled={optionsLoading} placeholder="Select Course" className={selectClasses(errors.courseId)}>
                                                                        {registrationOptions.courses.map((c) => (
                                                                            <option key={c.course_id} value={c.course_id}>{c.course_name} ({c.course_code})</option>
                                                                        ))}
                                                                    </Select>
                                                                </div>
                                                                {errors.courseId && <p className="mt-1.5 text-xs text-red-500">{errors.courseId}</p>}
                                                            </motion.div>
                                                            <motion.div variants={fieldVariant} className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="mb-1 block text-xs font-semibold text-slate-600">Year Level</label>
                                                                    <div className="relative">
                                                                        <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                                                        </svg>
                                                                        <Select name="yearId" value={signupData.yearId} onChange={handleSignupChange} disabled={optionsLoading} placeholder="Year Level" className={selectClasses(errors.yearId)}>
                                                                            {registrationOptions.years.map((y) => (
                                                                                <option key={y.year_id} value={y.year_id}>{y.year_level}</option>
                                                                            ))}
                                                                        </Select>
                                                                    </div>
                                                                    {errors.yearId && <p className="mt-1.5 text-xs text-red-500">{errors.yearId}</p>}
                                                                </div>
                                                                <div>
                                                                    <label className="mb-1 block text-xs font-semibold text-slate-600">Section</label>
                                                                    <div className="relative">
                                                                        <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                                                        </svg>
                                                                        <Select name="sectionId" value={signupData.sectionId} onChange={handleSignupChange} disabled={optionsLoading} placeholder="Section" className={selectClasses(errors.sectionId)}>
                                                                            {registrationOptions.sections.map((s) => (
                                                                                <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                                                                            ))}
                                                                        </Select>
                                                                    </div>
                                                                    {errors.sectionId && <p className="mt-1.5 text-xs text-red-500">{errors.sectionId}</p>}
                                                                </div>
                                                            </motion.div>
                                                        </>
                                                    )}

                                                    <motion.div variants={fieldVariant}>
                                                    <label className="mb-1 block text-xs font-semibold text-slate-600">Email</label>
                                                        <div className="relative">
                                                            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                                            </svg>
                                                            <input type="email" name="email" value={signupData.email} onChange={handleSignupChange} placeholder="you@example.com" className={inputClasses(errors.email)} />
                                                        </div>
                                                        {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email}</p>}
                                                    </motion.div>

                                                    <motion.div variants={fieldVariant}>
                                                        <label className="mb-1 block text-xs font-semibold text-slate-600">Password</label>
                                                        <div className="relative">
                                                            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                                            </svg>
                                                            <input type={showPassword ? 'text' : 'password'} name="password" value={signupData.password} onChange={handleSignupChange} placeholder="Min 8 characters" className={inputClasses(errors.password) + ' pr-11'} />
                                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600" tabIndex={-1}>
                                                                {showPassword ? (
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.573 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                                                                ) : (
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                        {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
                                                    </motion.div>

                                                    <motion.div variants={fieldVariant}>
                                                        <label className="mb-1 block text-xs font-semibold text-slate-600">Confirm Password</label>
                                                        <div className="relative">
                                                            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                                            </svg>
                                                            <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={signupData.confirmPassword} onChange={handleSignupChange} placeholder="Re-enter your password" className={inputClasses(errors.confirmPassword) + ' pr-11'} />
                                                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600" tabIndex={-1}>
                                                                {showConfirmPassword ? (
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.573 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                                                                ) : (
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                        {errors.confirmPassword && <p className="mt-1.5 text-xs text-red-500">{errors.confirmPassword}</p>}
                                                    </motion.div>
                                                </motion.div>

                                                <motion.div variants={fieldVariant} className="pt-1">
                                                    <motion.button
                                                        whileHover={{ scale: 1.01, y: -2 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        type="submit"
                                                        disabled={loading}
                                                        className={`w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg transition-all duration-200 ${
                                                            loading
                                                                ? 'bg-blue-400 cursor-not-allowed shadow-blue-200/50'
                                                                : 'bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 shadow-blue-500/25 hover:shadow-[0_15px_40px_rgba(125,211,252,0.3)]'
                                                        }`}
                                                    >
                                                        {loading ? (
                                                            <span className="flex items-center justify-center gap-2">
                                                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                                </svg>
                                                                Creating account...
                                                            </span>
                                                        ) : 'Create Account'}
                                                    </motion.button>
                                                </motion.div>
                                            </form>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200/60 bg-white/60 backdrop-blur-sm">
                <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between sm:px-6 sm:py-8 lg:px-10">
                    <div className="flex items-center gap-2.5">
                        <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-1.5 text-white shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <span className="text-sm font-black text-slate-950">AlgebraAssess</span>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6">
                        <span className="cursor-pointer text-xs text-slate-400 transition hover:text-slate-600">About Us</span>
                        <span className="cursor-pointer text-xs text-slate-400 transition hover:text-slate-600">Privacy Policy</span>
                        <span className="cursor-pointer text-xs text-slate-400 transition hover:text-slate-600">Terms</span>
                    </div>
                    <p className="text-xs text-slate-400">&copy; 2026 AlgebraAssess. All rights reserved.</p>
                </div>
            </footer>

            {showForgotModal && <ForgotPasswordModal onClose={() => setShowForgotModal(false)} />}
        </div>
    );
};

export default AuthPage;
