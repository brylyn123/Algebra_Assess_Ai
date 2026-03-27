import React, { useMemo, useState } from 'react';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';

const TeacherSettings = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;

  const [notificationPrefs, setNotificationPrefs] = useState({
    email: true,
    sms: false,
    push: true,
  });
  const [defaultView, setDefaultView] = useState('subjects');
  const [timeZone, setTimeZone] = useState('Asia/Manila');

  const fullName = `${storedTeacher?.firstName ?? 'Teacher'} ${storedTeacher?.lastName ?? ''}`.trim();

  const toggles = useMemo(
    () => [
      {
        label: 'Email notifications',
        key: 'email',
        description: 'Receive updates when students submit work or feedback is ready.',
      },
      {
        label: 'SMS alerts',
        key: 'sms',
        description: 'Text message alerts for urgent notifications.',
      },
      {
        label: 'Push notifications',
        key: 'push',
        description: 'Allow push notifications when using the teacher app on mobile.',
      },
    ],
    []
  );

  const handleToggle = (key) => {
    setNotificationPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-8">
      <section className="page-hero-card p-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">App Settings</p>
          <h1 className="text-3xl font-bold text-slate-900">Classroom Controls</h1>
          <p className="text-sm text-slate-500">
            Customize AlgebraAssess so your workflow matches your grading rhythm.
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Logged in as</p>
            <p className="text-sm font-semibold text-slate-900">{fullName}</p>
            <p className="text-xs text-slate-500">{storedTeacher?.email ?? 'teacher@example.com'}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Default view</p>
            <div className="mt-2 flex gap-2 flex-wrap">
              {['subjects', 'submissions', 'reports'].map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setDefaultView(entry)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${entry === defaultView ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700'}`}
                >
                  {entry.charAt(0).toUpperCase() + entry.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Choose the page you want to land on after login.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Notifications</p>
            <h2 className="text-xl font-bold text-slate-900">Alert preferences</h2>
          </div>
          <div className="space-y-3">
            {toggles.map((toggle) => (
              <div
                key={toggle.key}
                className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{toggle.label}</p>
                  <p className="text-xs text-slate-500">{toggle.description}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={notificationPrefs[toggle.key]}
                    onChange={() => handleToggle(toggle.key)}
                    className="peer sr-only"
                  />
                  <span className="h-5 w-10 rounded-full bg-slate-200 transition peer-checked:bg-blue-600"></span>
                  <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:left-5"></span>
                </label>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Syllabus controls</p>
            <h2 className="text-xl font-bold text-slate-900">Workflow settings</h2>
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Time zone</label>
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            >
              <option>Asia/Manila</option>
              <option>Asia/Singapore</option>
              <option>America/New_York</option>
              <option>UTC</option>
            </select>
            <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <span>Auto-archive completed assessments</span>
              <button className="rounded-full border border-slate-300 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-500 hover:border-blue-300 hover:text-blue-700">
                Toggle
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Settings are saved locally and synced with your account.</p>
          </div>
        </article>
      </section>
    </div>
  );
};

export default TeacherSettings;
