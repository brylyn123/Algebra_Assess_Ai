import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { storeLocalUser, findLocalUser, setCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';

const pageVariants = {
    hidden: { opacity: 0, y: 18 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: 'easeOut' },
    },
};

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [message, setMessage] = useState('');
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);
    const [resultBanner, setResultBanner] = useState(null);
    const [errors, setErrors] = useState({});
    const toastTimer = useRef(null);

    useEffect(() => {
        if (location?.state?.message) {
            setMessage(location.state.message);
            showToast(location.state.message, 'error');
        }

        return () => clearTimeout(toastTimer.current);
    }, [location]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (errors[name]) {
            setErrors({ ...errors, [name]: '' });
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const showToast = (text, type = 'success') => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ text, type });
        toastTimer.current = setTimeout(() => setToast(null), 3200);
    };

    const navigateByRole = (role = 'teacher') => {
        if (role === 'student') {
            navigate('/student');
        } else {
            navigate('/dashboard');
        }
    };

    const displayResultBanner = (text, type = 'success') => {
        setResultBanner({ text, type });
        setTimeout(() => setResultBanner(null), 3200);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/login.php`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const responseText = await response.text();
            let result = null;

            try {
                result = responseText ? JSON.parse(responseText) : null;
            } catch (parseError) {
                throw new Error(`Unexpected server response: ${responseText.slice(0, 120) || 'empty response'}`);
            }

            if (!response.ok && (!result || !result.message)) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            if (result.status === 'success') {
                const userData = result.user;
                const idToStore = userData.user_id || userData.teacher_id;
                if (idToStore) {
                    localStorage.setItem('teacher_id', idToStore);
                }
                const existingLocalUser = findLocalUser(userData.email) || {};
                storeLocalUser({
                    ...existingLocalUser,
                    ...userData,
                });
                setCurrentLocalUserEmail(userData.email);
                displayResultBanner('Login successful!', 'success');
                navigateByRole(userData.role);
                return;
            }

            setMessage(result.message || 'Invalid credentials.');
            showToast(result.message || 'Invalid credentials.', 'error');
            displayResultBanner(result.message || 'Invalid credentials.', 'error');
        } catch (error) {
            console.error('Login error:', error);
            const friendlyMessage = error instanceof Error ? error.message : 'Error connecting to the server.';
            setMessage(friendlyMessage);
            showToast(friendlyMessage, 'error');
            displayResultBanner(friendlyMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

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
                                <p className="text-[9px] font-medium text-white/70">Login to continue</p>
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

                <main className="mx-auto flex min-h-[calc(100vh-56px)] max-w-7xl items-center justify-center px-6 py-8 lg:px-10">
                    <motion.section initial="hidden" animate="show" variants={pageVariants} className="relative w-full max-w-sm">
                        <div className="auth-card p-4">
                            <div className="auth-panel p-5">
                                <div className="mb-6 text-center">
                                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-md shadow-sky-100">
                                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.55-2.27A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.89L15 14" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
                                        </svg>
                                    </div>
                                    <p className="auth-badge mx-auto mb-2">Welcome back</p>
                                    <h1 className="text-xl font-black text-slate-900">Sign In</h1>
                                    <p className="mt-1 text-[11px] text-slate-500">Access your dashboard and classes.</p>
                                </div>

                                <form className="space-y-3" onSubmit={handleSubmit}>
                                    <div>
                                        <label className="mb-1 ml-1 block text-[10px] font-bold text-slate-600">Email address</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="name@email.com"
                                            className={`auth-input ${errors.email ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`}
                                        />
                                        {errors.email && (
                                            <p className="mt-1 ml-1 text-[10px] font-medium text-rose-600">{errors.email}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1 ml-1 block text-[10px] font-bold text-slate-600">Password</label>
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            placeholder="Enter your password"
                                            className={`auth-input ${errors.password ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`}
                                        />
                                        {errors.password && (
                                            <p className="mt-1 ml-1 text-[10px] font-medium text-rose-600">{errors.password}</p>
                                        )}
                                    </div>

                                    <AnimatePresence>
                                        {toast && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                className={`w-full rounded-xl border px-3 py-2 text-[11px] font-semibold ${toast.type === 'success'
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                    : 'border-rose-200 bg-rose-50 text-rose-700'
                                                    }`}
                                            >
                                                {toast.text}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {message && (
                                        <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-center">
                                            <p className="text-[11px] font-medium text-rose-700">{message}</p>
                                        </div>
                                    )}

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
                                        {loading ? 'Logging in...' : 'Login'}
                                    </motion.button>
                                </form>

                                <div className="mt-5 text-center">
                                    <p className="text-[11px] font-medium text-slate-500">
                                        Don't have an account?
                                        <button onClick={() => navigate('/signup')} className="ml-1 font-bold text-indigo-500 transition hover:text-indigo-600">
                                            Register
                                        </button>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.section>
                </main>

                {loading && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
                        <div className="flex items-center gap-2 rounded-xl border border-white/80 bg-white px-4 py-3 shadow-xl">
                            <svg className="h-5 w-5 animate-spin text-sky-500" viewBox="0 0 24 24">
                                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4z" />
                            </svg>
                            <div className="text-[11px] font-semibold text-slate-700">Checking credentials...</div>
                        </div>
                    </div>
                )}

                <AnimatePresence>
                    {resultBanner && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
                        >
                            <div className={`w-full max-w-xs rounded-2xl border px-5 py-3 text-center text-sm font-semibold ${resultBanner.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-lg shadow-emerald-200/70'
                                : 'border-rose-200 bg-rose-50 text-rose-700 shadow-lg shadow-rose-200/70'
                                }`}>
                                {resultBanner.text}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Login;
