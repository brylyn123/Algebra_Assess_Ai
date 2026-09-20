import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  findLocalUser,
  getCurrentLocalUserEmail,
  getLocalUserEventName,
  storeLocalUser,
} from './localAuthStore';
import { API_BASE_URL } from './apiBase';

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
    school: stored?.collegeName || 'Not set',
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
  const [showArchived, setShowArchived] = useState(false);
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);
  const [archivedSubjects, setArchivedSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [formValues, setFormValues] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    school: '',
    section: '',
    year: '',
    studentId: '',
    course: '',
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

  const loadSubjects = useCallback(async () => {
    const studentId = stored?.user_id ?? stored?.student_id;
    if (!studentId) {
      setLoadingSubjects(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/get_student_subjects.php?student_id=${studentId}`, {
        credentials: 'include',
      });
      const payload = await response.json();
      if (response.ok && payload.status === 'success') {
        setEnrolledSubjects(Array.isArray(payload.enrolled_subjects) ? payload.enrolled_subjects : []);
        setArchivedSubjects(Array.isArray(payload.archived_subjects) ? payload.archived_subjects : []);
      }
    } catch {
      // silent
    } finally {
      setLoadingSubjects(false);
    }
  }, [stored]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    setFormValues({
      firstName: stored?.firstName ?? stored?.first_Name ?? '',
      middleName: stored?.middleName ?? stored?.middle_Name ?? '',
      lastName: stored?.lastName ?? stored?.last_Name ?? '',
      school: stored?.collegeName ?? '',
      section: stored?.sectionName ?? '',
      year: stored?.yearLevel ?? '',
      studentId: stored?.institutional_id ?? stored?.idNumber ?? stored?.student_id ?? '',
      course: stored?.courseName ?? '',
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
      institutional_id: formValues.studentId.trim(),
      idNumber: formValues.studentId.trim(),
      student_id: formValues.studentId.trim(),
      courseName: formValues.course.trim(),
    });

    setSaveMessage('Profile updated.');
    setIsEditing(false);
    setTimeout(() => setSaveMessage(''), 2500);
  };

  return (
    <div className="mx-auto flex h-full w-full flex-col px-1 pt-3 sm:px-2">
      <div className="shrink-0 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-4 py-3 mb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">Profile</h2>
            </div>
            <p className="text-xs text-blue-100 ml-[42px]">
              View and manage your personal details and account information.
            </p>
          </div>
          <div className="flex gap-2 ml-[42px] sm:ml-0">
            <button
              type="button"
              onClick={() => {
                setSaveMessage('');
                setIsEditing((current) => !current);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-white/20"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
              {isEditing ? 'Close' : 'Edit'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-white border border-slate-200/60 shadow-sm" style={{ scrollbarWidth: 'thin', scrollbarColor: '#94a3b8 transparent' }}>
        <style>{`
          .profile-scroll::-webkit-scrollbar { width: 7px; }
          .profile-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 9999px; }
          .profile-scroll::-webkit-scrollbar-thumb { background-color: #94a3b8; border-radius: 9999px; }
          .profile-scroll::-webkit-scrollbar-thumb:hover { background-color: #64748b; }
        `}</style>
        <div className="profile-scroll p-4 space-y-4">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-md shadow-blue-200/60">
              {profileSummary.avatarInitials}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-900 truncate">{profileSummary.fullName}</h3>
              <p className="text-xs text-slate-500">{profileSummary.email}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">{profileSummary.role}</span>
                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">{profileSummary.course}</span>
                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">{profileSummary.section}</span>
              </div>
            </div>
          </div>

          {/* Active/Archived Toggle */}
          <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-900">My Subjects</p>
              <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowArchived(false)}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${!showArchived
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                  Active ({enrolledSubjects.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchived(true)}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${showArchived
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                  Archived ({archivedSubjects.length})
                </button>
              </div>
            </div>

            {loadingSubjects ? (
              <p className="text-xs text-slate-400">Loading subjects...</p>
            ) : (
              <div className="space-y-2">
                {(showArchived ? archivedSubjects : enrolledSubjects).length === 0 ? (
                  <p className="text-xs text-slate-400">
                    {showArchived ? 'No archived subjects yet.' : 'No active subjects yet.'}
                  </p>
                ) : (
                  (showArchived ? archivedSubjects : enrolledSubjects).map((subject) => (
                    <div
                      key={subject.subject_id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 transition hover:bg-slate-100"
                    >
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          {subject.subject_code || 'Subject'}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-900">{subject.subject_name}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${showArchived
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                        }`}>
                        {showArchived ? 'Archived' : 'Active'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {isEditing && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setIsEditing(false)}>
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Edit Profile</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">Update your personal details below.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { name: 'firstName', label: 'First Name', value: formValues.firstName },
                    { name: 'middleName', label: 'Middle Name', value: formValues.middleName },
                    { name: 'lastName', label: 'Last Name', value: formValues.lastName },
                    { name: 'studentId', label: 'Student ID', value: formValues.studentId },
                    { name: 'course', label: 'Course', value: formValues.course },
                    { name: 'school', label: 'School', value: formValues.school },
                    { name: 'section', label: 'Section', value: formValues.section },
                    { name: 'year', label: 'Year Level', value: formValues.year },
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
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-200/60 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {saveMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">
              {saveMessage}
            </div>
          )}

          <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400 mb-3">Personal Information</p>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { label: 'Student ID', value: profileSummary.studentId },
                { label: 'School', value: profileSummary.school },
                { label: 'Course', value: profileSummary.course },
                { label: 'Email', value: profileSummary.email },
                { label: 'Section', value: profileSummary.section },
                { label: 'Year Level', value: profileSummary.year },
                { label: 'Role', value: profileSummary.role },
              ].map((field) => (
                <div key={field.label} className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{field.label}</p>
                  <p className="text-sm font-semibold text-slate-700">{field.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
