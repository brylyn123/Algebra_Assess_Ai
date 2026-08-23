import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';
import { apiFetch } from './fetchClient';
import Select from './components/Select';
import { useToast } from './components/Toast';

const analyzeImageQuality = (file) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ pass: true, note: 'PDF quality verified after upload' });
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      try {
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        const gray = new Float32Array(size * size);

        for (let i = 0; i < gray.length; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        }

        const reasons = [];

        let blurSum = 0;
        let blurCount = 0;
        for (let y = 1; y < size - 1; y++) {
          for (let x = 1; x < size - 1; x++) {
            const idx = y * size + x;
            const laplacian = -4 * gray[idx]
              + gray[idx - 1] + gray[idx + 1]
              + gray[idx - size] + gray[idx + size];
            blurSum += laplacian * laplacian;
            blurCount++;
          }
        }
        const blurVariance = blurCount > 0 ? blurSum / blurCount : 0;
        if (blurVariance < 50) {
          reasons.push('Image may be blurry');
        }

        let brightnessSum = 0;
        for (let i = 0; i < gray.length; i++) {
          brightnessSum += gray[i];
        }
        const brightness = brightnessSum / gray.length;
        if (brightness < 30) {
          reasons.push('Image is too dark');
        } else if (brightness > 225) {
          reasons.push('Image is too bright');
        }

        let contrastSum = 0;
        for (let i = 0; i < gray.length; i++) {
          contrastSum += (gray[i] - brightness) * (gray[i] - brightness);
        }
        const contrast = Math.sqrt(contrastSum / gray.length);
        if (contrast < 20) {
          reasons.push('Image has low contrast');
        }

        resolve({ pass: reasons.length === 0, reasons });
      } catch {
        resolve({ pass: true, reasons: [] });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ pass: true, reasons: [] });
    };

    img.src = url;
  });
};

