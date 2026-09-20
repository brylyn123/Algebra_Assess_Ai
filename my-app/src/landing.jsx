import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const featureCards = [
    {
        title: 'Handwriting OCR',
        description: 'Turn handwritten algebra work into structured, gradable answers without forcing students to type.',
        accent: 'from-cyan-400 to-blue-500',
        icon: (
            <svg viewBox="0 0 24 24" className="h-6 w-6 sm:h-7 sm:w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 12h5m-5 5h8M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 13.5l2 2" />
            </svg>
        ),
    },
    {
        title: 'Flexible Rubrics',
        description: 'Build detailed grading logic with partial credit, custom criteria, and consistent scoring every time.',
        accent: 'from-violet-400 to-indigo-500',
        icon: (
            <svg viewBox="0 0 24 24" className="h-6 w-6 sm:h-7 sm:w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M5 8h14M7 8l5 6 5-6M7 16h10" />
            </svg>
        ),
    },
    {
        title: 'Instant Feedback',
        description: 'Return fast results with actionable insights so teachers spend less time grading and more time teaching.',
        accent: 'from-amber-400 to-orange-500',
        icon: (
            <svg viewBox="0 0 24 24" className="h-6 w-6 sm:h-7 sm:w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 3L4 14h6l-1 7 9-11h-6l1-7z" />
            </svg>
        ),
    },
];

const workflowSteps = [
    {
        step: '01',
        title: 'Create Rubrics',
        description: 'Define the grading logic once with clear criteria, point rules, and partial credit.',
    },
    {
        step: '02',
        title: 'Upload Student Work',
        description: 'Capture handwritten solutions or upload images directly into a clean review flow.',
    },
    {
        step: '03',
        title: 'Review AI Results',
        description: 'Get fast scoring, mistake detection, and feedback suggestions grounded in your rubric.',
    },
];

const outcomes = [
    'Consistent grading across every submission.',
    'Detailed AI-supported feedback for students.',
    'Clear trends to monitor class progress over time.',
];

const testimonials = [
    {
        name: 'Sarah Mitchell',
        role: 'Math Department Head',
        school: 'Lincoln High School',
        quote: 'AlgebraAssess cut my grading time in half. The AI understands handwriting surprisingly well, and the rubric system keeps everything consistent across all my sections.',
        rating: 5,
    },
    {
        name: 'James Rodriguez',
        role: 'Algebra Teacher',
        school: 'Westfield Academy',
        quote: 'My students get feedback instantly instead of waiting days. They can actually learn from their mistakes while the material is still fresh.',
        rating: 5,
    },
    {
        name: 'Emily Chen',
        role: 'Math Teacher',
        school: 'Oakridge Middle School',
        quote: 'The OCR extraction is incredible. Even messy handwritten work gets parsed accurately. I just review and approve — no more retyping student answers.',
        rating: 5,
    },
];

