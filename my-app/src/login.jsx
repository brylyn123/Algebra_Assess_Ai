import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { storeLocalUser, findLocalUser, setCurrentLocalUserEmail } from './localAuthStore';
import { apiFetch } from './fetchClient';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import { useToast } from './components/Toast';

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
    const { toast } = useToast();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [showForgotModal, setShowForgotModal] = useState(false);

    useEffect(() => {
        if (location?.state?.message) {
            toast.error(location.state.message);
            window.history.replaceState({}, '');
        }
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

    const navigateByRole = (role = 'teacher') => {
        if (role === 'student') {
            navigate('/student');
        } else {
            navigate('/dashboard');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            const response = await apiFetch('/login.php', {
                method: 'POST',
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
                toast.success('Login successful!');
                navigateByRole(userData.role);
                return;
            }

            toast.error(result.message || 'Invalid credentials.');
        } catch (error) {
            console.error('Login error:', error);
            const friendlyMessage = error instanceof Error ? error.message : 'Error connecting to the server.';
            toast.error(friendlyMessage);
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
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                placeholder="Enter your password"
                                                className={`auth-input pr-10 ${errors.password ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                                    </svg>
                                                ) : (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                        {errors.password && (
                                            <p className="mt-1 ml-1 text-[10px] font-medium text-rose-600">{errors.password}</p>
                                        )}
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotModal(true)}
                                            className="text-[10px] font-semibold text-indigo-500 transition hover:text-indigo-600 hover:underline"
                                        >
                                            Forgot Password?
                                        </button>
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

                {showForgotModal && (
                    <ForgotPasswordModal onClose={() => setShowForgotModal(false)} />
                )}
            </div>
        </div>
    );
};

export default Login;
