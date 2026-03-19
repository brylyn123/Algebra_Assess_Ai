const STORAGE_KEY_PREFIX = 'algebraAssessSubjects';

const storageKeyForTeacher = (teacherId) => `${STORAGE_KEY_PREFIX}_${teacherId ?? 'global'}`;

export function loadSubjects(teacherId) {
  if (!teacherId || typeof window === 'undefined') {
    return [];
  }
  const stored = window.localStorage.getItem(storageKeyForTeacher(teacherId));
  if (!stored) {
    return [];
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.map((subject) => ({
        studentCount: 0,
        activeAssessments: 0,
        archived: false,
        ...subject,
      }));
    }
  } catch {
    // Fallback silently
  }
  return [];
}

export function saveSubjects(teacherId, subjects) {
  if (!teacherId || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKeyForTeacher(teacherId), JSON.stringify(subjects));
  } catch {
    // Fail silently
  }
}
