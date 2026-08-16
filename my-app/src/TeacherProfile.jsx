import React, { useEffect, useMemo, useState } from 'react';
import axios from './axiosClient';
import { findLocalUser, getCurrentLocalUserEmail, storeLocalUser } from './localAuthStore';

const TeacherProfile = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const [storedTeacher, setStoredTeacher] = useState(() => currentEmail ? findLocalUser(currentEmail) : null);
  const teacherId = storedTeacher?.user_id ?? storedTeacher?.teacher_id ?? storedTeacher?.id ?? null;

  const [subjects, setSubjects] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [formValues, setFormValues] = useState({
    firstName: '',
    lastName: '',
    collegeName: '',
    institutional_id: '',
  });

  useEffect(() => {
    const syncUser = () => {
      const email = getCurrentLocalUserEmail();
      setStoredTeacher(email ? findLocalUser(email) : null);
    };
    const eventName = 'aa-local-user-updated';
    window.addEventListener(eventName, syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener(eventName, syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  useEffect(() => {
    setFormValues({
      firstName: storedTeacher?.firstName ?? '',
      lastName: storedTeacher?.lastName ?? '',
      collegeName: storedTeacher?.collegeName ?? '',
      institutional_id: storedTeacher?.institutional_id ?? storedTeacher?.idNumber ?? '',
    });
  }, [storedTeacher]);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!storedTeacher?.email) return;
    storeLocalUser({
      ...storedTeacher,
      firstName: formValues.firstName.trim(),
      lastName: formValues.lastName.trim(),
      collegeName: formValues.collegeName.trim(),
      institutional_id: formValues.institutional_id.trim(),
    });
    setSaveMessage('Profile updated.');
    setIsEditing(false);
    setTimeout(() => setSaveMessage(''), 2500);
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto teacher-scrollbar px-1 pt-3 sm:px-2">
      <div className="mx-auto flex w-full flex-col gap-2">
        <section className="shrink-0 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-4 py-3 mb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-white">{heroDetails.name}</h2>
              </div>
              <p className="text-xs text-blue-100 ml-[42px]">Lead your algebra classes with confidence and AI-powered insights.</p>
            </div>
            <div className="flex gap-2 ml-[42px] sm:ml-0">
              <button
                type="button"
                onClick={() => { setSaveMessage(''); setIsEditing((c) => !c); }}
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-white/20"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                {isEditing ? 'Close' : 'Edit'}
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-[10px] uppercase tracking-wider text-blue-200">School</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{heroDetails.employer}</p>
              <p className="text-xs text-blue-200">{heroDetails.email}</p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-[10px] uppercase tracking-wider text-blue-200">Subjects</p>
              <p className="mt-0.5 text-2xl font-black text-white">{loading ? '-' : statistics.subjects}</p>
              <p className="text-xs text-blue-200">Active classes assigned to you.</p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-3">
              <p className="text-[10px] uppercase tracking-wider text-blue-200">Learners</p>
              <p className="mt-0.5 text-2xl font-black text-white">{loading ? '-' : statistics.students}</p>
              <p className="text-xs text-blue-200">Students enrolled across all subjects.</p>
            </div>
          </div>
        </section>

        {saveMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">
            {saveMessage}
          </div>
        )}

        {isEditing && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-500 mb-3">Edit Profile</p>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { name: 'firstName', label: 'First Name', value: formValues.firstName },
                { name: 'lastName', label: 'Last Name', value: formValues.lastName },
                { name: 'collegeName', label: 'School', value: formValues.collegeName },
                { name: 'institutional_id', label: 'Teacher ID', value: formValues.institutional_id },
              ].map((field) => (
                <div key={field.name}>
                  <label className="mb-1 block text-[10px] font-semibold text-slate-500">{field.label}</label>
                  <input
                    name={field.name}
                    value={field.value}
                    onChange={handleChange}
                    placeholder={field.label}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-200/60 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
