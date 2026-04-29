import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { storeLocalUser, findLocalUser, setCurrentLocalUserEmail } from './localAuthStore';

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
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [message, setMessage] = useState('');
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);
    const [resultBanner, setResultBanner] = useState(null);
    const toastTimer = useRef(null);

    useEffect(() => () => clearTimeout(toastTimer.current), []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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

    const attemptLocalLogin = () => {
        const saved = findLocalUser(formData.email);
        if (!saved) {
            return false;
        }

        if (saved.password === formData.password) {
            showToast('Login successful (offline mode)', 'success');
            displayResultBanner('Login successful (offline mode)', 'success');
            setCurrentLocalUserEmail(saved.email);
            navigateByRole(saved.role);
            return true;
        }

        return false;
    };

    const displayResultBanner = (text, type = 'success') => {
        setResultBanner({ text, type });
        setTimeout(() => setResultBanner(null), 3200);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);

        try {
            const response = await fetch('http://localhost/Algebra_Assess_Ai/algebra-api/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const result = await response.json();

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
                    password: formData.password,
                });
                setCurrentLocalUserEmail(userData.email);
                displayResultBanner('Login successful!', 'success');
                navigateByRole(userData.role);
                return;
            }

            if (!attemptLocalLogin()) {
                setMessage(result.message || 'Invalid credentials.');
                showToast(result.message || 'Invalid credentials.', 'error');
                displayResultBanner(result.message || 'Invalid credentials.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            if (!attemptLocalLogin()) {
                setMessage('Error connecting to the server.');
                showToast('Error connecting to the server.', 'error');
                displayResultBanner('Error connecting to the server.', 'error');
            }
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
                <div className="absolute left-[10%] top-20 -z-10 h-48 w-48 rounded-full bg-white/35 blur-3xl" />
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
                            <div className="rounded-[1.7rem] border border-slate-100 bg-slate-50/95 p-7 sm:p-8">
                                <div className="mb-8 text-center">
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-lg shadow-sky-100">
                                        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.55-2.27A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.89L15 14" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
                                        </svg>
                                    </div>
                                    <h1 className="text-3xl font-black text-slate-900">Welcome</h1>
                                </div>

                                <form className="space-y-5" onSubmit={handleSubmit}>
                                    <div>
                                        <label className="mb-2 ml-1 block text-sm font-bold text-slate-600">Email address</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="name@email.com"
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-700 font-medium outline-none transition focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 ml-1 block text-sm font-bold text-slate-600">Password</label>
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            placeholder="Enter your password"
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-700 font-medium outline-none transition focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100"
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {toast && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                className={`w-full rounded-2xl border px-5 py-3 text-sm font-semibold ${
                                                    toast.type === 'success'
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-lg shadow-emerald-200/70'
                                                        : 'border-rose-200 bg-rose-50 text-rose-700 shadow-lg shadow-rose-200/70'
                                                }`}
                                            >
                                                {toast.text}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {message && (
                                        <div className="text-center">
                                            <p className="text-sm text-rose-600">{message}</p>
                                        </div>
                                    )}

                                    <motion.button
                                        whileHover={{ y: -2 }}
                                        whileTap={{ scale: 0.99 }}
                                        type="submit"
                                        className={`w-full rounded-2xl py-4 font-bold text-white shadow-lg transition duration-300 ${
                                            loading
                                                ? 'cursor-wait bg-sky-400 shadow-sky-200'
                                                : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 shadow-sky-200/80 hover:shadow-xl'
                                        }`}
                                        disabled={loading}
                                    >
                                        {loading ? 'Logging in...' : 'Login'}
                                    </motion.button>
                                </form>

                                <div className="mt-8 text-center">
                                    <p className="font-medium text-slate-500">
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
                        <div className="flex items-center gap-3 rounded-3xl border border-white/80 bg-white px-6 py-4 shadow-xl">
                            <svg className="h-10 w-10 animate-spin text-sky-500" viewBox="0 0 24 24">
                                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4z" />
                            </svg>
                            <div className="text-sm font-semibold text-slate-700">Checking credentials...</div>
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
                            <div className={`w-full max-w-xs rounded-2xl border px-5 py-3 text-center text-sm font-semibold ${
                                resultBanner.type === 'success'
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