const formatDateTime = (value) => {
  if (!value) return 'Not submitted yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const SubmitAssessment = () => {
  const { enrolledSubjects = [], loadingSubjects = false, subjectsError = '' } = useOutletContext() ?? {};
  const currentEmail = getCurrentLocalUserEmail();
  const currentUser = currentEmail ? findLocalUser(currentEmail) : null;
  const studentId = currentUser?.user_id ?? currentUser?.student_id ?? null;
  const { toast } = useToast();

  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [availableAssessments, setAvailableAssessments] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [assessmentsError, setAssessmentsError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [fileQualityResults, setFileQualityResults] = useState(new Map());

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchAssessments = async () => {
      if (!studentId) {
        if (isMounted) {
          setAvailableAssessments([]);
          setAssessmentsError('');
          setLoadingAssessments(false);
        }
        return;
      }

      setLoadingAssessments(true);
      setAssessmentsError('');

      try {
        const response = await fetch(`${API_BASE_URL}/get_student_assessments.php?student_id=${studentId}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        const payload = await response.json();
        if (payload.status !== 'success') {
          throw new Error(payload.message || 'Unable to load assessments.');
        }

        if (!isMounted) return;
        setAvailableAssessments(Array.isArray(payload.assessments) ? payload.assessments : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isMounted) {
          setAssessmentsError(error.message || 'Unable to load assessments.');
          setAvailableAssessments([]);
        }
      } finally {
        if (isMounted) {
          setLoadingAssessments(false);
        }
      }
    };

    fetchAssessments();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [studentId]);

  const subjectOptions = useMemo(() => {
    const fromContext = enrolledSubjects.map((subject) => ({
      value: String(subject.subject_id),
      label: subject.subject_name,
    }));

    if (fromContext.length > 0) {
      return [{ value: 'all', label: 'All enrolled subjects' }, ...fromContext];
    }

    const fallbackMap = new Map();
    availableAssessments.forEach((assessment) => {
      const key = String(assessment.subject_id ?? '');
      if (key && !fallbackMap.has(key)) {
        fallbackMap.set(key, assessment.subject_name ?? 'Untitled Subject');
      }
    });

    return [
      { value: 'all', label: 'All enrolled subjects' },
      ...Array.from(fallbackMap.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [availableAssessments, enrolledSubjects]);

  const filteredAssessments = useMemo(() => {
    if (selectedSubject === 'all') {
      return availableAssessments;
    }

    return availableAssessments.filter(
      (assessment) => String(assessment.subject_id ?? '') === selectedSubject
    );
  }, [availableAssessments, selectedSubject]);

  useEffect(() => {
    if (filteredAssessments.length === 0) {
      setSelectedAssessmentId('');
      return;
    }

    setSelectedAssessmentId((current) => {
      const stillExists = filteredAssessments.some(
        (assessment) => String(assessment.exercise_id) === String(current)
      );
      return stillExists ? current : String(filteredAssessments[0].exercise_id);
    });
  }, [filteredAssessments]);

  const selectedAssessment = useMemo(
    () =>
      filteredAssessments.find(
        (assessment) => String(assessment.exercise_id) === String(selectedAssessmentId)
      ) ?? null,
    [filteredAssessments, selectedAssessmentId]
  );

  const fileLabel = useMemo(() => {
    if (selectedFiles.length === 0) return 'Drop files here or click to browse';
    return `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} ready to upload`;
  }, [selectedFiles.length]);

  const hasFailingImages = useMemo(() => {
    for (const [, result] of fileQualityResults) {
      if (result && result.pass === false) return true;
    }
    return false;
  }, [fileQualityResults]);

  const handleFiles = async (event) => {
    const fileList = Array.from(event.target.files || []);
    if (fileList.length === 0) return;

    const startIndex = selectedFiles.length;
    setSelectedFiles((current) => [...current, ...fileList]);

    const checks = fileList.map(async (file, i) => {
      const fileIndex = startIndex + i;
      const qualityResult = await analyzeImageQuality(file);
      setFileQualityResults((prev) => {
        const next = new Map(prev);
        next.set(fileIndex, qualityResult);
        return next;
      });
      if (!qualityResult.pass) {
        const reasons = qualityResult.reasons?.join(', ') || 'Image quality is poor';
        toast.warning(`${file.name}: ${reasons}. Please retake with better lighting.`);
      }
    });

    await Promise.all(checks);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    const fileList = Array.from(event.dataTransfer.files || []);
    if (fileList.length === 0) return;

    const startIndex = selectedFiles.length;
    setSelectedFiles((current) => [...current, ...fileList]);

    const checks = fileList.map(async (file, i) => {
      const fileIndex = startIndex + i;
      const qualityResult = await analyzeImageQuality(file);
      setFileQualityResults((prev) => {
        const next = new Map(prev);
        next.set(fileIndex, qualityResult);
        return next;
      });
      if (!qualityResult.pass) {
        const reasons = qualityResult.reasons?.join(', ') || 'Image quality is poor';
        toast.warning(`${file.name}: ${reasons}. Please retake with better lighting.`);
      }
    });

    await Promise.all(checks);
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setFileQualityResults(new Map());
    setSubmitMessage('');
  };

  const preventDefault = (event) => event.preventDefault();

  const handleSubmit = async () => {
    if (!studentId) {
      setSubmitMessage('Please log in as a student to submit work.');
      toast.warning('Please log in as a student to submit work.');
      return;
    }

    if (!selectedAssessment) {
      setSubmitMessage('Choose an assessment first.');
      toast.warning('Choose an assessment first.');
      return;
    }

    if (selectedFiles.length === 0) {
      setSubmitMessage('Upload at least one file before submitting.');
      toast.warning('Upload at least one file before submitting.');
      return;
    }

    if (hasFailingImages) {
      setSubmitMessage('Some files failed quality checks. Please remove or replace them before submitting.');
      toast.error('Some images are blurry or too dark. Please replace them before submitting.');
      return;
    }

    setSubmitLoading(true);
    setSubmitMessage('');

    try {
      const formData = new FormData();
      formData.append('student_id', String(studentId));
      formData.append('exercise_id', String(selectedAssessment.exercise_id));
      selectedFiles.forEach((file) => {
        formData.append('files[]', file);
      });

      const response = await apiFetch('/submit_assessment.php', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();

      if (payload.status !== 'success') {
        if (payload.file_errors && Array.isArray(payload.file_errors)) {
          const errMsgs = payload.file_errors.map((e) => `${e.file}: ${e.reason}`).join('; ');
          throw new Error(errMsgs || payload.message || 'Unable to submit assessment.');
        }
        throw new Error(payload.message || 'Unable to submit assessment.');
      }

      let message = 'Assessment submitted successfully. Your teacher can now see it in Grade Submissions.';
      if (payload.warnings && payload.warnings.length > 0) {
        const warningMsgs = payload.warnings.map((w) => `${w.file}: ${w.reason}`).join('; ');
        message += ` Some files were removed: ${warningMsgs}`;
        toast.warning(message);
      } else {
        toast.success('Assessment submitted successfully! Your teacher can now grade it.');
      }

      setSubmitMessage(message);
      setSelectedFiles([]);
      setFileQualityResults(new Map());

      setAvailableAssessments((current) =>
        current.map((assessment) =>
          assessment.exercise_id === selectedAssessment.exercise_id
            ? {
              ...assessment,
              already_submitted: true,
              latest_submission_at: new Date().toISOString(),
            }
            : assessment
        )
      );
    } catch (error) {
      const errMsg = error.message || 'Unable to submit assessment.';
      setSubmitMessage(errMsg);
      try { toast?.error(errMsg); } catch (_) {}
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-full w-full flex-col px-1 pt-3 sm:px-2 overflow-y-auto teacher-scrollbar">
      <div className="shrink-0 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-4 py-3 mb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 01-.682 0h-.002z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">Submit Assessment</h2>
            </div>
            <p className="text-xs text-blue-100 ml-[42px]">
              Upload your handwritten solutions for AI-powered grading and teacher review.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#94a3b8 transparent' }}>
        <style>{`
          .submit-scroll::-webkit-scrollbar { width: 7px; }
          .submit-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 9999px; }
          .submit-scroll::-webkit-scrollbar-thumb { background-color: #94a3b8; border-radius: 9999px; }
          .submit-scroll::-webkit-scrollbar-thumb:hover { background-color: #64748b; }
        `}</style>
        <div className="submit-scroll grid gap-4 lg:grid-cols-[0.95fr,1.05fr] pb-4">
          <section className="rounded-lg border border-slate-200/60 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400 mb-3">Choose Assessment</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Subject</label>
                <Select
                  value={selectedSubject}
                  onChange={(event) => setSelectedSubject(event.target.value)}
                  placeholder="Select a subject"
                >
                  {subjectOptions.map((subject) => (
                    <option key={subject.value} value={subject.value}>
                      {subject.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Assessment</label>
                <Select
                  value={selectedAssessmentId}
                  onChange={(event) => setSelectedAssessmentId(event.target.value)}
                  disabled={filteredAssessments.length === 0}
                  placeholder={filteredAssessments.length === 0 ? 'No assessments available' : 'Select an assessment'}
                >
                  {filteredAssessments.map((assessment) => (
                    <option key={assessment.exercise_id} value={assessment.exercise_id}>
                      {assessment.title}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-sm">
                {loadingSubjects || loadingAssessments ? (
                  <p className="text-slate-500">Loading your enrolled subjects and assessments...</p>
                ) : subjectsError ? (
                  <p className="text-red-600">{subjectsError}</p>
                ) : assessmentsError ? (
                  <p className="text-red-600">{assessmentsError}</p>
                ) : selectedAssessment ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Assessment</p>
                        <p className="text-sm font-semibold text-slate-700">{selectedAssessment.title}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Subject</p>
                        <p className="text-sm font-semibold text-slate-700">{selectedAssessment.subject_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Topic</p>
                        <p className="text-sm font-semibold text-slate-700">{selectedAssessment.topic || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Items</p>
                        <p className="text-sm font-semibold text-slate-700">{selectedAssessment.item_count || 0}</p>
                      </div>
                      {selectedAssessment.due_date && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Due Date</p>
                          <p className="text-sm font-semibold text-slate-700">{new Date(selectedAssessment.due_date).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      )}
                    </div>
                    {selectedAssessment.description && (
                      <p className="text-xs text-slate-500">{selectedAssessment.description}</p>
                    )}
                    {selectedAssessment.items && selectedAssessment.items.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Questions</p>
                        {selectedAssessment.items.map((item, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                  #{item.item_no}
                                </span>
                                {item.question_type && (
                                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                    {item.question_type.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-700 whitespace-pre-wrap">{item.question_content}</p>
                            </div>
                            <span className="shrink-0 text-[10px] font-semibold text-slate-500">{item.max_score} pts</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                      {selectedAssessment.difficulty && <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium">Difficulty: {selectedAssessment.difficulty}</span>}
                      {selectedAssessment.subject_meta && <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium">{selectedAssessment.subject_meta}</span>}
                      {selectedAssessment.due_date && (() => {
                        const now = new Date();
                        const due = new Date(selectedAssessment.due_date);
                        if (Number.isNaN(due.getTime())) return null;
                        const diffMs = due.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                        let cls = 'text-blue-600';
                        let label = `Due in ${diffDays} day(s)`;
                        if (diffDays < 0) { cls = 'text-red-600 font-semibold'; label = 'Overdue'; }
                        else if (diffDays === 0) { cls = 'text-amber-600 font-semibold'; label = 'Due today'; }
                        else if (diffDays <= 3) { cls = 'text-orange-600 font-semibold'; }
                        return <span className={`inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium ${cls}`}>{label}</span>;
                      })()}
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium">
                        {selectedAssessment.already_submitted
                          ? `Last submitted: ${formatDateTime(selectedAssessment.latest_submission_at)}`
                          : 'Not submitted yet'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">No assessment is available for the selected subject yet.</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200/60 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400 mb-3">Upload Handwritten Solutions</p>
            <p className="text-xs text-slate-500 mb-2">
              Upload clear photos of your handwritten solutions for the best OCR and AI grading results. Each file can be up to 10MB.
            </p>
            <p className="text-[10px] text-amber-600 font-semibold mb-3">
              Best results: JPG or PNG photos. PDF uploads are allowed, but automatic text extraction may be less reliable.
            </p>

            <label
              onDragOver={preventDefault}
              onDragEnter={preventDefault}
              onDragLeave={preventDefault}
              onDrop={handleDrop}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center transition hover:border-blue-400 hover:bg-blue-50/50"
            >
              <input onChange={handleFiles} type="file" multiple accept=".jpg,.jpeg,.png,.pdf" className="hidden" />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-blue-400">
                  <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 01-.682 0h-.002z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">{fileLabel}</p>
              <p className="text-[10px] text-slate-400">Supported formats: JPG, JPEG, PNG, PDF</p>
              <span className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-200/60 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]">
                Choose Files
              </span>
            </label>

            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {selectedFiles.map((file, index) => {
                  const quality = fileQualityResults.get(index);
                  return (
                    <div key={`${file.name}-${index}`} className="flex flex-col rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-xs font-medium text-slate-700">{file.name}</span>
                        <span className="shrink-0 ml-2 text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                      {quality?.pass === false && (
                        <span className="text-red-500 text-[10px] mt-0.5">
                          ⚠️ {quality.reasons?.join(', ') || quality.reason || 'Quality issue detected'}
                        </span>
                      )}
                      {quality?.pass === true && !quality.note && (
                        <span className="text-emerald-500 text-[10px] mt-0.5">✅ Clear</span>
                      )}
                      {quality?.note && (
                        <span className="text-slate-400 text-[10px] mt-0.5">{quality.note}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {submitMessage && (
              <div className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${submitMessage.includes('successfully') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                {submitMessage}
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white/80 px-4 py-3">
          <button
            type="button"
            onClick={clearFiles}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Clear Files
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-200/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-300/50 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
            disabled={submitLoading || selectedFiles.length === 0 || !selectedAssessment || hasFailingImages}
          >
            {submitLoading ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 01-.682 0h-.002z" />
                </svg>
                <span>Submit Assessment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmitAssessment;
