import React, { useEffect, useMemo, useState } from 'react';
import axios from './axiosClient';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const API_BASE_URL = 'http://localhost/Algebra_Assess_Ai/algebra-api';

const TeacherProfile = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = storedTeacher?.teacher_id ?? storedTeacher?.user_id ?? storedTeacher?.id ?? null;

  const [subjects, setSubjects] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacherId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const loadData = async () => {
      setLoading(true);
      try {
        const [subjectRes, enrollmentRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/get_subjects.php?teacher_id=${teacherId}`),
          axios.get(`${API_BASE_URL}/get_enrollments.php`, {
            params: { teacher_id: teacherId },
            signal: controller.signal,
          }),
        ]);

        if (!isMounted) return;

        const sourceSubjects = Array.isArray(subjectRes.data.subjects)
          ? subjectRes.data.subjects
          : Array.isArray(subjectRes.data)
            ? subjectRes.data
            : [];

        const normalizedSubjects = sourceSubjects.map((subject) => ({
          id: subject.subject_id ?? subject.id,
          name: subject.subject_name ?? 'Untitled Class',
          section: subject.section ?? 'Section —',
          year: subject.year ?? '',
          schoolYear: subject.school_year ?? '',
          joinCode: subject.join_code ?? '',
        }));

        setSubjects(normalizedSubjects);

        const enrollmentsSource = Array.isArray(enrollmentRes.data.enrollments)
          ? enrollmentRes.data.enrollments
          : [];
        setEnrollments(enrollmentsSource);
      } catch (error) {
        if (axios.isCancel?.(error) || error.name === 'CanceledError') {
          return;
        }
        console.error('Failed to load profile data', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [teacherId]);

  const statistics = useMemo(() => {
    const totalStudents = enrollments.reduce((total, subject) => {
      return total + (Array.isArray(subject.students) ? subject.students.length : 0);
    }, 0);

    const subjectWithMostStudents = enrollments
      .slice()
      .sort((a, b) => {
        const aLen = Array.isArray(a.students) ? a.students.length : 0;
        const bLen = Array.isArray(b.students) ? b.students.length : 0;
        return bLen - aLen;
      })[0];

    return {
      subjects: subjects.length,
      students: totalStudents,
      busiest: subjectWithMostStudents?.subject_name ?? 'No enrollments yet',
    };
  }, [enrollments, subjects.length]);

  const heroDetails = {
    name: `${storedTeacher?.firstName ?? 'Teacher'} ${storedTeacher?.lastName ?? ''}`.trim(),
    email: storedTeacher?.email ?? 'teacher@example.com',
    employer: storedTeacher?.collegeName ?? 'Algebra Assess Academy',
    role: storedTeacher?.role ?? 'Teacher',
  };

  const recentEnrollments = enrollments
    .flatMap((subject) => {
      if (!Array.isArray(subject.students)) return [];
      return subject.students.map((student) => ({
        ...student,
        subjectName: subject.subject_name,
      }));
    })
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-slate-100 bg-white/90 px-8 py-10 shadow-[0_25px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Teacher Profile</p>
            <h1 className="text-3xl font-bold text-slate-900">{heroDetails.name}</h1>
            <p className="text-sm text-slate-500">Lead your algebra classes with confidence and AI-powered insights.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            {heroDetails.role}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">School</p>
            <p className="text-sm font-semibold text-slate-900">{heroDetails.employer}</p>
            <p className="text-xs text-slate-500">{heroDetails.email}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Subjects</p>
            <p className="text-2xl font-bold text-slate-900">{loading ? '—' : statistics.subjects}</p>
            <p className="text-xs text-slate-500">Active classes assigned to you.</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Learners</p>
            <p className="text-2xl font-bold text-slate-900">{loading ? '—' : statistics.students}</p>
            <p className="text-xs text-slate-500">Students enrolled across all subjects.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Current Focus</p>
            <span className="text-xs text-blue-600">Updated live</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-900">{statistics.busiest}</p>
          <p className="text-xs text-slate-500">Most active subject based on enrollment in the last 30 days.</p>
        </article>
        <article className="lg:col-span-2 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Recent Enrollments</p>
            <button className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 hover:text-slate-800 transition">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {recentEnrollments.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">No enrollments yet. Share your join code.</p>
            ) : (
              recentEnrollments.map((entry) => (
                <div key={`${entry.enrollment_id}-${entry.student_id}`} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 bg-slate-50">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{entry.student_name || entry.student_id}</p>
                    <p className="text-[11px] text-slate-500">{entry.subjectName}</p>
                  </div>
                  <span className="text-[11px] text-slate-500">{entry.date_enrolled ?? '—'}</span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Quick Details</p>
            <h2 className="text-xl font-bold text-slate-900">Contact & Credentials</h2>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span className="text-xs text-slate-500">Teacher ID</span>
              <span className="font-semibold text-slate-900">{teacherId ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span className="text-xs text-slate-500">Email</span>
              <span className="font-semibold text-slate-900">{heroDetails.email}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span className="text-xs text-slate-500">School</span>
              <span className="font-semibold text-slate-900">{heroDetails.employer}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 transition">
              Edit Profile
            </button>
            <button className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600">
              Generate Join Code
            </button>
          </div>
        </article>
        <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Teaching Load</p>
            <h2 className="text-xl font-bold text-slate-900">Active Subjects</h2>
          </div>
          <div className="space-y-3">
            {loading ? (
              <p className="text-xs text-slate-500">Loading subjects…</p>
            ) : subjects.length === 0 ? (
              <p className="text-xs text-slate-500">No subjects found yet.</p>
            ) : (
              subjects.slice(0, 4).map((subject) => (
                <div key={subject.id} className="rounded-2xl border border-slate-100 px-4 py-3 bg-slate-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{subject.name}</p>
                    <p className="text-[11px] text-slate-500">{`${subject.year} · ${subject.section}`}</p>
                  </div>
                  <span className="text-[11px] text-slate-500">{subject.joinCode || 'No join code'}</span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
};

export default TeacherProfile;
