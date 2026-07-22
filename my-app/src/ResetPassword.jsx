import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiFetch } from './fetchClient';

const pageVariants = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const ResetPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const email = searchParams.get('email') || '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token || !email) {
            setError('Invalid or missing reset link. Please request a new one.');
        }
    }, [token, email]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!password) {
            setError('Please enter a new password.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password.length > 128) {
            setError('Password must be 128 characters or fewer.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await apiFetch('/reset_password.php', {
                method: 'POST',
                body: { token, email, password },
            });
            const data = await res.json();
            if (data.status === 'success') {
                setSuccess(true);
            } else {
                setError(data.message || 'Unable to reset password.');
            }
        } catch (err) {
            setError('Unable to connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            variants={pageVariants}
            initial="hidden"
            animate="show"
            className="flex min-h-screen items-center justify-center px-4 pt-20 pb-10"
        >
            <div className="w-full max-w-sm">
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 shadow-lg shadow-sky-400/25">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-white">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">Reset Password</h1>
                    <p className="text-sm text-slate-500">Enter your new password below.</p>
                </div>

                <div className="rounded-2xl border border-white/60 bg-white p-6 shadow-2xl backdrop-blur-xl">
                    {success ? (
                        <div className="space-y-4 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-emerald-600">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Password Reset!</h2>
                                <p className="mt-1 text-sm text-slate-500">Your password has been updated successfully.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-400/25 transition hover:brightness-110"
                            >
                                Go to Login
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {(!token || !email) && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center">
                                    <p className="text-xs font-medium text-rose-700">{error}</p>
                                    <Link to="/login" className="mt-2 inline-block text-xs font-bold text-indigo-600 underline">
                                        Back to Login
                                    </Link>
                                </div>
                            )}

                            <div>
                                <label className="mb-1 block text-[10px] font-bold text-slate-600">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                        placeholder="Min. 8 characters"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? (
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                            </svg>
                                        ) : (
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-[10px] font-bold text-slate-600">Confirm Password</label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                                    placeholder="Re-enter password"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>

                            {error && token && email && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center">
                                    <p className="text-xs font-medium text-rose-700">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !token || !email}
                                className={`w-full rounded-xl py-2.5 text-sm font-bold text-white transition ${
                                    loading || !token || !email
                                        ? 'cursor-not-allowed bg-slate-300'
                                        : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 shadow-lg shadow-sky-400/25 hover:brightness-110'
                                }`}
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>

                            <Link
                                to="/login"
                                className="block text-center text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-700"
                            >
                                Back to Login
                            </Link>
                        </form>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default ResetPassword;
