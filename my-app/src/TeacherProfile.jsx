import React, { useEffect, useMemo, useState } from 'react';
import axios from './axiosClient';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const TeacherProfile = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = storedTeacher?.user_id ?? storedTeacher?.teacher_id ?? storedTeacher?.id ?? null;

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
          axios.get(`/get_subjects.php?teacher_id=${teacherId}`),
          axios.get(`/get_enrollments.php`, {
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
          course: subject.course ?? '',
          section: subject.section ?? 'Section -',
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

    return {
      subjects: subjects.length,
      students: totalStudents,
    };
  }, [enrollments, subjects.length]);

  const heroDetails = {
    name: `${storedTeacher?.firstName ?? 'Teacher'} ${storedTeacher?.lastName ?? ''}`.trim(),
    email: storedTeacher?.email ?? 'teacher@example.com',
    employer: storedTeacher?.collegeName ?? 'Algebra Assess Academy',
    role: storedTeacher?.role ?? 'Teacher',
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto teacher-scrollbar px-4 py-3 md:px-6 md:py-4">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
        <section className="page-hero-card p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">Teacher Profile</p>
              <h1 className="text-xl font-bold text-slate-900">{heroDetails.name}</h1>
              <p className="text-sm text-slate-500">Lead your algebra classes with confidence and AI-powered insights.</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-white/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-700 shadow-sm">
              {heroDetails.role}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.2rem] border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-[0_10px_20px_rgba(56,189,248,0.08)]">
              <p className="text-[10px] uppercase tracking-[0.3em] text-sky-600">School</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{heroDetails.employer}</p>
              <p className="text-xs text-slate-500">{heroDetails.email}</p>
            </div>
            <div className="rounded-[1.2rem] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-[0_10px_20px_rgba(16,185,129,0.08)]">
              <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-600">Subjects</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{loading ? '-' : statistics.subjects}</p>
              <p className="text-xs text-slate-500">Active classes assigned to you.</p>
            </div>
            <div className="rounded-[1.2rem] border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-[0_10px_20px_rgba(139,92,246,0.08)]">
              <p className="text-[10px] uppercase tracking-[0.3em] text-violet-600">Learners</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{loading ? '-' : statistics.students}</p>
              <p className="text-xs text-slate-500">Students enrolled across all subjects.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[1.3rem] border border-slate-200 bg-white/90 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.1)]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Profile Details</p>
              <h2 className="text-base font-bold text-slate-900">Contact & Credentials</h2>
            </div>
            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Teacher ID</span>
                <span className="text-sm font-semibold text-slate-900">{storedTeacher?.institutional_id ?? storedTeacher?.idNumber ?? teacherId ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Email</span>
                <span className="text-sm font-semibold text-slate-900">{heroDetails.email}</span>
              </div>
              <div className="flex items-center justify-between rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">School</span>
                <span className="text-sm font-semibold text-slate-900">{heroDetails.employer}</span>
              </div>
            </div>
            <button className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">
              Edit Profile
            </button>
          </article>
          <article className="rounded-[1.3rem] border border-slate-200 bg-white/90 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.1)]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Teaching Load</p>
              <h2 className="text-base font-bold text-slate-900">Active Subjects</h2>
            </div>
            <div className="mt-3 space-y-2">
              {loading ? (
                <p className="text-xs text-slate-500">Loading subjects...</p>
              ) : subjects.length === 0 ? (
                <p className="rounded-[1rem] border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">No subjects found yet.</p>
              ) : (
                subjects.slice(0, 4).map((subject) => (
                  <div key={subject.id} className="flex items-center justify-between rounded-[1rem] border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5 shadow-sm">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{subject.name}</p>
                      <p className="text-[10px] text-slate-500">{[subject.course, subject.year, subject.section].filter(Boolean).join(' | ')}</p>
                    </div>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      {subject.joinCode || 'No code'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};

export default TeacherProfile;
