import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { API_BASE_URL } from './apiBase';
import { apiFetch } from './fetchClient';
import Select from './components/Select';

const AdminCatalog = () => {
  const [catalog, setCatalog] = useState({ colleges: [], courses: [] });
  const [collegeName, setCollegeName] = useState('');
  const [courseForm, setCourseForm] = useState({ name: '', courseCode: '', collegeId: '' });
  const [editingCourse, setEditingCourse] = useState(null);
  const [editCourseForm, setEditCourseForm] = useState({ name: '', courseCode: '', collegeId: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 2800);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const catalogResponse = await fetch(`${API_BASE_URL}/get_catalog.php`, { credentials: 'include' });

      const catalogPayload = await catalogResponse.json();

      if (catalogPayload.status !== 'success') {
        throw new Error(catalogPayload.message || 'Unable to load catalog.');
      }

      setCatalog({
        colleges: Array.isArray(catalogPayload.colleges) ? catalogPayload.colleges : [],
        courses: Array.isArray(catalogPayload.courses) ? catalogPayload.courses : [],
      });
      const availableColleges = Array.isArray(catalogPayload.colleges) ? catalogPayload.colleges : [];
      setCourseForm((prev) => ({
        ...prev,
        collegeId: prev.collegeId || String(availableColleges[0]?.college_id || ''),
      }));
    } catch (error) {
      const err = error?.message || 'Unable to load the catalog.';
      setMessage(err);
      showToast(err, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeCollegeCount = useMemo(
    () => catalog.colleges.filter((college) => Number(college.is_active) === 1).length,
    [catalog.colleges]
  );

  const activeCourseCount = useMemo(
    () => catalog.courses.filter((course) => Number(course.is_active) === 1).length,
    [catalog.courses]
  );

  const postCatalogChange = async (payload, successText) => {
    setSaving(true);
    setMessage('');
    try {
      const response = await apiFetch('/modify_college_course.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.status !== 'success') {
        throw new Error(result.message || 'Save failed.');
      }

      showToast(successText, 'success');
      await loadData();
    } catch (error) {
      const err = error?.message || 'Save failed.';
      setMessage(err);
      showToast(err, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCollege = async (e) => {
    e.preventDefault();
    const trimmed = collegeName.trim();
    if (!trimmed) {
      setMessage('College name is required.');
      showToast('College name is required.', 'error');
      return;
    }

    await postCatalogChange(
      { action: 'create', type: 'college', name: trimmed },
      'College added successfully.'
    );
    setCollegeName('');
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    const trimmedName = courseForm.name.trim();
    if (!trimmedName || !courseForm.collegeId) {
      setMessage('Course name and college are required.');
      showToast('Course name and college are required.', 'error');
      return;
    }

    await postCatalogChange(
      {
        action: 'create',
        type: 'course',
        name: trimmedName,
        courseCode: courseForm.courseCode.trim(),
        collegeId: Number(courseForm.collegeId),
      },
      'Course added successfully.'
    );
    setCourseForm((prev) => ({ ...prev, name: '', courseCode: '' }));
  };

  const toggleCollege = async (college) => {
    await postCatalogChange(
      {
        action: 'toggle_active',
        type: 'college',
        id: college.college_id,
        isActive: Number(college.is_active) === 1 ? 0 : 1,
      },
      `${college.college_name} updated successfully.`
    );
  };

  const toggleCourse = async (course) => {
    await postCatalogChange(
      {
        action: 'toggle_active',
        type: 'course',
        id: course.course_id,
        isActive: Number(course.is_active) === 1 ? 0 : 1,
      },
      `${course.course_name} updated successfully.`
    );
  };

  const startEditCourse = (course) => {
    setEditingCourse(course.course_id);
    setEditCourseForm({
      name: course.course_name,
      courseCode: course.course_code || '',
      collegeId: String(course.college_id || ''),
    });
  };

  const cancelEditCourse = () => {
    setEditingCourse(null);
    setEditCourseForm({ name: '', courseCode: '', collegeId: '' });
  };

  const handleUpdateCourse = async (e, course) => {
    e.preventDefault();
    const trimmedName = editCourseForm.name.trim();
    if (!trimmedName || !editCourseForm.collegeId) {
      setMessage('Course name and college are required.');
      showToast('Course name and college are required.', 'error');
      return;
    }

    await postCatalogChange(
      {
        action: 'update',
        type: 'course',
        id: course.course_id,
        name: trimmedName,
        courseCode: editCourseForm.courseCode.trim(),
        collegeId: Number(editCourseForm.collegeId),
      },
      'Course updated successfully.'
    );
    setEditingCourse(null);
    setEditCourseForm({ name: '', courseCode: '', collegeId: '' });
  };

  const collegeLookup = useMemo(() => {
    const map = new Map();
    catalog.colleges.forEach((college) => map.set(String(college.college_id), college.college_name));
    return map;
  }, [catalog.colleges]);

  return (
      <div className="h-full min-h-0 overflow-y-auto teacher-scrollbar px-4 py-3 md:px-6 md:py-4">
      <div className="mx-auto flex w-full flex-col gap-4">
        <section className="page-hero-card p-5">
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">Admin Catalog</p>
          <h1 className="text-xl font-bold text-slate-900">Colleges and Courses</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Keep the official college and course list here. Signup forms only read from this catalog.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="teacher-float-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Colleges</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{activeCollegeCount}</p>
            </div>
            <div className="teacher-float-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Courses</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{activeCourseCount}</p>
            </div>
            <div className="teacher-float-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Status</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">Managed by admin only</p>
            </div>
          </div>
        </section>

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border px-5 py-3 text-sm font-semibold ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {toast.text}
          </motion.div>
        )}

        {message && !toast && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-600">
            {message}
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="teacher-float-card space-y-3 p-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Add College</p>
              <h2 className="text-base font-bold text-slate-900">Create a new college</h2>
            </div>
            <form className="space-y-3" onSubmit={handleCreateCollege}>
              <input
                type="text"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="College name"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={loading || saving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Saving...' : 'Add College'}
              </button>
            </form>

            <div className="space-y-2 pt-1">
              {catalog.colleges.map((college) => (
                <div key={college.college_id} className="teacher-float-card flex items-center justify-between gap-3 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{college.college_name}</p>
                    <p className="text-[10px] text-slate-500">
                      {Number(college.is_active) === 1 ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCollege(college)}
                    disabled={saving}
                    className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {Number(college.is_active) === 1 ? 'Disable' : 'Enable'}
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="teacher-float-card space-y-3 p-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Add Course</p>
              <h2 className="text-base font-bold text-slate-900">Create a new course</h2>
            </div>
            <form className="space-y-3" onSubmit={handleCreateCourse}>
              <input
                type="text"
                value={courseForm.name}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Course name"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-100"
              />
              <input
                type="text"
                value={courseForm.courseCode}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, courseCode: e.target.value }))}
                placeholder="Course code (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-100"
              />
              <Select
                value={courseForm.collegeId}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, collegeId: e.target.value }))}
                placeholder="Select college"
              >
                {catalog.colleges.map((college) => (
                  <option key={college.college_id} value={college.college_id}>
                    {college.college_name}
                  </option>
                ))}
              </Select>
              <button
                type="submit"
                disabled={loading || saving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Saving...' : 'Add Course'}
              </button>
            </form>

            <div className="space-y-2 pt-1">
              {catalog.courses.map((course) => (
                <div key={course.course_id} className="teacher-float-card px-3 py-2.5">
                  {editingCourse === course.course_id ? (
                    <form className="space-y-2" onSubmit={(e) => handleUpdateCourse(e, course)}>
                      <input
                        type="text"
                        value={editCourseForm.name}
                        onChange={(e) => setEditCourseForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Course name"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-100"
                      />
                      <input
                        type="text"
                        value={editCourseForm.courseCode}
                        onChange={(e) => setEditCourseForm((prev) => ({ ...prev, courseCode: e.target.value }))}
                        placeholder="Course code"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-100"
                      />
                      <Select
                        value={editCourseForm.collegeId}
                        onChange={(e) => setEditCourseForm((prev) => ({ ...prev, collegeId: e.target.value }))}
                        placeholder="Select college"
                      >
                        {catalog.colleges.map((college) => (
                          <option key={college.college_id} value={college.college_id}>
                            {college.college_name}
                          </option>
                        ))}
                      </Select>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-xl bg-blue-600 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditCourse}
                          disabled={saving}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-70"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {course.course_name}{' '}
                          <span className="text-[10px] font-medium text-slate-400">
                            {course.course_code ? `(${course.course_code})` : ''}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {collegeLookup.get(String(course.college_id)) || 'No college'} -{' '}
                          {Number(course.is_active) === 1 ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditCourse(course)}
                          disabled={saving}
                          className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleCourse(course)}
                          disabled={saving}
                          className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {Number(course.is_active) === 1 ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};

export default AdminCatalog;
