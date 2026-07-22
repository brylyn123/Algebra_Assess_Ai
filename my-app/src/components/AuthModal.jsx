import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../apiBase';
import { apiFetch } from '../fetchClient';

const modalBackdrop = { hidden: { opacity: 0 }, show: { opacity: 1 } };
const modalContent = { hidden: { y: 24, opacity: 0 }, show: { y: 0, opacity: 1 } };

const AuthModal = ({ open, mode = 'signup', onClose }) => {
  const [authMode, setAuthMode] = useState(mode);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  React.useEffect(() => {
    setAuthMode(mode);
    setMessage(null);
    setForm({ email: '', password: '', firstName: '', lastName: '' });
  }, [mode, open]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const endpoint = authMode === 'login' ? '/login.php' : '/signup.php';
      const payload = authMode === 'login'
        ? { email: form.email, password: form.password }
        : { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, role: 'teacher' };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (err) { json = null; }

      if (res.ok && json && json.status === 'success') {
        setMessage({ type: 'success', text: authMode === 'login' ? 'Logged in successfully' : 'Account created' });
        setTimeout(() => onClose?.(), 900);
      } else {
        const err = (json && json.message) || text || 'Request failed';
        setMessage({ type: 'error', text: err });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  // Render modal into document.body using a portal so it's not affected by parent stacking/overflow
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial="hidden"
          animate="show"
          exit="hidden"
          variants={modalBackdrop}
          onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
          style={{ zIndex: 99998 }}
        >
          <motion.div
            className="modal-content max-w-4xl mx-auto rounded-2xl p-0 overflow-hidden"
            variants={modalContent}
            initial="hidden"
            animate="show"
            exit="hidden"
            style={{ zIndex: 99999 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Left decorative column */}
              <div className="hidden md:flex items-center justify-center bg-gradient-to-br from-indigo-600 to-cyan-400 p-8">
                <div className="text-white px-4">
                  <div className="mb-6">
                    <h2 className="text-2xl font-black">Welcome to AlgebraAssess</h2>
                    <p className="mt-2 text-sm opacity-90">Fast, consistent grading powered by AI. Sign in or create an account to get started.</p>
                  </div>

                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/20 font-bold">01</div>
                      <div>
                        <p className="font-semibold">Handwriting OCR</p>
                        <p className="text-xs opacity-90">Easily grade handwritten student work.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/20 font-bold">02</div>
                      <div>
                        <p className="font-semibold">Flexible Rubrics</p>
                        <p className="text-xs opacity-90">Partial credit, custom criteria, consistent scoring.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/20 font-bold">03</div>
                      <div>
                        <p className="font-semibold">Instant Feedback</p>
                        <p className="text-xs opacity-90">Return fast, actionable insights to students.</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Right form column */}
              <div className="p-6 md:p-8 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{authMode === 'login' ? 'Sign in' : 'Create your account'}</h3>
                    <p className="text-sm text-slate-500">{authMode === 'login' ? 'Access your dashboard and classes' : 'Start with a free teacher account'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setAuthMode('login')} className={`rounded-full px-3 py-1 text-sm font-semibold ${authMode === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}>Login</button>
                    <button onClick={() => setAuthMode('signup')} className={`rounded-full px-3 py-1 text-sm font-semibold ${authMode === 'signup' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}>Sign up</button>
                  </div>
                </div>

                <form onSubmit={submit} className="mt-6 space-y-4">
                  {authMode === 'signup' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="First name" className="auth-input" required />
                      <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Last name" className="auth-input" required />
                    </div>
                  )}

                  <div>
                    <label className="form-label">Email address</label>
                    <input name="email" value={form.email} onChange={handleChange} type="email" placeholder="you@school.edu" className="auth-input" required />
                  </div>

                  <div>
                    <label className="form-label">Password</label>
                    <input name="password" value={form.password} onChange={handleChange} type="password" placeholder="Create a strong password" className="auth-input" required />
                  </div>

                  {message && (
                    <div className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{message.text}</div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
                    <button disabled={loading} type="submit" className={`teacher-primary-btn w-full ${loading ? 'opacity-80 cursor-wait' : ''}`}>
                      {loading ? (authMode === 'login' ? 'Signing in...' : 'Creating...') : (authMode === 'login' ? 'Sign in' : 'Create account')}
                    </button>
                    <button type="button" onClick={onClose} className="teacher-secondary-btn w-full sm:w-auto">Cancel</button>
                  </div>

                  <div className="mt-4 text-center text-sm text-slate-500">
                    {authMode === 'login' ? (
                      <>
                        Don't have an account? <button type="button" onClick={() => setAuthMode('signup')} className="font-bold text-indigo-500">Sign up</button>
                      </>
                    ) : (
                      <>
                        Already have an account? <button type="button" onClick={() => setAuthMode('login')} className="font-bold text-indigo-500">Sign in</button>
                      </>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default AuthModal;
