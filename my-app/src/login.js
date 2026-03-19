import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { storeLocalUser, findLocalUser, setCurrentLocalUserEmail } from './localAuthStore';

const Login = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [message, setMessage] = useState('');
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);
    const [successModal, setSuccessModal] = useState(null);
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

    const handleSuccess = (role) => {
        setSuccessModal({ message: 'Login successful!', role });
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
            setSuccessModal({ message: 'Login successful', role: saved.role });
            setCurrentLocalUserEmail(saved.email);
            return true;
        }

        return false;
    };

    const handleContinue = () => {
        if (!successModal) return;
        navigateByRole(successModal.role);
        setSuccessModal(null);
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

            // DEBUG: Let's see exactly what the server sent back
            console.log("User Data from Server:", userData);

            // Try to find the ID. It might be userData.id or userData.teacher_id
            const idToStore = userData.teacher_id || userData.user_id;

            if (idToStore) {
                localStorage.setItem('teacher_id', idToStore);
                console.log("Success! Saved ID:", idToStore);
            } else {
                console.error("Could not find teacher_id in the server response:", userData);
            }
                storeLocalUser({
                 ...userData,
                password: formData.password
        });
                 setCurrentLocalUserEmail(userData.email);

                // 3. MANDATORY: Trigger the modal and navigation
                showToast('Login successful!', 'success');
                handleSuccess(userData.role); 
    
        } else {
            if (!attemptLocalLogin()) {
                setMessage(result.message || 'Invalid credentials.');
                showToast(result.message || 'Invalid credentials.', 'error');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            if (!attemptLocalLogin()) {
                setMessage('Error connecting to the server.');
                showToast('Error connecting to the server.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {successModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
                    <div className="w-full max-w-sm bg-white rounded-[2rem] p-7 shadow-[0_25px_60px_rgba(15,23,42,0.45)] text-center space-y-4">
                        <p className="text-slate-900 text-xl font-semibold">{successModal.message}</p>
                        <p className="text-slate-500 text-sm">Thanks for returning to AlgebraAssess.</p>
                        <button
                            onClick={handleContinue}
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 transition duration-200"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            )}
            <div
            className="min-h-screen bg-slate-50 flex flex-col"
            style={{
                backgroundImage: 'linear-gradient(#cbd7ed 1px, transparent 1px), linear-gradient(90deg, #cbd7ed 1px, transparent 1px)',
                backgroundSize: '30px 30px',
                backgroundColor: '#e0edff',
            }}
        >

            <header className="px-8 py-6 flex items-center justify-between bg-blue-600 text-white shadow-md sticky top-0 z-20">
                <div
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 cursor-pointer"
                    role="button"
                    aria-label="Go back to landing page"
                >
                    <div className="bg-indigo-600 p-2 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <span className="font-bold text-2xl tracking-tight text-white">
                        AlgebraAssess
                    </span>
                </div>
                <Link
                    to="/"
                    className="text-xs uppercase tracking-[0.4em] border border-white/60 rounded-full px-4 py-2 hover:bg-white/20 transition text-center"
                >
                    Back to Landing
                </Link>
            </header>

            <main className="flex-grow flex flex-col items-center justify-center px-6 pb-8 -mt-24">
                <div className="w-full max-w-md flex flex-col items-start gap-6">
                    <div className="bg-white w-full p-10 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-slate-50">
                        <div className="text-center mb-10">
                            <h1 className="text-blue-600 font-extrabold text-3xl mb-2">Welcome Back</h1>
                            <p className="text-slate-400 font-medium">Sign in to continue</p>
                        </div>

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {/* Email Address */}
                            <div>
                                <label className="block text-slate-600 text-sm font-bold mb-2 ml-1">Email address</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="name@email.com"
                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-slate-600 text-sm font-bold mb-2 ml-1">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                                />
                            </div>

                            {toast && (
                                <div className={`w-full px-5 py-3 rounded-2xl border text-sm font-semibold mb-4 transition-all duration-300 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-lg shadow-emerald-200/70' : 'bg-rose-50 border-rose-200 text-rose-700 shadow-lg shadow-rose-200/70'}`}>
                                    {toast.text}
                                </div>
                            )}
                            {message && (
                                <div className="text-center">
                                    <p className="text-sm text-red-600">{message}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg transition duration-300 ${loading ? 'bg-blue-500 cursor-wait shadow-blue-500/50' : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'}`}
                                disabled={loading}
                            >
                                {loading ? 'Logging in…' : 'Login'}
                            </button>
                        </form>

                        <div className="mt-10 text-center">
                            <p className="text-slate-500 font-medium">
                                Don't have an account?
                                <button onClick={() => navigate('/signup')} className="text-blue-600 font-bold ml-1 hover:underline">Register</button>
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </>
    );
};

export default Login;
