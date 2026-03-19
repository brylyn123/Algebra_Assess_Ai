import React from 'react';
import { motion } from 'framer-motion';

const stats = [
  { label: 'Average Score', value: '84%', accent: 'bg-slate-50', icon: '🎖️' },
  { label: 'Completed', value: '1', accent: 'bg-emerald-50', icon: '✅' },
  { label: 'Pending', value: '1', accent: 'bg-amber-50', icon: '📈' },
];

const reports = [
  {
    title: 'Linear Equations Quiz',
    submitted: '2/15/2026',
    score: '84%',
    points: '42 / 50 points',
    status: 'completed',
    feedback:
      'Great work on most problems! You demonstrated a solid understanding of linear equations. Focus on showing all your work steps more clearly.',
    strengths: [
      'Correct application of algebraic properties',
      'Accurate calculation in most problems',
      'Good understanding of graphing concepts',
    ],
    improvements: [
      'Show intermediate steps more clearly',
      'Double-check signs when solving equations',
      'Practice word problems involving linear equations',
    ],
  },
  {
    title: 'Quadratic Functions Test',
    submitted: '2/20/2026',
    score: 'Pending Review',
    status: 'pending',
    feedback: 'Submission received. Your answers are queued for grading.',
    strengths: ['—'],
    improvements: ['—'],
  },
];

const AnimatedCheckmark = ({ className = '' }) => (
  <motion.svg
    viewBox="0 0 24 24"
    className={`h-4 w-4 flex-none text-emerald-500 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <motion.path
      d="M5.5 12.5L10 17l8-8"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    />
  </motion.svg>
);

const AnimatedCross = ({ className = '' }) => (
  <motion.svg
    viewBox="0 0 24 24"
    className={`h-4 w-4 flex-none text-amber-600 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <motion.path
      d="M6 6l12 12"
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    />
    <motion.path
      d="M18 6L6 18"
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.4, ease: 'easeInOut', delay: 0.1 }}
    />
  </motion.svg>
);

const reportVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

const StudentReports = () => {
  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <h1 className="text-3xl font-bold text-slate-900">My Reports & Feedback</h1>
        <p className="text-sm text-slate-500">View your assessment results and AI-generated feedback.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-[2rem] border border-slate-100 p-6 ${stat.accent} shadow-sm`}>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{stat.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {reports.map((report, index) => (
          <motion.article
            key={report.title}
            className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-4"
            variants={reportVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45, delay: index * 0.08 }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{report.title}</h2>
                <p className="text-sm text-slate-500">Submitted: {report.submitted}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{report.score}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{report.points}</p>
              </div>
            </div>

            <motion.div
              className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-slate-600"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <p className="font-semibold text-slate-900">AI Feedback</p>
              <p className="mt-2">{report.feedback}</p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Strengths</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {report.strengths.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      {item === '—' ? (
                        <span className="text-slate-300 flex-none text-lg">&#8212;</span>
                      ) : (
                        <AnimatedCheckmark />
                      )}
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Areas for Improvement</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {report.improvements.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      {item === '—' ? (
                        <span className="text-slate-300 flex-none text-lg">&#8212;</span>
                      ) : (
                        <AnimatedCross />
                      )}
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700">
                View Detailed Analysis
              </button>
              <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
                Download Report
              </button>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
};

export default StudentReports;