const howItWorksSteps = [
    {
        step: '01',
        title: 'Create Your Assessment',
        description: 'Set up rubrics, define scoring criteria, and upload assessment images. AI extracts questions automatically.',
        icon: (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
        ),
    },
    {
        step: '02',
        title: 'Students Submit Work',
        description: 'Students photograph handwritten solutions and submit directly. Quality checks ensure legible uploads.',
        icon: (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
        ),
    },
    {
        step: '03',
        title: 'AI Grades Instantly',
        description: 'Handwriting OCR extracts answers, then AI scores against your rubric with detailed feedback per item.',
        icon: (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
        ),
    },
    {
        step: '04',
        title: 'Review & Return',
        description: 'Approve or adjust AI scores, then return results to students instantly with one click.',
        icon: (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
];

const faqItems = [
    {
        question: 'How accurate is the handwriting recognition?',
        answer: 'Our OCR uses Gemini Vision AI trained specifically on mathematical notation. It handles most legible handwriting with high accuracy, and teachers can manually correct any extraction errors before grading.',
    },
    {
        question: 'Can I customize the grading rubrics?',
        answer: 'Absolutely. You can create fully custom rubrics with per-item scoring, partial credit rules, minimum point floors, and detailed criteria. The AI follows your rubric exactly when grading.',
    },
    {
        question: 'Is student data secure?',
        answer: 'Yes. All data is encrypted in transit and at rest. We never share student information with third parties. The platform complies with standard educational data privacy practices.',
    },
    {
        question: 'How long does AI grading take?',
        answer: 'Most submissions are graded in under 30 seconds. Batch grading processes multiple submissions concurrently, so an entire class can be graded in minutes.',
    },
    {
        question: 'Can students see their feedback?',
        answer: 'Yes. Once you return results, students can view their scores, detailed per-item feedback, and AI-generated explanations directly in their dashboard.',
    },
    {
        question: 'Is there a limit on the number of students?',
        answer: 'No. AlgebraAssess supports unlimited students and submissions. Scale it from a single class to an entire department without worrying about caps.',
    },
];

const containerVariant = {
    hidden: {},
    show: {
        transition: {
            staggerChildren: 0.12,
        },
    },
};

const itemVariant = {
    hidden: { opacity: 0, y: 24 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: 'easeOut' },
    },
};

const cardHover = {
    y: -10,
    scale: 1.02,
    transition: { type: 'spring', stiffness: 260, damping: 18 },
};

const Landing = () => {
    const navigate = useNavigate();
    const [openFaq, setOpenFaq] = useState(null);

    const scrollToFeatures = () => {
        const section = document.getElementById('features');
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Adjust for sticky navbar height
        setTimeout(() => {
            window.scrollBy(0, -80);
        }, 500);
    };

    return (
        <div className="min-h-screen overflow-x-hidden text-slate-800">
            <div className="relative isolate">

                {/* Nav */}
                <nav className="sticky top-0 z-50 bg-blue-600 text-white shadow-md">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="rounded-xl sm:rounded-2xl bg-white/20 p-2 sm:p-2.5 text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm sm:text-lg font-black tracking-tight text-white">AlgebraAssess</p>
                                <p className="text-[8px] sm:text-xs font-semibold uppercase tracking-[0.2em] sm:tracking-[0.24em] text-white/80">AI Classroom Grading</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-5">
                            <button onClick={() => navigate('/login')} className="rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white">
                                Login
                            </button>
                            <button
                                onClick={() => navigate('/signup')}
                                className="rounded-full bg-white px-3 py-1.5 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-blue-600 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100"
                            >
                                Sign Up
                            </button>
                        </div>
                    </div>
                </nav>

                {/* Hero */}
                <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-14 lg:px-10 lg:pb-28 lg:pt-20">
                    <motion.section
                        className="grid items-center gap-8 sm:gap-14 lg:grid-cols-[1.08fr_0.92fr]"
                        initial="hidden"
                        animate="show"
                        variants={containerVariant}
                    >
                        <motion.div variants={itemVariant} className="relative">
                            <div className="mb-4 sm:mb-6 inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-indigo-100 bg-white/92 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-indigo-500 shadow-sm backdrop-blur">
                                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-indigo-400 shadow-[0_0_14px_rgba(129,140,248,0.55)]" />
                                AI scoring built for algebra classrooms
                            </div>
                            <h1 className="max-w-3xl text-[1.75rem] sm:text-5xl font-black leading-[1.05] sm:leading-[0.96] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                                Intelligent Grading
                                <span className="block bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 bg-clip-text text-transparent">
                                    for Modern Educators
                                </span>
                            </h1>
                            <p className="mt-4 sm:mt-6 max-w-2xl text-sm sm:text-lg leading-6 sm:leading-8 text-slate-500 sm:text-xl">
                                AlgebraAssess transforms handwritten student work into fast, consistent, rubric-based feedback with a cleaner workflow for teachers and a better experience for students.
                            </p>
                            <div className="mt-6 sm:mt-10 flex flex-col gap-3 sm:flex-row">
                                <button
                                    onClick={() => navigate('/signup')}
                                    className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 px-6 py-3 sm:px-8 sm:py-4 text-sm sm:text-base font-bold text-white shadow-[0_20px_50px_rgba(125,211,252,0.24)] transition hover:-translate-y-1"
                                >
                                    Get Started Free
                                </button>
                                <button
                                    onClick={scrollToFeatures}
                                    className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white/85 px-6 py-3 sm:px-8 sm:py-4 text-sm sm:text-base font-bold text-slate-600 backdrop-blur transition hover:-translate-y-1 hover:border-indigo-100 hover:bg-white"
                                >
                                    Explore Features
                                </button>
                            </div>
                            <motion.div
                                variants={itemVariant}
                                className="mt-6 sm:mt-10 grid grid-cols-3 gap-2 sm:gap-4"
                            >
                                {[
                                    { label: '10+ hrs', value: 'saved weekly' },
                                    { label: 'Rubric-first', value: 'grading control' },
                                    { label: 'Instant', value: 'student feedback' },
                                ].map((metric) => (
                                    <div key={metric.label} className="rounded-xl sm:rounded-2xl border border-white/80 bg-white/84 p-2.5 sm:p-4 shadow-lg shadow-slate-200/60 backdrop-blur">
                                        <p className="text-sm sm:text-2xl font-black text-slate-950">{metric.label}</p>
                                        <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-sm font-medium text-slate-500">{metric.value}</p>
                                    </div>
                                ))}
                            </motion.div>
                        </motion.div>

                        <motion.div variants={itemVariant} className="relative lg:max-w-[560px] lg:justify-self-end">
                            <div className="overflow-hidden rounded-2xl sm:rounded-[1.8rem] border border-white/80 bg-white/88 p-3 sm:p-5 shadow-[0_22px_60px_rgba(100,116,139,0.18)] backdrop-blur-xl">
                                <div className="rounded-2xl sm:rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-6 text-slate-700 shadow-inner">
                                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                                        <div>
                                            <p className="text-[10px] sm:text-sm font-semibold uppercase tracking-[0.2em] sm:tracking-[0.24em] text-indigo-400">Workflow preview</p>
                                            <h2 className="mt-2 sm:mt-3 text-lg sm:text-[2.1rem] font-bold leading-tight text-slate-800">Streamlined grading pipeline</h2>
                                        </div>
                                        <div className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-indigo-100 bg-white px-2 py-1 sm:px-3 sm:py-2 text-[10px] sm:text-xs font-semibold text-indigo-500 shadow-sm">
                                            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.7)]" />
                                            AI powered
                                        </div>
                                    </div>

                                    <motion.div
                                        className="mt-5 sm:mt-8 space-y-2.5 sm:space-y-4"
                                        variants={containerVariant}
                                        initial="hidden"
                                        animate="show"
                                    >
                                        {workflowSteps.map((item, index) => (
                                            <motion.div
                                                key={item.step}
                                                variants={itemVariant}
                                                whileHover={cardHover}
                                                className="group relative overflow-hidden rounded-xl sm:rounded-[1.35rem] border border-slate-200 bg-white p-3 sm:p-5 transition"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-transparent to-sky-50 opacity-0 transition duration-300 group-hover:opacity-100" />
                                                <div className="relative flex gap-3 sm:gap-4">
                                                    <div className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-100 text-sm sm:text-lg font-black text-slate-800">
                                                        {item.step}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 sm:gap-3">
                                                            <h3 className="text-sm sm:text-lg font-bold text-slate-800">{item.title}</h3>
                                                            <span className="hidden text-[10px] sm:text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300 sm:inline">
                                                                Stage {index + 1}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 sm:mt-2 text-xs sm:text-sm leading-5 sm:leading-6 text-slate-500">{item.description}</p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.section>
                </main>
            </div>

            {/* Features */}
            <section
                id="features"
                className="relative overflow-hidden bg-white py-16 sm:py-24"
                style={{ scrollMarginTop: '5rem' }}
            >
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sky-50 to-transparent" />
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
                    <motion.div
                        className="mx-auto max-w-3xl text-center"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.35 }}
                        variants={containerVariant}
                    >
                        <motion.p variants={itemVariant} className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-indigo-500">
                            Why educators choose us
                        </motion.p>
                        <motion.h2 variants={itemVariant} className="mt-3 sm:mt-4 text-2xl sm:text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                            Interactive tools wrapped in a cleaner, more modern classroom workflow
                        </motion.h2>
                        <motion.p variants={itemVariant} className="mt-3 sm:mt-5 text-sm sm:text-lg leading-6 sm:leading-8 text-slate-500">
                            Each card is designed to feel more responsive and alive, helping the page feel sharper while still staying professional.
                        </motion.p>
                    </motion.div>

                    <motion.div
                        className="mt-10 sm:mt-16 grid gap-4 sm:gap-8 md:grid-cols-3"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.2 }}
                        variants={containerVariant}
                    >
                        {featureCards.map((card) => (
                            <motion.div
                                key={card.title}
                                variants={itemVariant}
                                whileHover={cardHover}
                                className="group relative overflow-hidden rounded-2xl sm:rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
                            >
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_34%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                                <div className={`relative flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-lg`}>
                                    {card.icon}
                                </div>
                                <h3 className="relative mt-4 sm:mt-6 text-lg sm:text-2xl font-bold text-slate-950">{card.title}</h3>
                                <p className="relative mt-2 sm:mt-4 text-sm sm:text-base leading-6 sm:leading-7 text-slate-500">{card.description}</p>
                                <div className="relative mt-5 sm:mt-8 flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-600">
                                    <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-indigo-500 transition duration-300 group-hover:scale-150" />
                                    Hover-enhanced card interaction
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Teacher Impact */}
            <section className="relative overflow-hidden bg-slate-50 py-16 sm:py-24">
                <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl" />
                <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
                    <motion.div
                        className="grid items-center gap-6 sm:gap-10 rounded-2xl sm:rounded-[2.5rem] border border-white/80 bg-white/85 p-5 sm:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:grid-cols-[1fr_0.85fr] lg:p-12"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={containerVariant}
                    >
                        <motion.div variants={itemVariant}>
                            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.22em] sm:tracking-[0.28em] text-emerald-500">Teacher impact</p>
                            <h2 className="mt-3 sm:mt-4 text-2xl sm:text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                                Focus on teaching, not repetitive grading
                            </h2>
                            <p className="mt-3 sm:mt-5 max-w-2xl text-sm sm:text-lg leading-6 sm:leading-8 text-slate-500">
                                Give teachers back time with faster review cycles, clearer analytics, and a polished grading experience that feels reliable from submission to feedback.
                            </p>
                            <div className="mt-5 sm:mt-8 space-y-2.5 sm:space-y-4">
                                {outcomes.map((text) => (
                                    <motion.div
                                        key={text}
                                        whileHover={{ x: 6 }}
                                        className="flex items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 sm:px-4 sm:py-4"
                                    >
                                        <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-600">
                                            <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <span className="text-sm sm:text-base font-semibold text-slate-700">{text}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariant} className="flex justify-center">
                            <div className="relative flex h-[220px] sm:h-[320px] w-full max-w-md items-center justify-center">
                                <motion.div
                                    animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
                                    transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                                    className="absolute h-48 w-48 sm:h-72 sm:w-72 rounded-full bg-gradient-to-br from-indigo-200 to-cyan-100"
                                />
                                <motion.div
                                    animate={{ y: [0, -12, 0], rotate: [0, 2, 0] }}
                                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                                    className="relative rounded-2xl sm:rounded-[2rem] border border-white/70 bg-white/85 p-5 sm:p-8 text-center shadow-2xl shadow-indigo-200/60 backdrop-blur"
                                >
                                    <div className="mx-auto flex h-16 w-16 sm:h-24 sm:w-24 items-center justify-center rounded-2xl sm:rounded-[1.75rem] bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow-lg">
                                        <svg viewBox="0 0 24 24" className="h-8 w-8 sm:h-12 sm:w-12" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9-5 9 5-9 5-9-5z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 10.5v4.5c0 1.5 2.24 3 5 3s5-1.5 5-3v-4.5" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 10v5" />
                                        </svg>
                                    </div>
                                    <h3 className="mt-4 sm:mt-6 text-xl sm:text-2xl font-black text-slate-950">+10 hrs saved</h3>
                                    <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm font-medium uppercase tracking-[0.18em] sm:tracking-[0.22em] text-slate-400">Per week, per teacher</p>
                                    <div className="mt-4 sm:mt-6 rounded-xl sm:rounded-2xl bg-slate-950 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-cyan-200">
                                        Faster feedback. Less admin overhead.
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* How It Works */}
            <section className="relative overflow-hidden bg-white py-16 sm:py-24">
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-indigo-50 to-transparent" />
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
                    <motion.div
                        className="mx-auto max-w-3xl text-center"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.35 }}
                        variants={containerVariant}
                    >
                        <motion.p variants={itemVariant} className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-indigo-500">
                            Simple workflow
                        </motion.p>
                        <motion.h2 variants={itemVariant} className="mt-3 sm:mt-4 text-2xl sm:text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                            How AlgebraAssess works
                        </motion.h2>
                        <motion.p variants={itemVariant} className="mt-3 sm:mt-5 text-sm sm:text-lg leading-6 sm:leading-8 text-slate-500">
                            From assessment creation to student feedback in four straightforward steps.
                        </motion.p>
                    </motion.div>

                    <motion.div
                        className="mt-10 sm:mt-16 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.2 }}
                        variants={containerVariant}
                    >
                        {howItWorksSteps.map((item, index) => (
                            <motion.div
                                key={item.step}
                                variants={itemVariant}
                                whileHover={cardHover}
                                className="group relative overflow-hidden rounded-2xl sm:rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
                            >
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_34%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                                <div className="relative">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-lg">
                                            {item.icon}
                                        </div>
                                        <span className="text-3xl sm:text-4xl font-black text-slate-200">{item.step}</span>
                                    </div>
                                    <h3 className="mt-4 sm:mt-5 text-lg sm:text-xl font-bold text-slate-950">{item.title}</h3>
                                    <p className="mt-2 sm:mt-3 text-sm sm:text-base leading-6 sm:leading-7 text-slate-500">{item.description}</p>
                                </div>
                                {index < howItWorksSteps.length - 1 && (
                                    <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                                        <svg className="h-6 w-6 text-indigo-300" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                        </svg>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="relative overflow-hidden bg-slate-50 py-16 sm:py-24">
                <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-200/40 blur-3xl" />
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
                    <motion.div
                        className="mx-auto max-w-3xl text-center"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.35 }}
                        variants={containerVariant}
                    >
                        <motion.p variants={itemVariant} className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-blue-500">
                            Teacher voices
                        </motion.p>
                        <motion.h2 variants={itemVariant} className="mt-3 sm:mt-4 text-2xl sm:text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                            Loved by educators
                        </motion.h2>
                        <motion.p variants={itemVariant} className="mt-3 sm:mt-5 text-sm sm:text-lg leading-6 sm:leading-8 text-slate-500">
                            See what teachers are saying about their experience with AlgebraAssess.
                        </motion.p>
                    </motion.div>

                    <motion.div
                        className="mt-10 sm:mt-16 grid gap-4 sm:gap-8 md:grid-cols-3"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.2 }}
                        variants={containerVariant}
                    >
                        {testimonials.map((testimonial) => (
                            <motion.div
                                key={testimonial.name}
                                variants={itemVariant}
                                whileHover={cardHover}
                                className="group relative overflow-hidden rounded-2xl sm:rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
                            >
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),_transparent_34%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                                <div className="relative">
                                    <div className="flex gap-1">
                                        {[...Array(testimonial.rating)].map((_, i) => (
                                            <svg key={i} className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                        ))}
                                    </div>
                                    <p className="mt-4 sm:mt-5 text-sm sm:text-base leading-6 sm:leading-7 text-slate-600">"{testimonial.quote}"</p>
                                    <div className="mt-5 sm:mt-6 flex items-center gap-3">
                                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-sm sm:text-base font-bold text-white">
                                            {testimonial.name.split(' ').map(n => n[0]).join('')}
                                        </div>
                                        <div>
                                            <p className="text-sm sm:text-base font-bold text-slate-950">{testimonial.name}</p>
                                            <p className="text-xs sm:text-sm text-slate-500">{testimonial.role}, {testimonial.school}</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* FAQ */}
            <section className="relative overflow-hidden bg-white py-16 sm:py-24">
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-50 to-transparent" />
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-10">
                    <motion.div
                        className="text-center"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.35 }}
                        variants={containerVariant}
                    >
                        <motion.p variants={itemVariant} className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-indigo-500">
                            FAQ
                        </motion.p>
                        <motion.h2 variants={itemVariant} className="mt-3 sm:mt-4 text-2xl sm:text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                            Common questions
                        </motion.h2>
                        <motion.p variants={itemVariant} className="mt-3 sm:mt-5 text-sm sm:text-lg leading-6 sm:leading-8 text-slate-500">
                            Everything you need to know about AlgebraAssess.
                        </motion.p>
                    </motion.div>

                    <motion.div
                        className="mt-10 sm:mt-16 space-y-3 sm:space-y-4"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.2 }}
                        variants={containerVariant}
                    >
                        {faqItems.map((item, index) => (
                            <motion.div
                                key={index}
                                variants={itemVariant}
                                className="overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 bg-white"
                            >
                                <button
                                    type="button"
                                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                    aria-expanded={openFaq === index}
                                    className="flex w-full items-center justify-between gap-4 p-4 sm:p-6 text-left"
                                >
                                    <span className="text-sm sm:text-base font-bold text-slate-950">{item.question}</span>
                                    <svg
                                        className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${openFaq === index ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth="2"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </button>
                                {openFaq === index && (
                                    <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                                        <p className="text-sm sm:text-base leading-6 sm:leading-7 text-slate-500">{item.answer}</p>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* CTA */}
            <section className="bg-slate-950 py-16 sm:py-24 text-white">
                <motion.div
                    className="mx-auto max-w-5xl px-4 sm:px-6 text-center lg:px-10"
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.4 }}
                    variants={containerVariant}
                >
                    <motion.p variants={itemVariant} className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] sm:tracking-[0.3em] text-cyan-300">
                        Start now
                    </motion.p>
                    <motion.h2 variants={itemVariant} className="mt-3 sm:mt-4 text-2xl sm:text-4xl font-black tracking-tight sm:text-5xl">
                        Ready to transform your classroom workflow?
                    </motion.h2>
                    <motion.p variants={itemVariant} className="mx-auto mt-3 sm:mt-5 max-w-2xl text-sm sm:text-lg leading-6 sm:leading-8 text-slate-300">
                        Launch with a more modern interface, smoother interactions, and a faster grading experience from day one.
                    </motion.p>
                    <motion.div variants={itemVariant} className="mt-6 sm:mt-10">
                        <button
                            onClick={() => navigate('/signup')}
                            className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-6 py-3 sm:px-10 sm:py-4 text-sm sm:text-base font-bold text-white shadow-[0_20px_60px_rgba(59,130,246,0.35)] transition hover:-translate-y-1"
                        >
                            Join Now for Free
                        </button>
                    </motion.div>
                </motion.div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-200 bg-white">
                <div className="mx-auto grid max-w-6xl gap-6 sm:gap-10 px-4 sm:px-6 py-8 sm:py-12 md:grid-cols-3 lg:px-10">
                    <div>
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-2 sm:p-2.5 text-white shadow-lg shadow-indigo-200">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <span className="text-lg sm:text-xl font-black text-slate-950">AlgebraAssess</span>
                        </div>
                        <p className="mt-3 sm:mt-4 max-w-sm text-sm sm:text-slate-500">
                            Modern assessment support for teachers who want consistent grading and better student feedback.
                        </p>
                        <div className="mt-4 sm:mt-6 flex items-center gap-3">
                            <a href="#" aria-label="Twitter" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-blue-100 hover:text-blue-600">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                                </svg>
                            </a>
                            <a href="#" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-blue-100 hover:text-blue-600">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3.02 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
                                </svg>
                            </a>
                            <a href="#" aria-label="LinkedIn" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-blue-100 hover:text-blue-600">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                </svg>
                            </a>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">Resources</h3>
                        <ul className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-sm sm:text-slate-500">
                            <li className="cursor-pointer transition hover:text-slate-900">About Us</li>
                            <li className="cursor-pointer transition hover:text-slate-900">Privacy Policy</li>
                            <li className="cursor-pointer transition hover:text-slate-900">Terms of Service</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">Contact</h3>
                        <div className="mt-3 sm:mt-4 flex items-center gap-2.5 sm:gap-3 text-sm sm:text-slate-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>info@algebraassess.com</span>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-950">
                    <p className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-5 text-center text-xs sm:text-sm text-slate-300 lg:px-10">
                        © 2026 AlgebraAssess. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
