import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { apiFetch } from '../fetchClient';

const backdrop = { hidden: { opacity: 0 }, show: { opacity: 1 } };
const modal = { hidden: { y: 24, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 300 } } };

const OTP_LENGTH = 6;

export default function ForgotPasswordModal({ onClose }) {
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [maskedEmail, setMaskedEmail] = useState('');
    const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
    const [otpValues, setOtpValues] = useState(Array(OTP_LENGTH).fill(''));
    const [otpDevCode, setOtpDevCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [resendTimer, setResendTimer] = useState(0);
    const otpRefs = useRef([]);

    // Countdown timer for resend
    useEffect(() => {
        if (resendTimer <= 0) return;
        const interval = setInterval(() => {
            setResendTimer((prev) => {
                if (prev <= 1) { clearInterval(interval); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!email.trim()) {
            setError('Please enter your email address.');
            return;
        }

        setLoading(true);
        try {
            const res = await apiFetch('/forgot_password.php', {
                method: 'POST',
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json();
            if (data.status === 'success' && data.otp_sent) {
                setMaskedEmail(data.maskedEmail || email.trim());
                setOtpDevCode(data.otp || '');
                setSuccessMsg(data.message || 'A reset code has been sent.');
                setStep('otp');
                setResendTimer(60);
                // Focus first OTP input
                setTimeout(() => otpRefs.current[0]?.focus(), 100);
            } else if (data.status === 'success' && !data.otp_sent) {
                setError('No account found with that email address.');
            } else {
                setError(data.message || 'Unable to process your request.');
            }
        } catch {
            setError('Unable to connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setError('');
        setSuccessMsg('');
        setLoading(true);
        try {
            const res = await apiFetch('/forgot_password.php', {
                method: 'POST',
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json();
            if (data.status === 'success' && data.otp_sent) {
                setOtpDevCode(data.otp || '');
                setSuccessMsg('A new code has been sent.');
                setResendTimer(60);
                setOtpValues(Array(OTP_LENGTH).fill(''));
                setTimeout(() => otpRefs.current[0]?.focus(), 100);
            } else {
                setError(data.message || 'Unable to resend code.');
            }
        } catch {
            setError('Unable to connect to the server.');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otpValues];
        newOtp[index] = value.slice(-1);
        setOtpValues(newOtp);
        setError('');

        // Auto-focus next input
        if (value && index < OTP_LENGTH - 1) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (pasted) {
            const newOtp = Array(OTP_LENGTH).fill('');
            for (let i = 0; i < pasted.length; i++) {
                newOtp[i] = pasted[i];
            }
            setOtpValues(newOtp);
            otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        const otpString = otpValues.join('');

        if (otpString.length !== OTP_LENGTH) {
            setError(`Please enter all ${OTP_LENGTH} digits.`);
            return;
        }

        setLoading(true);
        try {
            const res = await apiFetch('/verify_otp.php', {
                method: 'POST',
                body: JSON.stringify({ email: email.trim(), otp: otpString }),
            });
            const data = await res.json();
            if (data.status === 'success') {
                setStep('reset');
                setSuccessMsg(data.message || 'OTP verified. Set your new password.');
            } else {
                setError(data.message || 'Invalid OTP.');
            }
        } catch {
            setError('Unable to connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');

        if (!newPassword) {
            setError('Please enter a new password.');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await apiFetch('/reset_password.php', {
                method: 'POST',
                body: JSON.stringify({
                    email: email.trim(),
                    otp: otpValues.join(''),
                    password: newPassword,
                }),
            });
            const data = await res.json();
            if (data.status === 'success') {
                setStep('done');
                setSuccessMsg(data.message || 'Password has been reset successfully.');
            } else {
                setError(data.message || 'Unable to reset password.');
            }
        } catch {
            setError('Unable to connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const stepLabels = { email: '1/3', otp: '2/3', reset: '3/3', done: '' };
    const stepTitles = {
        email: 'Reset Password',
        otp: 'Verify Code',
        reset: 'New Password',
        done: 'Password Reset',
    };
    const stepSubtitles = {
        email: 'Enter your email to receive a reset code.',
        otp: `Enter the 6-digit code sent to ${maskedEmail}.`,
        reset: 'Create your new password.',
        done: 'Your password has been updated.',
    };

    return createPortal(
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
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-slate-900">{stepTitles[step]}</h2>
                            {stepLabels[step] && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{stepLabels[step]}</span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500">{stepSubtitles[step]}</p>
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

                {/* Step 1: Enter Email */}
                {step === 'email' && (
                    <form onSubmit={handleRequestOtp} className="space-y-3">
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
                                loading ? 'cursor-wait bg-sky-400' : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:shadow-lg'
                            }`}
                        >
                            {loading ? 'Sending...' : 'Send Reset Code'}
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

                {/* Step 2: Enter OTP */}
                {step === 'otp' && (
                    <form onSubmit={handleVerifyOtp} className="space-y-3">
                        {successMsg && (
                            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-center">
                                <p className="text-[11px] font-medium text-sky-700">{successMsg}</p>
                            </div>
                        )}

                        {otpDevCode && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
                                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Development Mode</p>
                                <p className="font-mono text-lg font-bold text-amber-800 tracking-[0.3em]">{otpDevCode}</p>
                            </div>
                        )}

                        <div>
                            <label className="mb-2 block text-[10px] font-bold text-slate-600">Verification Code</label>
                            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => { otpRefs.current[i] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={otpValues[i]}
                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                        className="h-11 w-10 rounded-lg border border-slate-200 bg-slate-50 text-center text-lg font-bold text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                                    />
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center">
                                <p className="text-[11px] font-medium text-rose-700">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || otpValues.join('').length !== OTP_LENGTH}
                            className={`w-full rounded-xl py-2.5 text-xs font-bold text-white transition ${
                                loading || otpValues.join('').length !== OTP_LENGTH
                                    ? 'cursor-not-allowed bg-slate-300'
                                    : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:shadow-lg'
                            }`}
                        >
                            {loading ? 'Verifying...' : 'Verify Code'}
                        </button>

                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => { setStep('email'); setOtpValues(Array(OTP_LENGTH).fill('')); setError(''); setSuccessMsg(''); setOtpDevCode(''); }}
                                className="rounded-xl py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                            >
                                Change Email
                            </button>
                            <button
                                type="button"
                                onClick={handleResendOtp}
                                disabled={resendTimer > 0}
                                className={`rounded-xl py-2 text-xs font-semibold transition ${
                                    resendTimer > 0
                                        ? 'cursor-not-allowed text-slate-400'
                                        : 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700'
                                }`}
                            >
                                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Step 3: Reset Password */}
                {step === 'reset' && (
                    <form onSubmit={handleResetPassword} className="space-y-3">
                        {successMsg && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
                                <p className="text-[11px] font-medium text-emerald-700">{successMsg}</p>
                            </div>
                        )}

                        <div>
                            <label className="mb-1 block text-[10px] font-bold text-slate-600">New Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                                    placeholder="Min 8 characters"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-[10px] font-bold text-slate-600">Confirm New Password</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                                placeholder="Re-enter password"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
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
                                loading ? 'cursor-wait bg-sky-400' : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 hover:shadow-lg'
                            }`}
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setStep('otp'); setError(''); setSuccessMsg(''); setNewPassword(''); setConfirmPassword(''); }}
                            className="w-full rounded-xl py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                        >
                            Back
                        </button>
                    </form>
                )}

                {/* Step 4: Done */}
                {step === 'done' && (
                    <div className="space-y-3">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-emerald-600">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-emerald-800">{successMsg}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                        >
                            Done
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>,
        document.body
    );
}
