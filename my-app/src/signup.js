import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
const shakeVariants = {
    idle: { x: 0 },
    error: {
        x: [0, -6, 6, -4, 4, 0],
        transition: { duration: 0.45, ease: 'easeOut' },
    },
};

const Signup = () => {
    const navigate = useNavigate();
    const [role, setRole] = useState('teacher'); // 'teacher' or 'student'
    const [formData, setFormData] = useState({
        firstName: '',
        middleName: '',
        lastName: '',
        idNumber: '', // Will map to employeeId or studentId
        collegeName: '',
        sectionName: '', // Student only
        yearLevel: '',   // Student only
        email: '',
        password: '',
        enrollmentCode: ''
    });

    const [message, setMessage] = useState('');
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);
    const toastTimer = useRef(null);
    const navigationTimer = useRef(null);

    useEffect(() => {
        return () => {
            clearTimeout(toastTimer.current);
            clearTimeout(navigationTimer.current);
        };
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const showToast = (text, type = 'success') => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ text, type });
        toastTimer.current = setTimeout(() => setToast(null), 3200);
    };

    const handleRoleChange = (newRole) => {
        setRole(newRole);
        // When switching to teacher, clear student-specific fields to prevent validation issues
        if (newRole === 'teacher') {
            setFormData(prev => ({
                ...prev,
                sectionName: '',
                yearLevel: '',
                enrollmentCode: ''
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);

        const payload = {
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: formData.lastName,
            idNumber: formData.idNumber,
            email: formData.email,
            password: formData.password,
            role: role,
            collegeName: role === 'teacher' ? formData.collegeName : '',
            sectionName: formData.sectionName,
            yearLevel: formData.yearLevel,
            enrollmentCode: formData.enrollmentCode,
        };

        try {
            const response = await fetch('http://localhost/Algebra_Assess_Ai/algebra-api/signup.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

           const result = await response.json();
            if (result.status === 'success') {
                // 1. SAVE THE USER DATA TO LOCAL STORAGE
                // This assumes your PHP returns the user object with the ID
                const userSession = {
                    id: result.user_id, // This is your primary key from the DB
                    role: role,
                    name: `${formData.firstName} ${formData.lastName}`,
                    email: formData.email
                };
                
                // We store it as a string so we can use it across the whole app
                localStorage.setItem('user', JSON.stringify(userSession));

                showToast('Account created successfully!', 'success');
                
                // 2. NAVIGATE TO DASHBOARD (or login)
                // Usually, after signup, you might want to go straight to the dashboard
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

    return (
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

            <main className="flex-grow flex flex-col items-center justify-center px-6 pb-8 pt-16">
                <div className="bg-white w-full max-w-md p-10 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-slate-50">
                    <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200 mb-6">
                        {roleOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleRoleChange(option.value)}
                                className={`flex-1 px-5 py-3 rounded-xl font-semibold transition text-sm ${role === option.value ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:text-blue-600'}`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <div className="text-center mb-8">
                        <div className="relative h-9 mb-2">
                            <AnimatePresence initial={false}>
                                <motion.h1
                                    key={role}
                                    className="text-blue-600 font-extrabold text-3xl absolute inset-0"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {role === 'teacher' ? 'Teacher Sign Up' : 'Student Sign Up'}
                                </motion.h1>
                            </AnimatePresence>
                        </div>
                        <p className="text-slate-400 font-medium text-sm">Join AlgebraAssess AI</p>
                    </div>

                    {toast && (
                        <div className={`mb-4 w-full px-5 py-3 rounded-2xl border text-sm font-semibold transition-all duration-300 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-lg shadow-emerald-200/70' : 'bg-rose-50 border-rose-200 text-rose-700 shadow-lg shadow-rose-200/70'}`}>
                            {toast.text}
                        </div>
                    )}
                    {message && (
                        <motion.div
                            className="mb-6 bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-sm font-medium"
                            variants={shakeVariants}
                            initial="idle"
                            animate="error"
                        >
                            {message}
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Row 1: Names */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1 ml-1">First Name</label>
                                <input name="firstName" required onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition" />
                            </div>
                            <div>
                                <label className="block text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1 ml-1">Middle N...</label>
                                <input name="middleName" onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition" />
                            </div>
                            <div>
                                <label className="block text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1 ml-1">Last Name</label>
                                <input name="lastName" required onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition" />
                            </div>
                        </div>

                        {/* ID Field */}
                        <div>
                            <div className="relative h-3 mb-1">
                                <AnimatePresence initial={false}>
                                    <motion.label
                                        key={role}
                                        className="block text-slate-600 text-[10px] font-bold uppercase tracking-wider ml-1 absolute inset-0"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {role === 'teacher' ? 'Employee ID' : 'Student ID'}
                                    </motion.label>
                                </AnimatePresence>
                            </div>
                            <input name="idNumber" required onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition" />
                        </div>

                        {/* Dynamic Fields based on Role */}
                        <AnimatePresence initial={false}>
                            {role === 'teacher' && (
                                <motion.div
                                    key="collegeField"
                                    className="w-full"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <label className="block text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1 ml-1">College Name</label>
                                    <input name="collegeName" required onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <AnimatePresence initial={false}>
                            {role === 'student' && (
                                <motion.div
                                    key="studentFields"
                                    className="grid grid-cols-2 gap-4"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <div>
                                        <label className="block text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1 ml-1">Section</label>
                                        <input name="sectionName" required onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition" />
                                    </div>
                                    <div>
                                        <label className="block text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1 ml-1">Year Level</label>
                                        <input name="yearLevel" required onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {role === 'student' && (
                            <div>
                                <label className="block text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1 ml-1">Enrollment Code</label>
                                <input
                                    name="enrollmentCode"
                                    value={formData.enrollmentCode}
                                    required
                                    onChange={handleChange}
                                    placeholder="Ask your teacher for the code"
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition"
                                />
                                <p className="text-xs text-slate-400 mt-1">You need this code to enroll in the correct subject.</p>
                            </div>
                        )}

                        {/* Email and Password */}
                        <div>
                            <label className="block text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1 ml-1">Email address</label>
                            <input type="email" name="email" required onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition" />
                        </div>
                        <div>
                            <label className="block text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-1 ml-1">Password</label>
                            <input type="password" name="password" required onChange={handleChange} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 transition" />
                        </div>

                        <button
                            type="submit"
                            className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg transition duration-300 ${loading ? 'bg-blue-500 cursor-wait shadow-blue-500/50' : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'}`}
                            disabled={loading}
                        >
                            {loading ? 'Submitting…' : 'Sign Up'}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-slate-500 text-sm font-medium">
                            Already have an account?
                            <button onClick={() => navigate('/login')} className="text-blue-600 font-bold ml-1 hover:underline">Login</button>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Signup;
