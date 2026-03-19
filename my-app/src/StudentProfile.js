import React from 'react';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const StudentProfile = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const stored = currentEmail ? findLocalUser(currentEmail) : null;

  const profile = {
    firstName: stored?.firstName || 'Student',
    lastName: stored?.lastName || 'Example',
    email: stored?.email || 'student@example.com',
    college: stored?.collegeName || 'Algebra High School',
    section: stored?.sectionName || 'Section A',
    yearLevel: stored?.yearLevel || '11th Grade',
    role: stored?.role || 'Student',
  };

  const fields = [
    { label: 'Full Name', value: `${profile.firstName} ${profile.lastName}` },
    { label: 'School', value: profile.college },
    { label: 'Email', value: profile.email },
    { label: 'Section', value: profile.section },
    { label: 'Year Level', value: profile.yearLevel },
    { label: 'Role', value: profile.role },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-100 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] text-center">
        <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-slate-100"></div>
        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500">Update your student details and settings</p>
      </div>

      <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{field.label}</span>
              <span className="text-sm font-semibold text-slate-700">{field.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 transition">
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
