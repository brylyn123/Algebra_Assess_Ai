import React, { useEffect, useMemo, useState } from 'react';

const fallbackSubmissions = [
  {
    id: 1,
    student_name: 'Sarah Johnson',
    student_id: 'STU001',
    assessment_title: 'Linear Equations Quiz',
    submission_date: 'Mar 6, 2026',
    subject: 'Algebra I - Period 3',
    status: 'Pending',
  },
  {
    id: 2,
    student_name: 'Michael Chen',
    student_id: 'STU002',
    assessment_title: 'Quadratic Functions Test',
    submission_date: 'Mar 5, 2026',
    subject: 'Algebra I - Period 3',
    status: 'Pending',
  },
  {
    id: 3,
    student_name: 'Emma Davis',
    student_id: 'STU003',
    assessment_title: 'Linear Equations Quiz',
    submission_date: 'Mar 4, 2026',
    subject: 'Algebra II - Period 1',
    status: 'Graded',
  },
];

const statusStyle = {
  Pending: 'bg-amber-100 text-amber-700',
  Graded: 'bg-emerald-100 text-emerald-700',
  'Needs Review': 'bg-cyan-100 text-cyan-700',
};

const GradeSubmissions = () => {
  const [submissions, setSubmissions] = useState(fallbackSubmissions);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState(fallbackSubmissions[0]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [aiScore, setAiScore] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSubmissions = async () => {
      try {
        const response = await fetch('http://localhost/algebra_assess_ai/algebra-api/grade_submissions.php');
        const payload = await response.json();
        if (!isMounted) return;

        if (!response.ok || payload.status !== 'success' || !Array.isArray(payload.submissions)) {
          throw new Error(payload.message || 'Unable to load submissions.');
        }

        setSubmissions(payload.submissions);
        if (payload.submissions.length > 0) {
          setSelectedSubmission(payload.submissions[0]);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error(error);
        setErrorMessage(error.message || 'Unable to load submissions.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSubmissions();
    return () => {
      isMounted = false;
    };
  }, []);

  const subjectOptions = useMemo(() => {
    const uniqueSubjects = Array.from(new Set(submissions.map((submission) => submission.subject)));
    return [
      { value: 'all', label: 'All Subjects' },
      ...uniqueSubjects.map((subject) => ({ value: subject, label: subject })),
    ];
  }, [submissions]);

  const visibleSubmissions = useMemo(() => {
    if (selectedSubject === 'all') {
      return submissions;
    }

    return submissions.filter((submission) => submission.subject === selectedSubject);
  }, [selectedSubject, submissions]);

  useEffect(() => {
    if (visibleSubmissions.length === 0) {
      setSelectedSubmission(null);
      return;
    }

    setSelectedSubmission((previous) => {
      const stillVisible = visibleSubmissions.find((submission) => submission.id === previous?.id);
      return stillVisible || visibleSubmissions[0];
    });
  }, [visibleSubmissions]);

  const handleGenerateAIGrade = () => {
    if (!selectedSubmission) return;
    setGenerating(true);
    setAiScore(null);
    const simulatedScore = `${Math.floor(85 + Math.random() * 10)}%`;
    setTimeout(() => {
      setAiScore(simulatedScore);
      setGenerating(false);
    }, 900);
  };

  const info = selectedSubmission || fallbackSubmissions[0];

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-6xl mx-auto space-y-8 px-4 md:px-6">
        <h1 className="text-3xl font-bold text-slate-900">Grade Submissions</h1>

        <div className="grid gap-8 lg:grid-cols-[1.05fr,1fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] bg-white p-6 border border-slate-100 shadow-lg space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500 mb-2">Select Subject</p>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full rounded-2xl border border-blue-500 px-4 py-3 text-slate-700 font-medium focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {subjectOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSubject('all')}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Select All Subjects
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-6 border border-slate-100 shadow-lg space-y-6">
              <div className="space-y-1">
                <p className="text-md font-semibold text-slate-900">Student Submissions</p>
                <p className="text-sm text-slate-500">
                  {loading ? 'Loading submissions...' : `${visibleSubmissions.length} submission(s) found`}
                </p>
                {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
              </div>

              <div className="space-y-4">
                {visibleSubmissions.length === 0 && !loading && (
                  <p className="text-sm text-slate-500">No submissions match that subject yet.</p>
                )}

                {visibleSubmissions.map((submission) => {
                  const isActive = selectedSubmission?.id === submission.id;
                  return (
                    <button
                      key={submission.id}
                      type="button"
                      onClick={() => setSelectedSubmission(submission)}
                      className={`w-full text-left flex flex-col gap-2 rounded-2xl border p-4 shadow-sm transition ${
                        isActive
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{submission.student_name}</p>
                          <p className="text-sm text-slate-500">{submission.assessment_title}</p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-3 py-1 rounded-full ${
                            statusStyle[submission.status] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {submission.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                        <span>Date: {submission.submission_date}</span>
                        <span>Subject: {submission.subject}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-lg space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Score Generation</h2>
              <div className="rounded-2xl bg-blue-50 p-4">
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student</p>
                    <p className="font-semibold text-slate-900">{info.student_name}</p>
                    <p className="text-xs text-slate-500">Assessment: {info.assessment_title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student ID</p>
                    <p className="font-semibold text-slate-900">{info.student_id}</p>
                    <p className="text-xs text-slate-500">Submitted: {info.submission_date}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800">
                <p className="font-semibold">Select Grading Rubric</p>
                <p>No rubrics found. Please create a rubric first in the Manage Assessments section.</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-700">AI Generated Grade</p>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-lg font-semibold text-slate-900">
                {aiScore ?? 'Awaiting generation'}
              </div>
              <button
                type="button"
                onClick={handleGenerateAIGrade}
                disabled={!selectedSubmission || generating}
                className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {generating ? 'Generating...' : 'Generate AI Grade'}
              </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900 mb-2">Submitted Work</p>
              <div className="h-40 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-xs text-slate-400">
                Preview placeholder for student work.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradeSubmissions;
