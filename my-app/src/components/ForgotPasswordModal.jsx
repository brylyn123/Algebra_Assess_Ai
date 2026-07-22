import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { apiFetch } from '../fetchClient';

const backdrop = { hidden: { opacity: 0 }, show: { opacity: 1 } };
const modal = { hidden: { y: 24, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 300 } } };

export default function ForgotPasswordModal({ onClose }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [resetToken, setResetToken] = useState('');
    const [resetEmail, setResetEmail] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setResult(null);

        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }

        setLoading(true);
        try {
            const res = await apiFetch('/forgot_password.php', {
                method: 'POST',
                body: { email: email.trim() },
            });
            const data = await res.json();
            if (data.status === 'success') {
                setResult(data.message || 'Reset link generated.');
                setResetToken(data.reset_token || '');
                setResetEmail(data.email || email.trim());
            } else {
                setError(data.message || 'Unable to process your request.');
            }
        } catch (err) {
            setError('Unable to connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <AnimatePresence>
            <motion.div
                variants={backdrop}
                initial="hidden"
                animate="show"
                exit="hidden"
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    variants={modal}
                    initial="hidden"
                    animate="show"
                    exit="hidden"
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-sm rounded-2xl border border-white/60 bg-white p-6 shadow-2xl"
                >
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Reset Password</h2>
                            <p className="text-xs text-slate-500">We'll send you a reset link.</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                        </button>
                    </div>

                    {result ? (
                        <div className="space-y-3">
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-emerald-600">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <p className="text-sm font-medium text-emerald-800">{result}</p>
                                {resetEmail && (
                                    <p className="mt-1 text-xs text-emerald-600">
                                        Sent to: <span className="font-semibold">{resetEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')}</span>
                                    </p>
                                )}
                            </div>

                            {resetToken && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                    <p className="mb-1 text-[10px] font-bold uppercase text-amber-700">For testing — Reset link:</p>
                                    <Link
                                        to={`/reset-password?token=${resetToken}&email=${encodeURIComponent(resetEmail)}`}
                                        className="block break-all text-xs font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-800"
                                    >
                                        /reset-password?token={resetToken.slice(0, 8)}...{resetToken.slice(-4)}
                                    </Link>
                                    <p className="mt-1.5 text-[10px] text-amber-600">Click the link above to reset the password.</p>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label className="mb-1 block text-[10px] font-bold text-slate-600">Email address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                    placeholder="name@email.com"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center">
                                    <p className="text-[11px] font-medium text-rose-700">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full rounded-xl py-2.5 text-xs font-bold text-white transition ${
                                    loading
                                        ? 'cursor-wait bg-sky-400'
                                        : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:shadow-lg'
                                }`}
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full rounded-xl py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                            >
                                Cancel
                            </button>
                        </form>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
