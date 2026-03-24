import React, { useMemo } from 'react';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const StudentProfile = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const stored = currentEmail ? findLocalUser(currentEmail) : null;

  const profileSummary = useMemo(() => {
    const firstName = stored?.firstName || 'Student';
    const lastName = stored?.lastName || 'Example';
    return {
      fullName: `${firstName} ${lastName}`.trim(),
      email: stored?.email || 'student@example.com',
      school: stored?.collegeName || 'Algebra High School',
      section: stored?.sectionName || 'Section A',
      year: stored?.yearLevel || '11th Grade',
      role: stored?.role || 'Student',
      avatarInitials: `${(firstName[0] ?? 'S')}${(lastName[0] ?? 'S')}`.toUpperCase(),
    };
  }, [stored]);

  const widgets = [
    { label: 'Enrolled subjects', value: stored?.subjects?.length ?? '—', gradient: 'from-sky-500 via-indigo-500 to-purple-600' },
    { label: 'Completed assessments', value: stored?.completedAssessments ?? 0, gradient: 'from-emerald-500 via-teal-500 to-cyan-500' },
    { label: 'Average score', value: stored?.averageScore ? `${stored.averageScore}%` : 'TBD', gradient: 'from-amber-500 via-orange-500 to-rose-500' },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-slate-100 bg-white/90 p-8 shadow-[0_25px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-2xl font-bold shadow-xl">
              {profileSummary.avatarInitials}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student Profile</p>
              <h1 className="text-3xl font-bold text-slate-900">{profileSummary.fullName}</h1>
              <p className="text-sm text-slate-500">Manage your classes, submissions, and settings here.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 hover:border-blue-400 hover:text-blue-700">
              Edit profile
            </button>
            <button className="rounded-full bg-slate-900 text-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] shadow-lg">
              Share progress
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {widgets.map((widget) => (
          <div
            key={widget.label}
            className={`rounded-[1.5rem] px-6 py-5 text-white shadow-sm bg-gradient-to-r ${widget.gradient}`}
          >
            <p className="text-[10px] uppercase tracking-[0.3em]">{widget.label}</p>
            <p className="text-3xl font-bold">{widget.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: 'School', value: profileSummary.school },
            { label: 'Email', value: profileSummary.email },
            { label: 'Section', value: profileSummary.section },
            { label: 'Year Level', value: profileSummary.year },
            { label: 'Role', value: profileSummary.role },
          ].map((field) => (
            <div key={field.label} className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{field.label}</p>
              <p className="text-sm font-semibold text-slate-900">{field.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
