import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const featureCards = [
    {
        title: 'Handwriting OCR',
        description: 'Turn handwritten algebra work into structured, gradable answers without forcing students to type.',
        accent: 'from-cyan-400 to-blue-500',
        icon: (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
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
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M5 8h14M7 8l5 6 5-6M7 16h10" />
            </svg>
        ),
    },
    {
        title: 'Instant Feedback',
        description: 'Return fast results with actionable insights so teachers spend less time grading and more time teaching.',
        accent: 'from-amber-400 to-orange-500',
        icon: (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
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

    const scrollToFeatures = () => {
        const section = document.getElementById('features');
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="min-h-screen overflow-x-hidden bg-[#d6e8ff] text-slate-800">
            <div className="relative isolate">
                <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.26),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(129,140,248,0.22),_transparent_30%),linear-gradient(180deg,_#d7e9ff_0%,_#dcebff_38%,_#eef5ff_72%,_#f8fbff_100%)]" />
                <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(147,197,253,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(147,197,253,0.22)_1px,transparent_1px)] bg-[size:42px_42px]" />
                <div className="absolute left-[8%] top-24 -z-10 h-56 w-56 rounded-full bg-sky-300/30 blur-3xl" />
                <div className="absolute right-[10%] top-32 -z-10 h-80 w-80 rounded-full bg-indigo-300/25 blur-3xl" />

                <nav className="sticky top-0 z-50 bg-blue-600 text-white shadow-md">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-white/20 p-2.5 text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-lg font-black tracking-tight text-white">AlgebraAssess</p>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">AI Classroom Grading</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-5">
                            <button onClick={() => navigate('/login')} className="rounded-full px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white">
                                Login
                            </button>
                            <button
                                onClick={() => navigate('/signup')}
                                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-blue-600 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100"
                            >
                                Sign Up
                            </button>
                        </div>
                    </div>
                </nav>

                <main className="mx-auto max-w-7xl px-6 pb-24 pt-14 lg:px-10 lg:pb-28 lg:pt-20">
                    <motion.section
                        className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr]"
                        initial="hidden"
                        animate="show"
                        variants={containerVariant}
                    >
                        <motion.div variants={itemVariant} className="relative">
                            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/92 px-4 py-2 text-sm font-semibold text-indigo-500 shadow-sm backdrop-blur">
                                <span className="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_14px_rgba(129,140,248,0.55)]" />
                                AI scoring built for algebra classrooms
                            </div>
                            <h1 className="max-w-3xl text-5xl font-black leading-[0.96] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                                Intelligent Grading
                                <span className="block bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 bg-clip-text text-transparent">
                                    for Modern Educators
                                </span>
                            </h1>
                            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-500 sm:text-xl">
                                AlgebraAssess transforms handwritten student work into fast, consistent, rubric-based feedback with a cleaner workflow for teachers and a better experience for students.
                            </p>
                            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                                <button
                                    onClick={() => navigate('/signup')}
                                    className="rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 px-8 py-4 text-base font-bold text-white shadow-[0_20px_50px_rgba(125,211,252,0.24)] transition hover:-translate-y-1"
                                >
                                    Get Started Free
                                </button>
                                <button
                                    onClick={scrollToFeatures}
                                    className="rounded-2xl border border-slate-200 bg-white/85 px-8 py-4 text-base font-bold text-slate-600 backdrop-blur transition hover:-translate-y-1 hover:border-indigo-100 hover:bg-white"
                                >
                                    Explore Features
                                </button>
                            </div>
                            <motion.div
                                variants={itemVariant}
                                className="mt-10 grid gap-4 sm:grid-cols-3"
                            >
                                {[
                                    { label: '10+ hrs', value: 'saved weekly' },
                                    { label: 'Rubric-first', value: 'grading control' },
                                    { label: 'Instant', value: 'student feedback' },
                                ].map((metric) => (
                                    <div key={metric.label} className="rounded-2xl border border-white/80 bg-white/84 p-4 shadow-lg shadow-slate-200/60 backdrop-blur">
                                        <p className="text-2xl font-black text-slate-950">{metric.label}</p>
                                        <p className="mt-1 text-sm font-medium text-slate-500">{metric.value}</p>
                                    </div>
                                ))}
                            </motion.div>
                        </motion.div>

                        <motion.div variants={itemVariant} className="relative lg:max-w-[560px] lg:justify-self-end">
                            <div className="overflow-hidden rounded-[1.8rem] border border-white/80 bg-white/88 p-4 shadow-[0_22px_60px_rgba(100,116,139,0.18)] backdrop-blur-xl sm:p-5">
                                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 text-slate-700 shadow-inner sm:p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-indigo-400">Workflow preview</p>
                                            <h2 className="mt-3 text-[1.85rem] font-bold leading-tight text-slate-800 sm:text-[2.1rem]">Streamlined grading pipeline</h2>
                                        </div>
                                        <div className="flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-2 text-xs font-semibold text-indigo-500 shadow-sm">
                                            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.7)]" />
                                            AI powered
                                        </div>
                                    </div>

                                    <motion.div
                                        className="mt-8 space-y-4"
                                        variants={containerVariant}
                                        initial="hidden"
                                        animate="show"
                                    >
                                        {workflowSteps.map((item, index) => (
                                            <motion.div
                                                key={item.step}
                                                variants={itemVariant}
                                                whileHover={cardHover}
                                                className="group relative overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white p-4 transition sm:p-5"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-transparent to-sky-50 opacity-0 transition duration-300 group-hover:opacity-100" />
                                                <div className="relative flex gap-4">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-800">
                                                        {item.step}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="text-lg font-bold text-slate-800">{item.title}</h3>
                                                            <span className="hidden text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300 sm:inline">
                                                                Stage {index + 1}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
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

            <section
                id="features"
                className="relative overflow-hidden bg-white py-24"
            >
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sky-50 to-transparent" />
                <div className="mx-auto max-w-7xl px-6 lg:px-10">
                    <motion.div
                        className="mx-auto max-w-3xl text-center"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.35 }}
                        variants={containerVariant}
                    >
                        <motion.p variants={itemVariant} className="text-sm font-bold uppercase tracking-[0.3em] text-indigo-500">
                            Why educators choose us
                        </motion.p>
                        <motion.h2 variants={itemVariant} className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                            Interactive tools wrapped in a cleaner, more modern classroom workflow
                        </motion.h2>
                        <motion.p variants={itemVariant} className="mt-5 text-lg leading-8 text-slate-500">
                            Each card is designed to feel more responsive and alive, helping the page feel sharper while still staying professional.
                        </motion.p>
                    </motion.div>

                    <motion.div
                        className="mt-16 grid gap-8 md:grid-cols-3"
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
                                className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
                            >
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_34%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                                <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-lg`}>
                                    {card.icon}
                                </div>
                                <h3 className="relative mt-6 text-2xl font-bold text-slate-950">{card.title}</h3>
                                <p className="relative mt-4 text-base leading-7 text-slate-500">{card.description}</p>
                                <div className="relative mt-8 flex items-center gap-2 text-sm font-bold text-indigo-600">
                                    <span className="h-2 w-2 rounded-full bg-indigo-500 transition duration-300 group-hover:scale-150" />
                                    Hover-enhanced card interaction
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            <section className="relative overflow-hidden bg-slate-50 py-24">
                <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl" />
                <div className="mx-auto max-w-6xl px-6 lg:px-10">
                    <motion.div
                        className="grid items-center gap-10 rounded-[2.5rem] border border-white/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:grid-cols-[1fr_0.85fr] lg:p-12"
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={containerVariant}
                    >
                        <motion.div variants={itemVariant}>
                            <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-500">Teacher impact</p>
                            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                                Focus on teaching, not repetitive grading
                            </h2>
                            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-500">
                                Give teachers back time with faster review cycles, clearer analytics, and a polished grading experience that feels reliable from submission to feedback.
                            </p>
                            <div className="mt-8 space-y-4">
                                {outcomes.map((text) => (
                                    <motion.div
                                        key={text}
                                        whileHover={{ x: 6 }}
                                        className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <span className="font-semibold text-slate-700">{text}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariant} className="flex justify-center">
                            <div className="relative flex h-[320px] w-full max-w-md items-center justify-center">
                                <motion.div
                                    animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
                                    transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                                    className="absolute h-72 w-72 rounded-full bg-gradient-to-br from-indigo-200 to-cyan-100"
                                />
                                <motion.div
                                    animate={{ y: [0, -12, 0], rotate: [0, 2, 0] }}
                                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                                    className="relative rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-2xl shadow-indigo-200/60 backdrop-blur"
                                >
                                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow-lg">
                                        <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9-5 9 5-9 5-9-5z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 10.5v4.5c0 1.5 2.24 3 5 3s5-1.5 5-3v-4.5" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 10v5" />
                                        </svg>
                                    </div>
                                    <h3 className="mt-6 text-2xl font-black text-slate-950">+10 hrs saved</h3>
                                    <p className="mt-2 text-sm font-medium uppercase tracking-[0.22em] text-slate-400">Per week, per teacher</p>
                                    <div className="mt-6 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-cyan-200">
                                        Faster feedback. Less admin overhead.
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            <section className="bg-slate-950 py-24 text-white">
                <motion.div
                    className="mx-auto max-w-5xl px-6 text-center lg:px-10"
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.4 }}
                    variants={containerVariant}
                >
                    <motion.p variants={itemVariant} className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">
                        Start now
                    </motion.p>
                    <motion.h2 variants={itemVariant} className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                        Ready to transform your classroom workflow?
                    </motion.h2>
                    <motion.p variants={itemVariant} className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                        Launch with a more modern interface, smoother interactions, and a faster grading experience from day one.
                    </motion.p>
                    <motion.div variants={itemVariant} className="mt-10">
                        <button
                            onClick={() => navigate('/signup')}
                            className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 px-10 py-4 text-base font-bold text-white shadow-[0_20px_60px_rgba(59,130,246,0.35)] transition hover:-translate-y-1"
                        >
                            Join Now for Free
                        </button>
                    </motion.div>
                </motion.div>
            </section>

            <footer className="border-t border-slate-200 bg-white">
                <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-3 lg:px-10">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 text-white shadow-lg shadow-indigo-200">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <span className="text-xl font-black text-slate-950">AlgebraAssess</span>
                        </div>
                        <p className="mt-4 max-w-sm text-slate-500">
                            Modern assessment support for teachers who want consistent grading and better student feedback.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Resources</h3>
                        <ul className="mt-4 space-y-2 text-slate-500">
                            <li className="cursor-pointer transition hover:text-slate-900">Privacy Policy</li>
                            <li className="cursor-pointer transition hover:text-slate-900">Terms of Service</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Contact</h3>
                        <div className="mt-4 flex items-center gap-3 text-slate-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>info@algebraassess.com</span>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-950">
                    <p className="mx-auto max-w-6xl px-6 py-5 text-center text-sm text-slate-300 lg:px-10">
                        © 2025 AlgebraAssess. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
