import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTeacherRecords } from './hooks/useTeacherRecords';
import { getSubjectThemeByName } from './subjectCardThemes';
import { API_BASE_URL } from './apiBase';
import { apiFetch } from './fetchClient';
import MathText from './MathText';
import Select from './components/Select';
import { useToast } from './components/Toast';

const formatDate = (value) => {
    if (!value) return 'Not dated yet';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const getStudentInitial = (student) => {
    const first = String(student?.first_name || '').trim();
    const name = String(student?.student_name || '').trim();
    const given = first || (name.includes(',') ? (name.split(',')[1] || '').trim() : name);
    return ((given || name || 'S').charAt(0).toUpperCase()) || 'S';
};

const STATUS_OPTIONS = [
    { key: 'all', label: 'All Statuses' },
    { key: 'draft', label: 'Draft' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'pending', label: 'Pending' },
    { key: 'graded', label: 'Graded' },
];

const getStatusLabel = (statusValue) => String(statusValue || 'Draft').toLowerCase();

const matchesStatusFilter = (item, filterKey) => {
    const statusValue = getStatusLabel(item.assessment_status || item.status || 'Draft');
    if (filterKey === 'draft') return statusValue === 'draft';
    if (filterKey === 'scheduled') return statusValue === 'scheduled';
    if (filterKey === 'pending') return statusValue !== 'graded' && statusValue !== 'draft' && statusValue !== 'scheduled';
    if (filterKey === 'graded') return statusValue === 'graded';
    return statusValue !== 'draft';
};

const ManageAssessments = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { assessments, rubrics, currentSchoolYear, loading, statusMessage, deleteAssessment, refreshRecords } = useTeacherRecords();
    const [activePanel, setActivePanel] = useState('assessments');
    const [assessmentFilter, setAssessmentFilter] = useState('all');
    const [subjectFilter, setSubjectFilter] = useState('all');
    const [archiveView, setArchiveView] = useState('active');
    const [schoolYearFilter, setSchoolYearFilter] = useState('all');
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
    const statusMenuRef = useRef(null);

    useEffect(() => {
        if (!statusMenuOpen) return undefined;
        const handleOutside = (event) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
                setStatusMenuOpen(false);
            }
        };
        const handleEscape = (event) => {
            if (event.key === 'Escape') setStatusMenuOpen(false);
        };
        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [statusMenuOpen]);
    const [archiveRequest, setArchiveRequest] = useState(null);
    const [archiving, setArchiving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyPanel, setHistoryPanel] = useState('assessments');
    const [showAssessmentDetail, setShowAssessmentDetail] = useState(false);
    const [selectedAssessmentDetail, setSelectedAssessmentDetail] = useState(null);
    const [detailTab, setDetailTab] = useState('questions');
    const [trackerData, setTrackerData] = useState(null);
    const [trackerLoading, setTrackerLoading] = useState(false);
    const [trackerError, setTrackerError] = useState('');
    const [trackerCache, setTrackerCache] = useState({});
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadTarget, setUploadTarget] = useState(null);
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [removeTarget, setRemoveTarget] = useState(null);
    const [removing, setRemoving] = useState(false);
    const uploadInputRef = useRef(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [assessmentToDelete, setAssessmentToDelete] = useState(null);
    const [showPublishConfirm, setShowPublishConfirm] = useState(false);
    const [assessmentToPublish, setAssessmentToPublish] = useState(null);

    const formatDateTime = (value) => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getDueDateStatus = (dueDate) => {
        if (!dueDate) return null;
        const now = new Date();
        const due = new Date(dueDate);
        if (Number.isNaN(due.getTime())) return null;
        const diffMs = due.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: 'Overdue', color: 'bg-red-50 text-red-700 border-red-200' };
        if (diffDays === 0) return { label: 'Due Today', color: 'bg-amber-50 text-amber-700 border-amber-200' };
        if (diffDays <= 3) return { label: `Due in ${diffDays}d`, color: 'bg-orange-50 text-orange-700 border-orange-200' };
        return { label: `Due in ${diffDays}d`, color: 'bg-blue-50 text-blue-700 border-blue-200' };
    };

    const formatLevelLabel = (level) => {
        const label = String(level?.label ?? '').trim();
        return label || '';
    };

    const fetchTrackerData = useCallback(async (exerciseId) => {
        if (!exerciseId) return;
        setTrackerLoading(true);
        setTrackerError('');
        try {
            const response = await fetch(`${API_BASE_URL}/get_assessment_submission_tracker.php?exercise_id=${exerciseId}`, {
                credentials: 'include',
            });
            const text = await response.text();
            let payload;
            try { payload = JSON.parse(text); } catch { throw new Error('Invalid server response.'); }
            if (!response.ok || payload.status !== 'success' || !Array.isArray(payload.students)) {
                throw new Error(payload.message || 'Unable to load tracker data.');
            }
            setTrackerCache((prev) => ({ ...prev, [exerciseId]: payload }));
            setTrackerData(payload);
        } catch (err) {
            setTrackerError(err.message || 'Failed to load submission tracker.');
        } finally {
            setTrackerLoading(false);
        }
    }, []);

    const openUploadModal = useCallback((student) => {
        setUploadTarget(student);
        setUploadFiles([]);
        setShowUploadModal(true);
    }, []);

    const closeUploadModal = useCallback(() => {
        if (uploading) return;
        setShowUploadModal(false);
        setUploadTarget(null);
        setUploadFiles([]);
    }, [uploading]);

    const handleUploadFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length === 0) return;

        const allowedExt = ['jpg', 'jpeg', 'png', 'pdf'];
        const maxSize = 10 * 1024 * 1024;
        const accepted = [];
        for (const file of files) {
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            if (!allowedExt.includes(ext)) {
                toast.error(`${file.name}: only JPG, JPEG, PNG, and PDF files are allowed.`);
                continue;
            }
            if (file.size > maxSize) {
                toast.error(`${file.name}: each file must be 10MB or smaller.`);
                continue;
            }
            accepted.push(file);
        }
        if (accepted.length === 0) return;

        setUploadFiles((prev) => {
            const merged = [...prev];
            for (const file of accepted) {
                if (merged.length >= 5) {
                    toast.warning('Maximum of 5 files per submission.');
                    break;
                }
                const duplicate = merged.some((f) => f.name === file.name && f.size === file.size);
                if (!duplicate) merged.push(file);
            }
            return merged;
        });
    };

    const submitTeacherUpload = async () => {
        if (!uploadTarget || uploadFiles.length === 0 || uploading) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('exercise_id', String(selectedAssessmentDetail.exercise_id));
            formData.append('student_user_id', String(uploadTarget.student_user_id));
            formData.append('action', 'upload');
            uploadFiles.forEach((file) => formData.append('files[]', file));

            const response = await apiFetch('/teacher_upload_submission.php', {
                method: 'POST',
                body: formData,
            });
            const text = await response.text();
            let payload;
            try { payload = JSON.parse(text); } catch { throw new Error('Invalid server response.'); }
            if (!response.ok || payload.status !== 'success') {
                if (Array.isArray(payload.file_errors) && payload.file_errors.length > 0) {
                    throw new Error(payload.file_errors.map((f) => `${f.file}: ${f.reason}`).join('; '));
                }
                throw new Error(payload.message || 'Unable to upload the submission.');
            }
            toast.success(payload.message || 'Submission uploaded.');
            setShowUploadModal(false);
            setUploadTarget(null);
            setUploadFiles([]);
            await fetchTrackerData(selectedAssessmentDetail.exercise_id);
        } catch (err) {
            toast.error(err.message || 'Failed to upload the submission.');
        } finally {
            setUploading(false);
        }
    };

    const confirmRemoveSubmission = async () => {
        if (!removeTarget || removing) return;
        setRemoving(true);
        try {
            const formData = new FormData();
            formData.append('exercise_id', String(selectedAssessmentDetail.exercise_id));
            formData.append('student_user_id', String(removeTarget.student_user_id));
            formData.append('action', 'remove');

            const response = await apiFetch('/teacher_upload_submission.php', {
                method: 'POST',
                body: formData,
            });
            const text = await response.text();
            let payload;
            try { payload = JSON.parse(text); } catch { throw new Error('Invalid server response.'); }
            if (!response.ok || payload.status !== 'success') {
                throw new Error(payload.message || 'Unable to remove the submission.');
            }
            toast.success(payload.message || 'Submission removed.');
            setRemoveTarget(null);
            await fetchTrackerData(selectedAssessmentDetail.exercise_id);
        } catch (err) {
            toast.error(err.message || 'Failed to remove the submission.');
        } finally {
            setRemoving(false);
        }
    };

    const handlePublish = useCallback(async (exerciseId, publishNow = false) => {
        if (!exerciseId || publishing) return;
        setPublishing(true);
        try {
            const response = await apiFetch('/publish_assessment.php', {
                method: 'POST',
                body: JSON.stringify({ exercise_id: exerciseId, publish_now: publishNow }),
            });
            const text = await response.text();
            let payload;
            try { payload = JSON.parse(text); } catch { throw new Error('Invalid server response.'); }
            if (!response.ok || payload.status !== 'success') {
                throw new Error(payload.message || 'Unable to publish assessment.');
            }
            window.location.reload();
        } catch (err) {
            alert(err.message || 'Failed to publish assessment.');
        } finally {
            setPublishing(false);
        }
    }, [publishing]);

    const publishTargetIsScheduled = String(
        assessmentToPublish?.assessment_status || assessmentToPublish?.status || ''
    ).toLowerCase() === 'scheduled';
    const publishTargetScheduleLabel = assessmentToPublish?.publish_at
        ? formatDateTime(assessmentToPublish.publish_at)
        : null;

    const handleDelete = useCallback((exerciseId) => {
        if (!exerciseId) return;
        const assessment = assessments.find((a) => a.exercise_id === exerciseId);
        setAssessmentToDelete(assessment || { exercise_id: exerciseId });
        setShowDeleteConfirm(true);
    }, [assessments]);

    const confirmDelete = useCallback(async () => {
        if (!assessmentToDelete) return;
        try {
            await deleteAssessment(assessmentToDelete.exercise_id);
            setShowDeleteConfirm(false);
            setAssessmentToDelete(null);
            setShowAssessmentDetail(false);
        } catch {
            // toast already shown by hook
        }
    }, [assessmentToDelete, deleteAssessment]);

    const requestArchive = useCallback((items, mode) => {
        const list = (Array.isArray(items) ? items : [items]).filter(Boolean);
        const ids = Array.from(new Set(list.map((item) => item.exercise_id).filter(Boolean)));
        if (ids.length === 0) return;
        const yearCounts = new Map();
        list.forEach((item) => {
            const label = String(item.school_year || '').trim() || 'No school year set';
            yearCounts.set(label, (yearCounts.get(label) || 0) + 1);
        });
        const years = Array.from(yearCounts.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.label.localeCompare(a.label));
        setArchiveRequest({ ids, mode, count: ids.length, title: list[0]?.title || '', years });
    }, []);

    const confirmArchive = useCallback(async () => {
        if (!archiveRequest || archiving) return;
        setArchiving(true);
        try {
            const response = await apiFetch('/set_assessment_archive.php', {
                method: 'POST',
                body: JSON.stringify({
                    exercise_ids: archiveRequest.ids,
                    archived: archiveRequest.mode === 'archive' ? 1 : 0,
                }),
            });
            const text = await response.text();
            let payload;
            try { payload = JSON.parse(text); } catch { throw new Error('Invalid server response.'); }
            if (!response.ok || payload.status !== 'success') {
                throw new Error(payload.message || 'Unable to update the assessment archive.');
            }
            const nowArchived = archiveRequest.mode === 'archive';
            setArchiveRequest(null);
            setSelectedAssessmentDetail((prev) => (
                prev && archiveRequest.ids.includes(prev.exercise_id) ? { ...prev, archived: nowArchived } : prev
            ));
            refreshRecords();
        } catch (err) {
            alert(err.message || 'Failed to update the assessment archive.');
        } finally {
            setArchiving(false);
        }
    }, [archiveRequest, archiving, refreshRecords]);

    useEffect(() => {
        setDetailTab('questions');
        setTrackerData(null);
        setTrackerError('');
        setTrackerLoading(false);
    }, [showAssessmentDetail]);

    useEffect(() => {
        if (!showAssessmentDetail) return;
        const cached = trackerCache[selectedAssessmentDetail?.exercise_id];
        if (cached) {
            setTrackerData(cached);
        } else {
            setTrackerData(null);
        }
        setTrackerError('');
        setTrackerLoading(false);
    }, [selectedAssessmentDetail?.exercise_id, showAssessmentDetail]);

    useEffect(() => {
        if ((detailTab === 'tracker' || detailTab === 'upload') && selectedAssessmentDetail && showAssessmentDetail) {
            const cached = trackerCache[selectedAssessmentDetail.exercise_id];
            if (cached) {
                setTrackerData(cached);
            } else {
                fetchTrackerData(selectedAssessmentDetail.exercise_id);
            }
        }
    }, [detailTab, selectedAssessmentDetail?.exercise_id, showAssessmentDetail]);

    const subjectOptions = useMemo(() => {
        const map = new Map();
        assessments.forEach((item) => {
            (item.subjects || []).forEach((s) => {
                if (s?.subject_id != null && !map.has(String(s.subject_id))) {
                    map.set(String(s.subject_id), s.subject_name || 'Unnamed Subject');
                }
            });
        });
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [assessments]);

    const archivedCount = useMemo(
        () => assessments.filter((item) => item.archived).length,
        [assessments]
    );
    const activeCount = assessments.length - archivedCount;

    const schoolYearOptions = useMemo(() => {
        const counts = new Map();
        assessments.forEach((item) => {
            const label = String(item.school_year || '').trim();
            if (!label) return;
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        return Array.from(counts.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => {
                if (a.label === b.label) return 0;
                const aCurrent = assessments.some((item) => item.is_current_year && item.school_year === a.label);
                const bCurrent = assessments.some((item) => item.is_current_year && item.school_year === b.label);
                if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
                return b.label.localeCompare(a.label);
            });
    }, [assessments]);

    const currentYearLabel = useMemo(
        () => currentSchoolYear
            || assessments.find((item) => item.is_current_year && item.school_year)?.school_year
            || '',
        [currentSchoolYear, assessments]
    );

    const pastYearActiveCount = useMemo(
        () => assessments.filter((item) => !item.archived && item.is_past_year).length,
        [assessments]
    );

    const baseAssessments = useMemo(() => {
        return assessments.filter((item) => {
            const isArchived = Boolean(item.archived);
            if (archiveView === 'archived' && !isArchived) return false;
            if (archiveView === 'active' && isArchived) return false;
            if (schoolYearFilter !== 'all' && String(item.school_year || '').trim() !== schoolYearFilter) {
                return false;
            }
            if (subjectFilter !== 'all') {
                const belongs = (item.subjects || []).some(
                    (s) => String(s.subject_id) === String(subjectFilter)
                );
                if (!belongs) return false;
            }
            return true;
        });
    }, [assessments, subjectFilter, archiveView, schoolYearFilter]);

    const statusCounts = useMemo(() => {
        const counts = { all: 0, draft: 0, scheduled: 0, pending: 0, graded: 0 };
        baseAssessments.forEach((item) => {
            const statusValue = getStatusLabel(item.assessment_status || item.status || 'Draft');
            if (statusValue === 'draft') counts.draft += 1;
            else if (statusValue === 'scheduled') counts.scheduled += 1;
            else if (statusValue === 'graded') counts.graded += 1;
            else counts.pending += 1;
            if (statusValue !== 'draft') counts.all += 1;
        });
        return counts;
    }, [baseAssessments]);

    const filteredAssessments = useMemo(() => {
        return baseAssessments.filter((item) => matchesStatusFilter(item, assessmentFilter));
    }, [baseAssessments, assessmentFilter]);

    const groupedAssessments = useMemo(() => {
        const groups = new Map();
        filteredAssessments.forEach((item) => {
            const label = String(item.school_year || '').trim();
            const key = label || '__none__';
            if (!groups.has(key)) {
                groups.set(key, { key, label, items: [] });
            }
            groups.get(key).items.push(item);
        });

        return Array.from(groups.values()).sort((a, b) => {
            if (a.key === '__none__') return 1;
            if (b.key === '__none__') return -1;
            const aCurrent = currentYearLabel ? a.label === currentYearLabel : false;
            const bCurrent = currentYearLabel ? b.label === currentYearLabel : false;
            if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
            return b.label.localeCompare(a.label);
        });
    }, [filteredAssessments, currentYearLabel]);

    const showYearGroups = schoolYearFilter === 'all';

    const getStatusClasses = (statusValue) => {
        const lower = String(statusValue).toLowerCase();
        if (lower === 'graded') return { accent: 'from-emerald-400 to-emerald-600', badge: 'bg-emerald-50 text-emerald-700', avatar: 'from-emerald-400 to-emerald-500', dot: 'bg-emerald-500' };
        if (lower === 'pending') return { accent: 'from-amber-400 to-amber-600', badge: 'bg-amber-50 text-amber-700', avatar: 'from-amber-400 to-amber-500', dot: 'bg-amber-500' };
        if (lower === 'scheduled') return { accent: 'from-violet-400 to-violet-600', badge: 'bg-violet-50 text-violet-700', avatar: 'from-violet-400 to-violet-500', dot: 'bg-violet-500' };
        return { accent: 'from-blue-400 to-blue-600', badge: 'bg-blue-50 text-blue-700', avatar: 'from-blue-400 to-blue-500', dot: 'bg-blue-500' };
    };

    return (
        <div className="relative h-full overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
            {activePanel === 'assessments' && (
                <button
                    type="button"
                    onClick={() => navigate('/teacher/assessments/new')}
                    className="absolute bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl sm:px-5"
                >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                    <span className="text-xs font-bold tracking-wide">Create Assessment</span>
                </button>
            )}
            <div className="flex h-full flex-col overflow-hidden">

                <div className="shrink-0 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-4 py-3 mb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                        <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM9 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <h2 className="text-lg font-bold text-white">Assessments</h2>
                            </div>
                            <p className="text-xs text-blue-100 ml-[42px]">Create and manage your quizzes, exams, and rubrics.</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white">
                                <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                                Total {assessments.length}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-medium text-emerald-100">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Active {assessments.filter((a) => String(a.assessment_status || a.status || 'Draft').toLowerCase() !== 'draft').length}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-medium text-amber-100">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                Drafts {assessments.filter((a) => String(a.assessment_status || a.status || 'Draft').toLowerCase() === 'draft').length}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-3 sm:px-4 py-2 sm:py-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex flex-wrap items-center gap-2 w-full">
                                <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                                    <Select
                                        value={subjectFilter}
                                        onChange={(e) => setSubjectFilter(e.target.value)}
                                        aria-label="Filter by subject"
                                        disabled={activePanel !== 'assessments'}
                                    >
                                        <option value="all">All Subjects</option>
                                        {subjectOptions.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </Select>
                                </div>
                                <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                                    <Select
                                        value={schoolYearFilter}
                                        onChange={(e) => setSchoolYearFilter(e.target.value)}
                                        aria-label="Filter by school year"
                                        disabled={activePanel !== 'assessments'}
                                    >
                                        <option value="all">All School Years</option>
                                        {schoolYearOptions.map((option) => (
                                            <option key={option.label} value={option.label}>
                                                {currentYearLabel && option.label === currentYearLabel
                                                    ? `${option.label} (current)`
                                                    : `${option.label} (${option.count})`}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                                <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                                    <Select
                                        value={activePanel}
                                        onChange={(e) => setActivePanel(e.target.value)}
                                        aria-label="Assessments or rubrics"
                                    >
                                        <option value="assessments">Assessments ({activeCount})</option>
                                        <option value="rubrics">Rubrics ({rubrics.length})</option>
                                    </Select>
                                </div>
                                <div className="relative w-full min-w-0 sm:w-auto sm:flex-1" ref={statusMenuRef}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (activePanel === 'assessments') setStatusMenuOpen((open) => !open);
                                        }}
                                        disabled={activePanel !== 'assessments'}
                                        aria-haspopup="listbox"
                                        aria-expanded={statusMenuOpen}
                                        aria-label="Filter by status"
                                        className={`relative flex w-full items-center rounded-xl border bg-white py-2.5 pl-3 pr-10 text-xs font-medium text-slate-700 shadow-sm outline-none transition duration-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-60 ${
                                            statusMenuOpen
                                                ? 'border-blue-400 ring-4 ring-blue-100'
                                                : 'border-slate-200'
                                        }`}
                                    >
                                        <span className="truncate">
                                            {STATUS_OPTIONS.find((option) => option.key === assessmentFilter)?.label || 'All Statuses'} ({statusCounts[assessmentFilter] ?? 0})
                                        </span>
                                        <svg
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                            className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${statusMenuOpen ? 'rotate-180' : ''}`}
                                        >
                                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    {statusMenuOpen && (
                                        <ul
                                            role="listbox"
                                            className="absolute left-0 top-full z-40 mt-1.5 w-full min-w-[180px] origin-top rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                                        >
                                            {STATUS_OPTIONS.map((option) => {
                                                const isActive = assessmentFilter === option.key;
                                                return (
                                                    <li key={option.key}>
                                                        <button
                                                            type="button"
                                                            role="option"
                                                            aria-selected={isActive}
                                                            onClick={() => {
                                                                setAssessmentFilter(option.key);
                                                                setStatusMenuOpen(false);
                                                            }}
                                                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                                                                isActive
                                                                    ? 'bg-blue-50 text-blue-700'
                                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                            }`}
                                                        >
                                                            <span className="flex-1 text-[11px] font-semibold capitalize">{option.label}</span>
                                                            <span className={`rounded-full px-1.5 py-px text-[9px] font-bold ${
                                                                isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                                {statusCounts[option.key] ?? 0}
                                                            </span>
                                                            {isActive && (
                                                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-blue-600">
                                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 min-h-0 flex-col">
                    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                        <style>{`
                            .assess-scroll::-webkit-scrollbar { width: 6px; }
                            .assess-scroll::-webkit-scrollbar-track { background: transparent; }
                            .assess-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 9999px; }
                            .assess-scroll::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
                        `}</style>
                        <div className="space-y-4">
                            {statusMessage && !loading ? (
                                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-rose-500">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-rose-800">Unable to load data</p>
                                        <p className="mt-0.5 text-xs text-rose-600">{statusMessage}</p>
                                    </div>
                                </div>
                            ) : activePanel === 'assessments' ? (
                                <>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                                            {archiveView === 'archived' ? 'Archived Assessments' : 'Your Assessments'}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] text-slate-400">{filteredAssessments.length} total</p>
                                            {archiveView === 'active' && pastYearActiveCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => requestArchive(
                                                        assessments.filter((item) => !item.archived && item.is_past_year),
                                                        'archive'
                                                    )}
                                                    className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-semibold text-indigo-600 transition hover:bg-indigo-100"
                                                >
                                                    Archive previous school years ({pastYearActiveCount})
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Assessment cards grid */}
                                    {filteredAssessments.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
                                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-blue-400">
                                                    <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM9 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-700">
                                                {archiveView === 'archived' ? 'Nothing archived yet' : 'No assessments yet'}
                                            </h4>
                                            <p className="mt-1 max-w-xs text-xs text-slate-400">
                                                {archiveView === 'archived'
                                                    ? 'Archived assessments stay stored here with their school year and student answers.'
                                                    : assessmentFilter !== 'all' || subjectFilter !== 'all' || schoolYearFilter !== 'all'
                                                        ? 'No assessments match this filter. Try a different filter or create a new assessment.'
                                                        : 'Create your first assessment to get started.'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            {groupedAssessments.map((group) => (
                                                <div key={group.key}>
                                                    {showYearGroups && (
                                                        <div className="mb-2.5 flex items-center gap-2">
                                                            <span className={`h-2 w-2 rounded-full ${currentYearLabel && group.label === currentYearLabel ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                                            <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600">
                                                                {group.label || 'No school year set'}
                                                            </h4>
                                                            {currentYearLabel && group.label === currentYearLabel && (
                                                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600">
                                                                    Current
                                                                </span>
                                                            )}
                                                            <span className="ml-auto text-[10px] text-slate-400">
                                                                {group.items.length} {group.items.length === 1 ? 'assessment' : 'assessments'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {group.items.map((item) => {
                                                const statusValue = String(item.assessment_status || item.status || 'Draft');
                                                const statusBadge = getStatusClasses(statusValue);
                                                const subjectTheme = getSubjectThemeByName(item.subject || item.subject_name);
                                                return (
                                                    <div
                                                        key={item.exercise_id}
                                                        onClick={() => {
                                                            setSelectedAssessmentDetail(item);
                                                            setShowAssessmentDetail(true);
                                                        }}
                                                        className={`group relative overflow-hidden rounded-xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer flex flex-col min-h-[96px] sm:min-h-[136px] ${subjectTheme.cardClass}`}
                                                    >
                                                        <div className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${subjectTheme.accentClass}`} />
                                                        <div className="flex flex-1 flex-col gap-1.5 p-3 pl-4">
                                                            <div className="flex items-start gap-2.5">
                                                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${subjectTheme.cardBadgeClass} text-[10px] font-bold`}>
                                                                    {item.title?.charAt(0)?.toUpperCase() || 'A'}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <h3 className={`truncate text-xs sm:text-sm font-semibold ${subjectTheme.cardTextClass}`}>{item.title}</h3>
                                                                    <div className="mt-0.5 flex items-center gap-1.5">
                                                                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusBadge.badge}`}>
                                                                            <span className={`h-1 w-1 rounded-full ${statusBadge.dot}`} />
                                                                            {statusValue}
                                                                        </span>
                                                                        <p className={`truncate text-[10px] sm:text-[11px] font-medium ${subjectTheme.cardSubtextClass}`}>
                                                                            {item.subjects?.length > 0
                                                                                ? item.subjects.map((s) => s.subject_name).join(', ')
                                                                                : item.subject || 'No subject yet'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {item.description && (
                                                                <p className={`hidden sm:block text-[11px] leading-4 line-clamp-2 ${subjectTheme.cardSubtextClass}`}>{item.description}</p>
                                                            )}
                                                            <div className="mt-auto flex flex-wrap gap-1">
                                                                <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium ${subjectTheme.chipClass}`}>
                                                                    {item.topic || 'No topic'}
                                                                </span>
                                                                <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium ${subjectTheme.chipClass}`}>
                                                                    {item.difficulty || 'Medium'}
                                                                </span>
                                                                <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium ${subjectTheme.chipClass}`}>
                                                                    {item.item_count ?? item.items?.length ?? 0} items
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Section header */}
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Your Rubrics</p>
                                        <p className="text-[10px] text-slate-400">{rubrics.length} total</p>
                                    </div>

                                    {rubrics.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
                                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-emerald-400">
                                                    <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-700">No rubrics yet</h4>
                                            <p className="mt-1 max-w-xs text-xs text-slate-400">Create your first rubric to get started.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            {[
                                                { type: 'procedural_algebra', label: 'Procedural Algebra', sublabel: null, color: 'blue' },
                                                { type: 'problem_solving', label: 'Problem-Solving', sublabel: null, color: 'purple' },
                                                { type: 'general', label: 'General', sublabel: null, color: 'emerald' },
                                            ].map((group) => {
                                                const groupRubrics = rubrics.filter((r) => r.rubric_type === group.type || (!r.rubric_type && group.type === 'general'));
                                                if (groupRubrics.length === 0) return null;
                                                return (
                                                    <div key={group.type}>
                                                        <div className="flex items-center gap-2 mb-2.5">
                                                            <span className={`h-2 w-2 rounded-full ${
                                                                group.color === 'blue' ? 'bg-blue-400' :
                                                                group.color === 'purple' ? 'bg-purple-400' :
                                                                'bg-emerald-400'
                                                            }`} />
                                                            <h4 className={`text-[11px] font-bold uppercase tracking-[0.15em] ${
                                                                group.color === 'blue' ? 'text-blue-600' :
                                                                group.color === 'purple' ? 'text-purple-600' :
                                                                'text-emerald-600'
                                                            }`}>
                                                                {group.label}
                                                            </h4>
                                                            {group.sublabel && (
                                                                <span className="text-[10px] text-slate-400 font-medium">({group.sublabel})</span>
                                                            )}
                                                            <span className="text-[10px] text-slate-400 ml-auto">{groupRubrics.length}</span>
                                                        </div>
                                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                            {groupRubrics.map((rubric) => (
                                                                <div
                                                                    key={rubric.rubric_set_id}
                                                                    className="group relative overflow-hidden rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex flex-col min-h-[96px] sm:min-h-[136px]"
                                                                >
                                                                    <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-teal-600" />
                                                                    <div className="flex flex-1 flex-col gap-1.5 p-3 pl-4">
                                                                        <div className="flex items-start gap-2.5">
                                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                                                                {rubric.rubric_name?.charAt(0)?.toUpperCase() || 'R'}
                                                                            </div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <h3 className="truncate text-xs sm:text-sm font-semibold text-slate-900">{rubric.rubric_name}</h3>
                                                                                <p className="mt-0.5 truncate text-[10px] sm:text-[11px] font-medium text-emerald-600/80">{formatDate(rubric.created_at)}</p>
                                                                            </div>
                                                                        </div>
                                                                        <p className="hidden sm:block text-[11px] leading-4 text-slate-600 line-clamp-2">
                                                                            {rubric.criteria || 'No criteria added yet.'}
                                                                        </p>
                                                                        {rubric.ai_instructions && (
                                                                            <div className="hidden sm:block rounded-lg border border-blue-100 bg-blue-50/70 px-2 py-1.5">
                                                                                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-blue-600">AI Instructions</p>
                                                                                <p className="mt-0.5 text-[9px] leading-4 text-slate-600 line-clamp-2">{rubric.ai_instructions}</p>
                                                                            </div>
                                                                        )}
                                                                        {Array.isArray(rubric.level_definitions) && rubric.level_definitions.length > 0 && (
                                                                            <div className="mt-auto flex flex-wrap gap-1">
                                                                                {rubric.level_definitions.map((level, index) => (
                                                                                    <span
                                                                                        key={`${rubric.rubric_set_id}-level-${index}`}
                                                                                        className="inline-flex items-center rounded-md border border-emerald-200/70 bg-white/90 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-semibold text-emerald-700"
                                                                                    >
                                                                                        {formatLevelLabel(level)}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {showHistoryModal &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
                        onClick={() => setShowHistoryModal(false)}
                    >
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-3xl max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.28)]">

                            <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-8 pb-6 pt-7">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/90">History</span>
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">Assessments & Rubrics</h3>
                                        <p className="text-sm text-blue-100/80">Review everything you have created from one panel.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowHistoryModal(false)}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
                                    >
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-1 min-h-0 flex-col overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                                <div className="px-8 py-4">
                                    <div className="mb-4 inline-flex max-w-[320px] rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                                        <button
                                            type="button"
                                            onClick={() => setHistoryPanel('assessments')}
                                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${historyPanel === 'assessments'
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200/60'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                                }`}
                                        >
                                            <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-bold ${historyPanel === 'assessments' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                {assessments.length}
                                            </span>
                                            Assessments
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHistoryPanel('rubrics')}
                                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${historyPanel === 'rubrics'
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200/60'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                                }`}
                                        >
                                            <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full text-[10px] font-bold ${historyPanel === 'rubrics' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                {rubrics.length}
                                            </span>
                                            Rubrics
                                        </button>
                                    </div>

                                    {historyPanel === 'assessments' ? (
                                        <div className="space-y-3">
                                            {assessments.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-blue-400">
                                                            <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM9 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-600">No assessments yet</h4>
                                                    <p className="mt-1 max-w-xs text-xs text-slate-400">Create your first assessment to see it here.</p>
                                                </div>
                                            ) : (
                                                assessments.map((item) => {
                                                    const statusValue = String(item.assessment_status || item.status || 'Draft');
                                                    const statusBadge = getStatusClasses(statusValue);
                                                    const subjectTheme = getSubjectThemeByName(item.subject || item.subject_name);
                                                    return (
                                                        <div
                                                            key={item.exercise_id}
                                                            onClick={() => {
                                                                setSelectedAssessmentDetail(item);
                                                                setShowAssessmentDetail(true);
                                                            }}
                                                            className={`group relative overflow-hidden rounded-[1.1rem] border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer ${subjectTheme.cardClass}`}
                                                        >
                                                            <div className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${subjectTheme.accentClass}`} />
                                                            <div className="flex flex-col gap-3 p-4 pl-5">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                                                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${subjectTheme.cardBadgeClass} text-sm font-bold`}>
                                                                            {item.title?.charAt(0)?.toUpperCase() || 'A'}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <h3 className={`text-sm font-bold truncate ${subjectTheme.cardTextClass}`}>{item.title}</h3>
                                                                                <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusBadge.badge}`}>
                                                                                    {statusValue}
                                                                                </span>
                                                                            </div>
                                                                            <p className={`mt-0.5 text-xs truncate ${subjectTheme.cardSubtextClass}`}>
                                                                                {item.subjects?.length > 0
                                                                                    ? item.subjects.map((s) => s.subject_name).join(', ')
                                                                                    : item.subject || 'Assessment'}
                                                                            </p>
                                                                            <p className={`mt-1 text-[10px] leading-5 line-clamp-2 ${subjectTheme.cardSubtextClass}`}>
                                                                                {item.description || 'No description provided yet.'}
                                                                            </p>
                                                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${subjectTheme.chipClass}`}>
                                                                                    {item.topic || 'No topic'} &middot; {item.difficulty || 'Medium'}
                                                                                </span>
                                                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${subjectTheme.chipClass}`}>
                                                                                    {item.item_count ?? item.items?.length ?? 0} items
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {rubrics.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-emerald-400">
                                                            <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-600">No rubrics yet</h4>
                                                    <p className="mt-1 max-w-xs text-xs text-slate-400">Create your first rubric to see it here.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {[
                                                        { type: 'procedural_algebra', label: 'Procedural Algebra', sublabel: null, color: 'blue' },
                                                        { type: 'problem_solving', label: 'Problem-Solving', sublabel: null, color: 'purple' },
                                                        { type: 'general', label: 'General', sublabel: null, color: 'emerald' },
                                                    ].map((group) => {
                                                        const groupRubrics = rubrics.filter((r) => r.rubric_type === group.type || (!r.rubric_type && group.type === 'general'));
                                                        if (groupRubrics.length === 0) return null;
                                                        return (
                                                            <div key={group.type}>
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className={`h-2 w-2 rounded-full ${
                                                                        group.color === 'blue' ? 'bg-blue-400' :
                                                                        group.color === 'purple' ? 'bg-purple-400' :
                                                                        'bg-emerald-400'
                                                                    }`} />
                                                                    <h4 className={`text-[11px] font-bold uppercase tracking-[0.15em] ${
                                                                        group.color === 'blue' ? 'text-blue-600' :
                                                                        group.color === 'purple' ? 'text-purple-600' :
                                                                        'text-emerald-600'
                                                                    }`}>
                                                                        {group.label}
                                                                    </h4>
                                                                    {group.sublabel && (
                                                                        <span className="text-[10px] text-slate-400 font-medium">({group.sublabel})</span>
                                                                    )}
                                                                    <span className="text-[10px] text-slate-400 ml-auto">{groupRubrics.length}</span>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {groupRubrics.map((rubric) => (
                                                                        <div
                                                                            key={rubric.rubric_set_id}
                                                                            className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/50"
                                                                        >
                                                                            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-teal-600" />
                                                                            <div className="flex flex-col gap-3 p-4 pl-5">
                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                                                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-white">
                                                                                            {rubric.rubric_name?.charAt(0)?.toUpperCase() || 'R'}
                                                                                        </div>
                                                                                        <div className="min-w-0 flex-1">
                                                                                            <h3 className="text-sm font-bold text-slate-900 truncate">{rubric.rubric_name}</h3>
                                                                                            <p className="mt-0.5 text-xs text-slate-500">{formatDate(rubric.created_at)}</p>
                                                                                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                                                                                {rubric.criteria || 'No criteria added yet.'}
                                                                                            </p>
                                                                                            {rubric.ai_instructions && (
                                                                                                <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/70 px-2.5 py-2">
                                                                                                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-blue-600">AI Instructions</p>
                                                                                                    <p className="mt-1 text-xs leading-5 text-slate-600">{rubric.ai_instructions}</p>
                                                                                                </div>
                                                                                            )}
                                                                                            {Array.isArray(rubric.level_definitions) && rubric.level_definitions.length > 0 && (
                                                                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                                                                    {rubric.level_definitions.map((level, index) => (
                                                                                                        <span
                                                                                                            key={`${rubric.rubric_set_id}-modal-level-${index}`}
                                                                                                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                                                                                                        >
                                                                                                            {formatLevelLabel(level)}
                                                                                                        </span>
                                                                                                    ))}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            {showAssessmentDetail && selectedAssessmentDetail &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
                        onClick={() => setShowAssessmentDetail(false)}
                    >
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-3xl max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.28)]">

                            <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-8 pb-6 pt-7">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/90">
                                                {selectedAssessmentDetail.subject || 'Assessment'}
                                            </span>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                                String(selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || 'Draft').toLowerCase() === 'graded'
                                                    ? 'bg-emerald-400/20 text-emerald-100'
                                                    : String(selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || 'Draft').toLowerCase() === 'pending'
                                                        ? 'bg-amber-400/20 text-amber-100'
                                                        : 'bg-blue-300/20 text-blue-100'
                                            }`}>
                                                {selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || 'Draft'}
                                            </span>
                                            {selectedAssessmentDetail.school_year && (
                                                <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90">
                                                    {selectedAssessmentDetail.school_year}
                                                </span>
                                            )}
                                            {selectedAssessmentDetail.archived && (
                                                <span className="inline-flex items-center rounded-full bg-indigo-400/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-100">
                                                    Archived
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">{selectedAssessmentDetail.title}</h3>
                                        {selectedAssessmentDetail.description && (
                                            <p className="max-w-lg text-sm text-blue-100/80 line-clamp-2">{selectedAssessmentDetail.description}</p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowAssessmentDetail(false)}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
                                    >
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-1 min-h-0 flex-col overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                                <div className="px-8 py-6">
                                    <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                                        <div className="rounded-xl sm:rounded-2xl border-l-[3px] border-l-blue-300 bg-blue-50 p-3 sm:p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500">Questions</p>
                                            <p className="mt-1 text-2xl sm:text-3xl font-black text-blue-600">{selectedAssessmentDetail.items?.length ?? 0}</p>
                                            <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-blue-400">Total items</p>
                                        </div>
                                        <div className="rounded-xl sm:rounded-2xl border-l-[3px] border-l-amber-300 bg-amber-50 p-3 sm:p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Total Points</p>
                                            <p className="mt-1 text-2xl sm:text-3xl font-black text-amber-600">
                                                {(selectedAssessmentDetail.items || []).reduce((sum, item) => sum + (item.max_score ?? 0), 0)}
                                            </p>
                                            <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-amber-400">Maximum score</p>
                                        </div>
                                        <div className="rounded-xl sm:rounded-2xl border-l-[3px] border-l-emerald-300 bg-emerald-50 p-3 sm:p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Due Date</p>
                                            <p className="mt-1 text-2xl sm:text-3xl font-black text-emerald-600">
                                                {(() => {
                                                    const due = getDueDateStatus(selectedAssessmentDetail.due_date);
                                                    return due ? due.label : 'None';
                                                })()}
                                            </p>
                                            <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-emerald-400">Deadline status</p>
                                        </div>
                                    </div>

                                    <div className="mb-6 flex flex-wrap gap-1.5">
                                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-slate-400">
                                                <path d="M2 4.5A2.5 2.5 0 014.5 2h7A2.5 2.5 0 0114 4.5v7a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 012 11.5v-7z" />
                                            </svg>
                                            {selectedAssessmentDetail.topic || 'No topic'}
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            {selectedAssessmentDetail.difficulty || 'Medium'}
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            {selectedAssessmentDetail.item_count ?? selectedAssessmentDetail.items?.length ?? 0} items
                                        </span>
                                        <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                            Created {formatDate(selectedAssessmentDetail.date_created)}
                                        </span>
                                        {selectedAssessmentDetail.due_date && (() => {
                                            const due = getDueDateStatus(selectedAssessmentDetail.due_date);
                                            if (!due) return null;
                                            return (
                                                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-semibold ${due.color}`}>
                                                    {due.label}
                                                </span>
                                            );
                                        })()}
                                        {String(selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || '').toLowerCase() === 'scheduled'
                                            && selectedAssessmentDetail.publish_at && (
                                            <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
                                                Publishes {formatDateTime(selectedAssessmentDetail.publish_at)}
                                            </span>
                                        )}
                                    </div>

                                    {selectedAssessmentDetail.subjects?.length > 0 && (
                                        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">Subjects</p>
                                            <div className="mt-1 space-y-1">
                                                {selectedAssessmentDetail.subjects.map((s) => (
                                                    <div key={s.subject_id} className="flex items-center gap-2 text-xs text-slate-600">
                                                        <span className="font-medium">{s.subject_name}</span>
                                                        {s.subject_meta && (
                                                            <span className="text-[10px] text-slate-400">({s.subject_meta})</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedAssessmentDetail.subjects?.length === 0 && selectedAssessmentDetail.subject_meta && (
                                        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">Subject Meta</p>
                                            <p className="mt-0.5 text-xs text-slate-600">{selectedAssessmentDetail.subject_meta}</p>
                                        </div>
                                    )}

                                    <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setDetailTab('questions')}
                                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${detailTab === 'questions'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                                                <path d="M2 4.5A2.5 2.5 0 014.5 2h7A2.5 2.5 0 0114 4.5v7a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 012 11.5v-7z" />
                                            </svg>
                                            Questions ({selectedAssessmentDetail.items?.length ?? 0})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDetailTab('tracker')}
                                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${detailTab === 'tracker'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                                                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                            </svg>
                                            Submission Tracker
                                        </button>
                                        {selectedAssessmentDetail.submit_mode === 'teacher' && (
                                            <button
                                                type="button"
                                                onClick={() => setDetailTab('upload')}
                                                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${detailTab === 'upload'
                                                    ? 'bg-white text-slate-900 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                                                    <path d="M.5 9.5a.5.5 0 01.5.5v3a1 1 0 001 1h12a1 1 0 001-1v-3a.5.5 0 011 0v3a2 2 0 01-2 2H2a2 2 0 01-2-2v-3a.5.5 0 01.5-.5zM8 1.5a.5.5 0 01.5.5v7.793l2.146-2.147a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 01.708-.708L7.5 9.793V2a.5.5 0 01.5-.5z" />
                                                </svg>
                                                Upload Submissions
                                            </button>
                                        )}
                                    </div>

                                    <AnimatePresence mode="wait">
                                    {detailTab === 'questions' && (
                                        <motion.div
                                            key="questions-content"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                                        >
                                        {(!selectedAssessmentDetail.items || selectedAssessmentDetail.items.length === 0) ? (
                                            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-blue-400">
                                                        <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <h4 className="text-sm font-bold text-slate-600">No questions yet</h4>
                                                <p className="mt-1 max-w-xs text-xs text-slate-400">This assessment has no items.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedAssessmentDetail.items.map((item, index) => (
                                                    <div
                                                        key={item.item_id ?? index}
                                                        className="group relative overflow-hidden rounded-xl border border-slate-100 bg-white p-4 transition-all duration-200 hover:border-slate-200 hover:shadow-sm"
                                                    >
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-[11px] font-bold text-blue-700">
                                                                    {item.item_no ?? index + 1}
                                                                </span>
                                                                <div>
                                                                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                                                        {item.question_type || 'Question'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                                                                {item.max_score ?? 0} pts
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-xs leading-6 text-slate-700">
                                                            <MathText text={item.question_content} />
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        </motion.div>
                                    )}

                                    {detailTab === 'tracker' && (
                                        <motion.div
                                            key="tracker-content"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                                            className="space-y-4"
                                        >
                                            {trackerLoading ? (
                                                <div className="flex items-center justify-center py-12">
                                                    <div className="relative">
                                                        <div className="h-8 w-8 rounded-full border-[3px] border-blue-200 border-t-blue-500 animate-spin" />
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                                        </div>
                                                    </div>
                                                    <span className="ml-3 text-sm font-medium text-slate-500">Loading tracker...</span>
                                                </div>
                                            ) : trackerError ? (
                                                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100">
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-rose-500">
                                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-rose-800">Error</p>
                                                        <p className="mt-0.5 text-xs text-rose-600">{trackerError}</p>
                                                    </div>
                                                </div>
                                            ) : trackerData ? (
                                                <>
                                                    <div className="rounded-2xl bg-slate-50 p-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex-1">
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Submission Progress</p>
                                                                <p className="mt-1 text-lg font-black text-slate-900">
                                                                    <span className="text-emerald-600">{trackerData.total_submitted}</span>
                                                                    <span className="text-slate-400"> / </span>
                                                                    {trackerData.total_enrolled}
                                                                    <span className="ml-1 text-sm font-medium text-slate-400">students</span>
                                                                </p>
                                                            </div>
                                                            <div className="h-14 w-14 shrink-0">
                                                                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                                                                    <circle cx="18" cy="18" r="15.91" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                                                                    <circle
                                                                        cx="18" cy="18" r="15.91" fill="none" stroke="#10b981" strokeWidth="3"
                                                                        strokeDasharray={`${trackerData.total_enrolled > 0 ? (trackerData.total_submitted / trackerData.total_enrolled) * 100 : 0} 100`}
                                                                        strokeLinecap="round"
                                                                    />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                        {trackerData.window && (trackerData.window.opens_at || trackerData.window.closes_at) && (
                                                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-[11px]">
                                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600 border border-slate-200">
                                                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-blue-500"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.828a1 1 0 101.414-1.414L11 9.586V6z" clipRule="evenodd" /></svg>
                                                                    {trackerData.window.opens_at ? `Opens ${formatDateTime(trackerData.window.opens_at)}` : 'Opened immediately'}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600 border border-slate-200">
                                                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-rose-500"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L10.586 10l-1.293 1.293a1 1 0 101.414 1.414L12 11.414l1.293 1.293a1 1 0 001.414-1.414L13.414 10l1.293-1.293a1 1 0 00-1.414-1.414L12 8.586 10.707 7.293z" clipRule="evenodd" /></svg>
                                                                    {trackerData.window.closes_at ? `Closes ${formatDateTime(trackerData.window.closes_at)}` : 'No closing time'}
                                                                </span>
                                                                {trackerData.integrity && trackerData.integrity.flagged_students > 0 && (
                                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-bold text-rose-600">
                                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                                        {trackerData.integrity.flagged_students} integrity flag{trackerData.integrity.flagged_students === 1 ? '' : 's'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                                                Students Aâ€“Z ({trackerData.students.length})
                                                            </p>
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                                                                {trackerData.students.filter((s) => s.submitted).length} submitted
                                                            </p>
                                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">
                                                                {trackerData.students.filter((s) => !s.submitted).length} not submitted
                                                            </p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {trackerData.students.map((student) => {
                                                                const isSubmitted = Boolean(student.submitted);
                                                                const stColor = String(student.status || '').toLowerCase() === 'graded'
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                    : String(student.status || '').toLowerCase() === 'needs review'
                                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                        : 'bg-amber-50 text-amber-700 border-amber-200';
                                                                return (
                                                                    <div key={student.student_user_id} className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition hover:shadow-sm ${isSubmitted ? 'border-emerald-200/60' : 'border-amber-200/60'}`}>
                                                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${isSubmitted ? 'bg-gradient-to-br from-emerald-400 to-emerald-500' : 'bg-gradient-to-br from-amber-400 to-amber-500'}`}>
                                                                            {getStudentInitial(student)}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="truncate text-sm font-semibold text-slate-900">{student.student_name}</p>
                                                                            <p className="text-[11px] text-slate-400">ID {student.student_id} {student.date_uploaded && `Â· ${student.date_uploaded}`}</p>
                                                                            {(student.timing_flag || (student.similar_to && student.similar_to.length > 0) || (student.attempts && student.attempts > 1)) && (
                                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                                    {student.timing_flag && (
                                                                                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${student.timing_flag === 'Late' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                                                                                            {student.timing_flag} upload
                                                                                        </span>
                                                                                    )}
                                                                                    {student.attempts && student.attempts > 1 && (
                                                                                        <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-600">
                                                                                            {student.attempts} attempts
                                                                                        </span>
                                                                                    )}
                                                                                    {student.similar_to && student.similar_to.length > 0 && (
                                                                                        <span
                                                                                            className="inline-flex cursor-help items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-600"
                                                                                            title={`Near-identical answers with: ${student.similar_to.map((m) => `${m.student_name} (${m.percent}%)`).join(', ')}`}
                                                                                        >
                                                                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.5 15a4.5 4.5 0 10-9 0v1H3a1 1 0 100 2h14a1 1 0 100-2h-.5v-1zM4.5 16v-1H4v1a1 1 0 100 2h12a1 1 0 100-2v-1h-.5" /></svg>
                                                                                            Match {Math.round(student.similar_to[0].percent)}%
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${isSubmitted ? stColor : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                                            {isSubmitted ? (student.status || 'Submitted') : 'No submission'}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {trackerData.students.length === 0 && (
                                                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                                                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                                                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-slate-400">
                                                                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                                                </svg>
                                                            </div>
                                                            <h4 className="text-sm font-bold text-slate-600">No students enrolled</h4>
                                                            <p className="mt-1 max-w-xs text-xs text-slate-400">Enroll students in this subject to track their submissions.</p>
                                                        </div>
                                                    )}
                                                </>
                                            ) : null}
                                        </motion.div>
                                    )}

                                    {detailTab === 'upload' && (
                                        <motion.div
                                            key="upload-content"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                                            className="space-y-4"
                                        >
                                            <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-blue-600">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-blue-900">Teacher upload mode</p>
                                                    <p className="mt-0.5 text-xs text-blue-700">
                                                        This assessment is administered on paper. Upload each student's handwritten work below — students cannot upload their own files. After uploading, grade submissions as usual from <span className="font-semibold">View Submissions</span>.
                                                    </p>
                                                </div>
                                            </div>

                                            {(() => {
                                                const statusLower = String(selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || '').toLowerCase();
                                                const isLive = statusLower !== 'draft' && statusLower !== 'scheduled';
                                                if (isLive) return null;
                                                return (
                                                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-600">
                                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-amber-900">Not published yet</p>
                                                            <p className="mt-0.5 text-xs text-amber-700">Publish this assessment before uploading student submissions.</p>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {trackerLoading ? (
                                                <div className="flex items-center justify-center py-12">
                                                    <div className="relative">
                                                        <div className="h-8 w-8 rounded-full border-[3px] border-blue-200 border-t-blue-500 animate-spin" />
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                                        </div>
                                                    </div>
                                                    <span className="ml-3 text-sm font-medium text-slate-500">Loading students...</span>
                                                </div>
                                            ) : trackerError ? (
                                                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100">
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-rose-500">
                                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-rose-800">Error</p>
                                                        <p className="mt-0.5 text-xs text-rose-600">{trackerError}</p>
                                                    </div>
                                                </div>
                                            ) : trackerData ? (
                                                (() => {
                                                    const statusLower = String(selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || '').toLowerCase();
                                                    const isLive = statusLower !== 'draft' && statusLower !== 'scheduled';
                                                    return (
                                                        <>
                                                            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                                                    Students Aâ€“Z ({trackerData.students.length})
                                                                </p>
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                                                                    {trackerData.students.filter((s) => s.submitted).length} uploaded
                                                                </p>
                                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">
                                                                    {trackerData.students.filter((s) => !s.submitted).length} missing
                                                                </p>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {trackerData.students.map((student) => {
                                                                    const isSubmitted = Boolean(student.submitted);
                                                                    const isTeacherUpload = student.submitted_via === 'teacher_upload';
                                                                    const isGraded = String(student.status || '').toLowerCase() === 'graded';
                                                                    const stColor = String(student.status || '').toLowerCase() === 'graded'
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                        : String(student.status || '').toLowerCase() === 'needs review'
                                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                            : 'bg-amber-50 text-amber-700 border-amber-200';
                                                                    return (
                                                                        <div key={student.student_user_id} className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3 transition hover:shadow-sm ${isSubmitted ? 'border-emerald-200/60' : 'border-amber-200/60'}`}>
                                                                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${isSubmitted ? 'bg-gradient-to-br from-emerald-400 to-emerald-500' : 'bg-gradient-to-br from-amber-400 to-amber-500'}`}>
                                                                                {getStudentInitial(student)}
                                                                            </div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="truncate text-sm font-semibold text-slate-900">{student.student_name}</p>
                                                                                <p className="text-[11px] text-slate-400">ID {student.student_id} {student.date_uploaded && `· ${student.date_uploaded}`}</p>
                                                                                {isTeacherUpload && (
                                                                                    <span className="mt-1 inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-600">
                                                                                        Uploaded by teacher
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${isSubmitted ? stColor : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                                                {isSubmitted ? (student.status || 'Submitted') : 'Not uploaded'}
                                                                            </span>
                                                                            <div className="flex shrink-0 items-center gap-1.5">
                                                                                {!isSubmitted ? (
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={!isLive}
                                                                                        onClick={() => openUploadModal(student)}
                                                                                        className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                                                                                    >
                                                                                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                                                                                            <path d="M.5 9.5a.5.5 0 01.5.5v3a1 1 0 001 1h12a1 1 0 001-1v-3a.5.5 0 011 0v3a2 2 0 01-2 2H2a2 2 0 01-2-2v-3a.5.5 0 01.5-.5zM8 1.5a.5.5 0 01.5.5v7.793l2.146-2.147a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 01.708-.708L7.5 9.793V2a.5.5 0 01.5-.5z" />
                                                                                        </svg>
                                                                                        Upload
                                                                                    </button>
                                                                                ) : !isGraded ? (
                                                                                    <>
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={!isLive}
                                                                                            onClick={() => openUploadModal(student)}
                                                                                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                                                        >
                                                                                            Replace
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={!isLive}
                                                                                            onClick={() => setRemoveTarget(student)}
                                                                                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                                                                        >
                                                                                            Remove
                                                                                        </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="text-[10px] font-medium text-slate-400">Graded — reset to modify</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            {trackerData.students.length === 0 && (
                                                                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                                                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-slate-400">
                                                                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                                                        </svg>
                                                                    </div>
                                                                    <h4 className="text-sm font-bold text-slate-600">No students enrolled</h4>
                                                                    <p className="mt-1 max-w-xs text-xs text-slate-400">Enroll students in this subject to upload their submissions.</p>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()
                                            ) : null}
                                        </motion.div>
                                    )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-8 py-3">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    {!selectedAssessmentDetail.archived && (
                                        <button
                                            type="button"
                                            onClick={() => requestArchive(selectedAssessmentDetail, 'archive')}
                                            className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-600 transition-all duration-300 hover:-translate-y-0.5 hover:bg-indigo-100 active:scale-[0.97]"
                                        >
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V15l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                            </svg>
                                            Archive
                                        </button>
                                    )}
                                    {!selectedAssessmentDetail.archived && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(selectedAssessmentDetail.exercise_id)}
                                        className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-100 active:scale-[0.97]"
                                    >
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                        </svg>
                                        Delete
                                    </button>
                                    )}
                                    {!selectedAssessmentDetail.archived && ['draft', 'scheduled'].includes(String(selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || '').toLowerCase()) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAssessmentToPublish(selectedAssessmentDetail);
                                                setShowPublishConfirm(true);
                                            }}
                                            disabled={publishing}
                                            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] disabled:opacity-50"
                                        >
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                            </svg>
                                            {publishing ? 'Publishing...' : String(selectedAssessmentDetail.assessment_status || selectedAssessmentDetail.status || '').toLowerCase() === 'scheduled' ? 'Publish Now' : 'Publish'}
                                        </button>
                                    )}
                                    {selectedAssessmentDetail.archived ? (
                                        <button
                                            type="button"
                                            onClick={() => requestArchive(selectedAssessmentDetail, 'restore')}
                                            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
                                        >
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                                <path fillRule="evenodd" d="M4 10a6 6 0 019.33-5.06l.72.46A.75.75 0 0113.5 6.9l-1.5-1a.75.75 0 01.15-1.3l4-2.5a.75.75 0 011.1.63v6.25a.75.75 0 01-1.5 0V4.44L13.3 6.3a6.75 6.75 0 101.7 8.06.75.75 0 011.47.3A8.25 8.25 0 114 10z" clipRule="evenodd" />
                                            </svg>
                                            Restore
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowAssessmentDetail(false);
                                                navigate(`/teacher/assessments/edit/${selectedAssessmentDetail.exercise_id}`, {
                                                    state: { assessment: selectedAssessmentDetail },
                                                });
                                            }}
                                            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-100 active:scale-[0.97]"
                                        >
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                                            </svg>
                                            Edit
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAssessmentDetail(false);
                                            navigate('/teacher/grade-submissions', { state: { exerciseId: selectedAssessmentDetail.exercise_id } });
                                        }}
                                        className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-300/50 active:scale-[0.97]"
                                    >
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                            <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
                                        </svg>
                                        View Submissions
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {showUploadModal && uploadTarget &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
                        onClick={closeUploadModal}
                    >
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.35)]">
                            <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 px-6 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                                            <path d="M.5 9.5a.5.5 0 01.5.5v3a1 1 0 001 1h12a1 1 0 001-1v-3a.5.5 0 011 0v3a2 2 0 01-2 2H2a2 2 0 01-2-2v-3a.5.5 0 01.5-.5zM8 1.5a.5.5 0 01.5.5v7.793l2.146-2.147a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 01.708-.708L7.5 9.793V2a.5.5 0 01.5-.5z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">
                                            {uploadTarget.submitted ? 'Replace Submission' : 'Upload Submission'}
                                        </h3>
                                        <p className="text-sm text-blue-100">{uploadTarget.student_name} · ID {uploadTarget.student_id}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-5">
                                {uploadTarget.submitted && (
                                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                        <p className="text-xs font-semibold text-amber-800">
                                            This student already has a submission. Uploading new files will replace it, and any existing AI draft or manual scores will be discarded.
                                        </p>
                                    </div>
                                )}

                                <input
                                    ref={uploadInputRef}
                                    type="file"
                                    multiple
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    className="hidden"
                                    onChange={handleUploadFileSelect}
                                />
                                <div
                                    onClick={() => uploadInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const syntheticEvent = { target: { files: Array.from(e.dataTransfer.files || []) } };
                                        handleUploadFileSelect(syntheticEvent);
                                    }}
                                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 transition hover:border-blue-400 hover:bg-blue-50/30"
                                >
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="mb-2 h-8 w-8 text-slate-300">
                                        <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm0 5a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 5a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3z" />
                                    </svg>
                                    <p className="text-xs font-semibold text-slate-600">Click or drop photos of the student's work</p>
                                    <p className="mt-1 text-[10px] text-slate-400">JPG, JPEG, PNG, or PDF · up to 5 files · 10MB each</p>
                                </div>

                                {uploadFiles.length > 0 && (
                                    <div className="mt-3 space-y-1.5">
                                        {uploadFiles.map((file, index) => (
                                            <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{file.name}</span>
                                                <span className="shrink-0 text-[10px] text-slate-400">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setUploadFiles((prev) => prev.filter((_, i) => i !== index))}
                                                    className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                                    aria-label="Remove file"
                                                >
                                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={closeUploadModal}
                                    disabled={uploading}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 active:scale-[0.97] disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={submitTeacherUpload}
                                    disabled={uploading || uploadFiles.length === 0}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                                >
                                    {uploading ? (
                                        <>
                                            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                                <path d="M.5 9.5a.5.5 0 01.5.5v3a1 1 0 001 1h12a1 1 0 001-1v-3a.5.5 0 011 0v3a2 2 0 01-2 2H2a2 2 0 01-2-2v-3a.5.5 0 01.5-.5zM8 1.5a.5.5 0 01.5.5v7.793l2.146-2.147a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 01.708-.708L7.5 9.793V2a.5.5 0 01.5-.5z" />
                                            </svg>
                                            {uploadTarget.submitted ? 'Replace Files' : 'Upload Files'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {removeTarget &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
                        onClick={() => { if (!removing) setRemoveTarget(null); }}
                    >
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.35)]">
                            <div className="bg-gradient-to-br from-red-500 via-red-600 to-rose-600 px-6 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Remove Submission</h3>
                                        <p className="text-sm text-red-100">This cannot be undone</p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-5">
                                <p className="text-sm text-slate-700">
                                    Remove the submission for <span className="font-semibold text-slate-900">{removeTarget.student_name}</span>?
                                </p>
                                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-red-700">This will permanently remove:</p>
                                    <ul className="mt-2 space-y-1.5">
                                        <li className="flex items-start gap-2 text-xs text-red-600">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L10.586 10l-1.72 1.72a1 1 0 101.414 1.414L12 11.414l1.72 1.72a1 1 0 001.414-1.414L13.414 10l1.72-1.72a1 1 0 00-1.414-1.414L12 8.586l-1.72-1.72a1 1 0 00-1.414 1.414L10.586 10l-1.72 1.72a1 1 0 001.414 1.414L12 11.414l1.72 1.72a1 1 0 001.414-1.414L13.414 10l1.72-1.72a1 1 0 00-1.414-1.414L12 8.586l-1.72-1.72a1 1 0 00-1.414 1.414L10.586 10l-1.72 1.72a1 1 0 001.414 1.414L12 11.414l1.72 1.72a1 1 0 001.414-1.414L13.414 10z" clipRule="evenodd" />
                                            </svg>
                                            The uploaded photo files
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-red-600">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L10.586 10l-1.72 1.72a1 1 0 101.414 1.414L12 11.414l1.72 1.72a1 1 0 001.414-1.414L13.414 10l1.72-1.72a1 1 0 00-1.414-1.414L12 8.586l-1.72-1.72a1 1 0 00-1.414 1.414L10.586 10l-1.72 1.72a1 1 0 001.414 1.414L12 11.414l1.72 1.72a1 1 0 001.414-1.414L13.414 10z" clipRule="evenodd" />
                                            </svg>
                                            Any AI draft or saved scores for this submission
                                        </li>
                                    </ul>
                                </div>
                                <p className="mt-3 text-xs text-slate-400">If this grade has already been returned to the student, removal will be blocked — reset it first.</p>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={() => setRemoveTarget(null)}
                                    disabled={removing}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 active:scale-[0.97] disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmRemoveSubmission}
                                    disabled={removing}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {removing ? (
                                        <>
                                            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                            Removing...
                                        </>
                                    ) : (
                                        'Yes, Remove'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {showDeleteConfirm && assessmentToDelete &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
                        onClick={() => { setShowDeleteConfirm(false); setAssessmentToDelete(null); }}
                    >
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.35)]">
                            <div className="bg-gradient-to-br from-red-500 via-red-600 to-rose-600 px-6 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Delete Assessment</h3>
                                        <p className="text-sm text-red-100">This action cannot be undone</p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-5">
                                <p className="text-sm text-slate-700">
                                    Are you sure you want to delete <span className="font-semibold text-slate-900">"{assessmentToDelete.title}"</span>?
                                </p>

                                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-red-700">Warning: This will permanently remove:</p>
                                    <ul className="mt-2 space-y-1.5">
                                        <li className="flex items-start gap-2 text-xs text-red-600">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                            </svg>
                                            All questions and items in this assessment
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-red-600">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                            </svg>
                                            All student submissions and captured solutions
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-red-600">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                            </svg>
                                            All scores and grading results
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-red-600">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                            </svg>
                                            Subject associations for this assessment
                                        </li>
                                    </ul>
                                </div>

                                <p className="mt-4 text-xs text-slate-400">Type the assessment name or proceed carefully.</p>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowDeleteConfirm(false); setAssessmentToDelete(null); }}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 active:scale-[0.97]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDelete}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
                                >
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                    </svg>
                                    Yes, Delete
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {archiveRequest &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
                        onClick={() => setArchiveRequest(null)}
                    >
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.35)]">
                            <div className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 px-6 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                                            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V15l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">
                                            {archiveRequest.mode === 'archive' ? 'Archive Assessment' : 'Restore Assessment'}
                                        </h3>
                                        <p className="text-sm text-indigo-100">
                                            {archiveRequest.mode === 'archive'
                                                ? 'Move it out of your active workflow'
                                                : 'Bring it back to your active workflow'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-5">
                                <p className="text-sm text-slate-700">
                                    {archiveRequest.count > 1 ? (
                                        <>Archive <span className="font-semibold text-slate-900">{archiveRequest.count} assessments</span> from past school years?</>
                                    ) : (
                                        <>
                                            {archiveRequest.mode === 'archive' ? 'Archive' : 'Restore'}{' '}
                                            <span className="font-semibold text-slate-900">"{archiveRequest.title}"</span>?
                                        </>
                                    )}
                                </p>

                                {archiveRequest.years?.length > 0 && (
                                    <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1">
                                        {archiveRequest.years.map((year) => (
                                            <div key={year.label} className="flex items-center justify-between py-2 text-xs">
                                                <span className="font-semibold text-slate-700">{year.label}</span>
                                                <span className="text-slate-500">
                                                    {year.count} {year.count === 1 ? 'assessment' : 'assessments'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className={`mt-4 rounded-xl border p-4 ${archiveRequest.mode === 'archive' ? 'border-indigo-200 bg-indigo-50' : 'border-emerald-200 bg-emerald-50'}`}>
                                    <p className={`text-xs font-semibold uppercase tracking-wider ${archiveRequest.mode === 'archive' ? 'text-indigo-700' : 'text-emerald-700'}`}>
                                        {archiveRequest.mode === 'archive' ? 'This will:' : 'This will:'}
                                    </p>
                                    <ul className="mt-2 space-y-1.5">
                                        {(archiveRequest.mode === 'archive'
                                            ? [
                                                'Hide it from your active assessment list',
                                                'Hide it from the student dashboard',
                                                'Keep every question, submission and score stored',
                                            ]
                                            : [
                                                'Move it back to your active list',
                                                'Make it visible to enrolled students again',
                                                'Keep all existing student answers and scores',
                                            ]
                                        ).map((line) => (
                                            <li key={line} className="flex items-start gap-2 text-xs text-slate-600">
                                                <svg viewBox="0 0 20 20" fill="currentColor" className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${archiveRequest.mode === 'archive' ? 'text-indigo-500' : 'text-emerald-500'}`}>
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                </svg>
                                                {line}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <p className="mt-4 text-xs text-slate-400">
                                    {archiveRequest.mode === 'archive'
                                        ? 'Nothing is deleted - you can restore it at any time from the Archived tab.'
                                        : 'You can archive it again at any time.'}
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={() => setArchiveRequest(null)}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 active:scale-[0.97]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmArchive}
                                    disabled={archiving}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] disabled:opacity-50"
                                >
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V15l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                    </svg>
                                    {archiving
                                        ? 'Working...'
                                        : archiveRequest.mode === 'archive'
                                            ? (archiveRequest.count > 1 ? `Yes, Archive ${archiveRequest.count}` : 'Yes, Archive')
                                            : 'Yes, Restore'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {showPublishConfirm && assessmentToPublish &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
                        onClick={() => { setShowPublishConfirm(false); setAssessmentToPublish(null); }}
                    >
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-12px_rgba(15,23,42,0.35)]">
                            <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-6 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
                                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Publish Assessment</h3>
                                        <p className="text-sm text-emerald-100">
                                            {publishTargetIsScheduled
                                                ? 'Publish this scheduled assessment right away'
                                                : 'Make this assessment available to students'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-5">
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Are you sure you want to publish <span className="font-semibold text-slate-900">"{assessmentToPublish.title}"</span>
                                    {publishTargetIsScheduled && publishTargetScheduleLabel ? ' now?' : '?'}
                                </p>
                                <p className="mt-2 text-xs text-slate-500">
                                    {publishTargetIsScheduled && publishTargetScheduleLabel
                                        ? `It is scheduled for ${publishTargetScheduleLabel}. Publishing now makes it visible to students immediately.`
                                        : 'Once published, students enrolled in the selected subjects will be able to view and attempt this assessment.'}
                                </p>

                                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">This will:</p>
                                    <ul className="mt-2 space-y-1.5">
                                        <li className="flex items-start gap-2 text-xs text-emerald-600">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500">
                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                            </svg>
                                            {publishTargetIsScheduled
                                                ? 'Change status from Scheduled to Active (skips the schedule)'
                                                : 'Change status from Draft to Active'}
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-emerald-600">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500">
                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                            </svg>
                                            Make it visible to enrolled students
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-emerald-600">
                                            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500">
                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                            </svg>
                                            Allow students to start submitting answers
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowPublishConfirm(false); setAssessmentToPublish(null); }}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 active:scale-[0.97]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPublishConfirm(false);
                                        handlePublish(assessmentToPublish.exercise_id, publishTargetIsScheduled);
                                        setAssessmentToPublish(null);
                                    }}
                                    disabled={publishing}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] disabled:opacity-50"
                                >
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                    </svg>
                                    {publishing ? 'Publishing...' : publishTargetIsScheduled ? 'Yes, Publish Now' : 'Yes, Publish'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default ManageAssessments;
