import React, { useEffect, useMemo, useState } from 'react';
import {
  findLocalUser,
  getCurrentLocalUserEmail,
  getLocalUserEventName,
  storeLocalUser,
} from './localAuthStore';

const getNormalizedStudentProfile = (stored) => {
  const firstName = stored?.firstName ?? stored?.first_Name ?? '';
  const middleName = stored?.middleName ?? stored?.middle_Name ?? '';
  const lastName = stored?.lastName ?? stored?.last_Name ?? '';
  const combinedName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
  const fallbackName = typeof stored?.name === 'string' ? stored.name.trim() : '';
  const fullName = combinedName || fallbackName || 'Student Example';
  const nameParts = (combinedName || fallbackName).split(/\s+/).filter(Boolean);
  const avatarInitials = nameParts.length >= 2
    ? `${nameParts[0][0] ?? 'S'}${nameParts[nameParts.length - 1][0] ?? 'S'}`
    : `${(nameParts[0]?.[0] ?? 'S')}${(lastName?.[0] ?? nameParts[0]?.[1] ?? 'S')}`;

  return {
    fullName,
    email: stored?.email || 'student@example.com',
    studentId: stored?.institutional_id || stored?.idNumber || stored?.student_id || 'Not set',
    school: stored?.collegeName || 'Algebra High School',
    course: stored?.courseName || 'Not set',
    section: stored?.sectionName || 'Section A',
    year: stored?.yearLevel || 'Year 1',
    role: stored?.role || 'Student',
    avatarInitials: avatarInitials.toUpperCase(),
  };
};

const StudentProfile = () => {
  const [stored, setStored] = useState(() => {
    const currentEmail = getCurrentLocalUserEmail();
    return currentEmail ? findLocalUser(currentEmail) : null;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [formValues, setFormValues] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    school: '',
    section: '',
    year: '',
  });

  useEffect(() => {
    const syncCurrentUser = () => {
      const currentEmail = getCurrentLocalUserEmail();
      setStored(currentEmail ? findLocalUser(currentEmail) : null);
    };

    syncCurrentUser();
    const eventName = getLocalUserEventName();
    window.addEventListener(eventName, syncCurrentUser);
    window.addEventListener('storage', syncCurrentUser);

    return () => {
      window.removeEventListener(eventName, syncCurrentUser);
      window.removeEventListener('storage', syncCurrentUser);
    };
  }, []);

  const profileSummary = useMemo(() => getNormalizedStudentProfile(stored), [stored]);

  useEffect(() => {
    setFormValues({
      firstName: stored?.firstName ?? stored?.first_Name ?? '',
      middleName: stored?.middleName ?? stored?.middle_Name ?? '',
      lastName: stored?.lastName ?? stored?.last_Name ?? '',
      school: stored?.collegeName ?? '',
      section: stored?.sectionName ?? '',
      year: stored?.yearLevel ?? '',
    });
  }, [stored]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
  };

  const handleSave = () => {
    if (!stored?.email) return;

    storeLocalUser({
      ...stored,
      firstName: formValues.firstName.trim(),
      first_Name: formValues.firstName.trim(),
      middleName: formValues.middleName.trim(),
      middle_Name: formValues.middleName.trim(),
      lastName: formValues.lastName.trim(),
      last_Name: formValues.lastName.trim(),
      name: [formValues.firstName, formValues.middleName, formValues.lastName].filter(Boolean).join(' ').trim(),
      collegeName: formValues.school.trim(),
      sectionName: formValues.section.trim(),
      yearLevel: formValues.year.trim(),
    });

    setSaveMessage('Profile updated.');
    setIsEditing(false);
    setTimeout(() => setSaveMessage(''), 2500);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-slate-100 bg-white/90 p-8 shadow-[0_25px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white shadow-xl">
              {profileSummary.avatarInitials}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student Profile</p>
              <h1 className="text-3xl font-bold text-slate-900">{profileSummary.fullName}</h1>
              <p className="text-sm text-slate-500">Manage your classes, submissions, and personal details here.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSaveMessage('');
                setIsEditing((current) => !current);
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 hover:border-blue-400 hover:text-blue-700"
            >
              {isEditing ? 'Close editor' : 'Edit profile'}
            </button>
            <button type="button" className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-lg">
              Share progress
            </button>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="rounded-[2rem] border border-blue-100 bg-blue-50/60 p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.3em] text-blue-500">Edit Details</p>
            <h2 className="text-2xl font-semibold text-slate-900">Update Profile</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              name="firstName"
              value={formValues.firstName}
              onChange={handleChange}
              placeholder="First name"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            />
            <input
              name="middleName"
              value={formValues.middleName}
              onChange={handleChange}
              placeholder="Middle name"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            />
            <input
              name="lastName"
              value={formValues.lastName}
              onChange={handleChange}
              placeholder="Last name"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            />
            <input
              name="school"
              value={formValues.school}
              onChange={handleChange}
              placeholder="School"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            />
            <input
              name="section"
              value={formValues.section}
              onChange={handleChange}
              placeholder="Section"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            />
            <input
              name="year"
              value={formValues.year}
              onChange={handleChange}
              placeholder="Year level"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {saveMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {saveMessage}
        </div>
      )}

      <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Details</p>
            <h2 className="text-2xl font-semibold text-slate-900">Personal Information</h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: 'Student ID', value: profileSummary.studentId },
            { label: 'School', value: profileSummary.school },
            { label: 'Course', value: profileSummary.course },
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
