import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { findLocalUser, getCurrentLocalUserEmail } from './localAuthStore';
import { API_BASE_URL } from './apiBase';
import Select from './components/Select';
import MathText from './MathText';

const toAbsoluteFileUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = String(path).replace(/^\/+/, '');
  return `${API_BASE_URL}/${normalizedPath}`;
};

const normalizeSubmissionFiles = (submission) => {
  if (!Array.isArray(submission?.files)) {
    return [];
  }
  return submission.files
    .map((file, index) => {
      const path = file?.path ?? '';
      const name = file?.name ?? `File ${index + 1}`;
      const extension = String(name).split('.').pop()?.toLowerCase() ?? '';
      const type = file?.type ?? (extension === 'pdf' ? 'pdf' : 'image');
      return {
        id: `${submission.score_id ?? submission.id}-${index}-${name}`,
        name,
        path,
        url: toAbsoluteFileUrl(path),
        type,
      };
    })
    .filter((file) => file.path && file.url);
};

const formatOcrText = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const trimmed = line.trim();
    const labelMatch = trimmed.match(/^(Question|Item|Problem|Part|Q|P|No\.?|Number)\s*(\d+[\.:)]?)\s*(.*)/i);
    if (labelMatch) {
      return (
        <div key={i} className="mt-2 first:mt-0">
          <span className="font-bold text-slate-900">{labelMatch[1]} {labelMatch[2]}</span>
          {labelMatch[3] && <span className="text-slate-700"> <MathText text={labelMatch[3]} /></span>}
        </div>
      );
    }
    const numberedMatch = trimmed.match(/^(\d+[\.:)]?)\s+(.*)/);
    if (numberedMatch && numberedMatch[2]) {
      return (
        <div key={i} className="mt-1.5 first:mt-0">
          <span className="font-semibold text-slate-800">{numberedMatch[1]}</span>
          <span className="text-slate-700"> <MathText text={numberedMatch[2]} /></span>
        </div>
      );
    }
    if (trimmed === '') {
      return <div key={i} className="h-2" />;
    }
    return <div key={i} className="text-slate-700"><MathText text={line} /></div>;
  });
};

const TeacherFeedback = () => {
  const currentEmail = getCurrentLocalUserEmail();
  const storedTeacher = currentEmail ? findLocalUser(currentEmail) : null;
  const teacherId = storedTeacher?.user_id ?? storedTeacher?.teacher_id ?? storedTeacher?.id ?? null;

  const [records, setRecords] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const assessmentOptions = useMemo(() => {
    const grouped = new Map();

    records.forEach((record) => {
      const key = String(record.exercise_id ?? record.assessment_title ?? '');
      if (!key) return;
      if (!grouped.has(key)) {
        grouped.set(key, {
          value: key,
          label: record.assessment_title || 'Untitled Assessment',
          subject: record.subject_name || 'Assessment',
          count: 0,
        });
      }

      grouped.get(key).count += 1;
    });

    return Array.from(grouped.values());
  }, [records]);

  const compactAssessmentLabel = (subject, label) => {
    const subjectText = String(subject || '').trim();
    const labelText = String(label || '').trim();
    if (!subjectText) return labelText;
    const repeatedPrefix = `${subjectText} - ${subjectText} - `;
    if (labelText.startsWith(repeatedPrefix)) {
      return `${subjectText} - ${labelText.slice(repeatedPrefix.length)}`;
    }
    return `${subjectText} - ${labelText}`;
  };

  const filteredRecords = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return records.filter((record) => {
      if (String(record.exercise_id ?? record.assessment_title ?? '') !== selectedAssessment) return false;
      if (q && !String(record.student_name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, selectedAssessment, studentSearch]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadFeedback = async () => {
      if (!teacherId) {
        if (isMounted) {
          setLoading(false);
          setRecords([]);
          setErrorMessage('Log in as a teacher to view graded submissions.');
        }
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams({ teacher_id: String(teacherId) });

        const response = await fetch(`${API_BASE_URL}/get_teacher_feedback.php?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'Unable to load graded submissions.');
        }

        if (!isMounted) return;

        const nextRecords = Array.isArray(payload.records) ? payload.records : [];
        setRecords(nextRecords);
        setSelectedRecord((current) => nextRecords.find((record) => record.score_id === current?.score_id) || nextRecords[0] || null);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        if (isMounted) {
          setRecords([]);
          setSelectedRecord(null);
          setErrorMessage(error.message || 'Unable to load graded submissions.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadFeedback();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [teacherId]);

  useEffect(() => {
    if (assessmentOptions.length === 0) {
      setSelectedAssessment('');
      return;
    }

    setSelectedAssessment((current) => {
      const stillValid = assessmentOptions.some((assessment) => assessment.value === current);
      return stillValid ? current : assessmentOptions[0].value;
    });
  }, [assessmentOptions]);

  useEffect(() => {
    if (filteredRecords.length === 0) {
      setSelectedRecord(null);
      setDetailsModalOpen(false);
      return;
    }

    setSelectedRecord((current) => {
      const stillVisible = filteredRecords.find((record) => record.score_id === current?.score_id);
      return stillVisible || filteredRecords[0];
    });
  }, [filteredRecords]);

  const openDetailsModal = (record) => {
    setSelectedRecord(record);
    setSelectedFileIndex(0);
    setDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setDetailsModalOpen(false);
    setIsPreviewOpen(false);
  };

  const totalMaxScore = useMemo(() => {
    if (!selectedRecord?.criteria_scores?.length) return 100;
    return selectedRecord.criteria_scores.reduce((sum, c) => sum + (c.weight || 0), 0) || 100;
  }, [selectedRecord]);

  return (
    <div className="h-full min-h-0 overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto flex h-full min-h-0 w-full flex-col gap-2 pb-2">
        <div className="shrink-0 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-4 py-3 mb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M7 8a3 3 0 100 6 3 3 0 000-6zM2 8a5 5 0 1110 0 5 5 0 01-10 0zm10-2a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-white">Results & Feedback</h2>
              </div>
              <p className="text-xs text-blue-100 ml-[42px]">Review every submission that already has a saved grade and teacher feedback.</p>
            </div>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
              {loading ? 'Loading...' : `${filteredRecords.length} graded submissions`}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Select
                value={selectedAssessment}
                onChange={(event) => { setSelectedAssessment(event.target.value); setStudentSearch(''); }}
                placeholder="All assessments"
              >
                {assessmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {compactAssessmentLabel(option.subject, option.label)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search student name..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-700 placeholder:text-slate-400 transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => setStudentSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <span className="shrink-0 flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2.5 text-[11px] font-medium text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              {filteredRecords.length}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-900">Students</p>
              {selectedRecord && (
                <span className="teacher-status-pill bg-blue-50 text-blue-700 text-[10px]">
                  Selected
                </span>
              )}
            </div>
            {errorMessage && <p className="mb-2 text-xs text-red-600">{errorMessage}</p>}

            <div className="teacher-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-3 pb-2 max-h-[calc(100vh-280px)] md:max-h-[calc(100vh-260px)]">
              {!loading && filteredRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  {studentSearch ? 'No students match your search.' : 'No graded submissions yet. Save a result from Grade Submissions first.'}
                </div>
              ) : (
                filteredRecords.map((record) => {
                  const isActive = selectedRecord?.score_id === record.score_id;
                  return (
                    <button
                      key={record.score_id}
                      type="button"
                      onClick={() => openDetailsModal(record)}
                      className={`relative w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                        isActive
                          ? 'border-blue-300 bg-blue-50/80 shadow-md ring-2 ring-blue-200'
                          : 'hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900">{record.student_name}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{record.submission_date}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="truncate">{record.subject_name}</span>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                          {record.score}%
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {detailsModalOpen && selectedRecord && typeof document !== 'undefined' && createPortal((
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md">
          <div className="mx-auto flex max-h-[88vh] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] ring-1 ring-white/70">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Student Review</p>
                <h2 className="text-lg font-semibold text-slate-900">{selectedRecord.student_name}</h2>
                <p className="text-xs text-slate-500">{selectedRecord.assessment_title}</p>
              </div>
              <button
                type="button"
                onClick={closeDetailsModal}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="teacher-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="rounded-2xl bg-blue-50 p-4">
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student</p>
                    <p className="font-semibold text-slate-900">{selectedRecord.student_name}</p>
                    <p className="text-xs text-slate-500">Assessment: {selectedRecord.assessment_title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Student ID</p>
                    <p className="font-semibold text-slate-900">{selectedRecord.student_id || 'Unavailable'}</p>
                    <p className="text-xs text-slate-500">Submitted: {selectedRecord.submission_date || 'Unavailable'}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Saved Grade</p>
                  <p className="mt-1 text-3xl font-black text-blue-700">
                    {selectedRecord.score !== null && selectedRecord.score !== undefined ? `${selectedRecord.score}%` : 'N/A'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Subject</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedRecord.subject_name || 'No subject'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Scored At</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedRecord.date_scored ? new Date(selectedRecord.date_scored).toLocaleString() : 'Recently saved'}
                  </p>
                </div>
              </div>

              {Array.isArray(selectedRecord.criteria_scores) && selectedRecord.criteria_scores.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-3">Criteria Breakdown</p>
                  <div className="space-y-3">
                    {selectedRecord.criteria_scores.map((criterion, idx) => {
                      const pct = criterion.weight > 0 ? Math.round((criterion.earned / criterion.weight) * 100) : 0;
                      const equivMax = (criterion.weight / 100) * totalMaxScore;
                      const equivEarned = (criterion.earned / 100) * totalMaxScore;
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700">{criterion.name}</span>
                            <span className="text-xs font-bold text-blue-600">{equivEarned.toFixed(1)} / {equivMax.toFixed(1)} pts ({pct}%)</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                          {criterion.explanation && (
                            <p className="text-[11px] leading-relaxed text-slate-500">{criterion.explanation}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.35em] text-blue-400">Generated Result</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                    Saved result
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Feedback</p>
                  <div className="teacher-scrollbar mt-3 max-h-64 overflow-y-auto pr-2">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {selectedRecord.ai_feedback || 'No saved feedback for this submission.'}
                    </p>
                  </div>
                </div>
              </div>

              {(() => {
                const submissionFiles = normalizeSubmissionFiles(selectedRecord);
                const activeFile = submissionFiles[selectedFileIndex] ?? submissionFiles[0] ?? null;
                return submissionFiles.length > 0 || selectedRecord.ocr_text ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 0 0 1.5-1.5V4.5a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v15a1.5 1.5 0 0 0 1.5 1.5Z" />
                      </svg>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Submitted Work & Extracted Text</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        {submissionFiles.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                            <p className="text-sm text-slate-400">No files uploaded</p>
                          </div>
                        ) : (
                            <div className="space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              {submissionFiles.map((file, index) => {
                                const isActive = activeFile?.id === file.id;
                                return (
                                  <button
                                    key={file.id}
                                    type="button"
                                    onClick={() => setSelectedFileIndex(index)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                      isActive
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {submissionFiles.length > 1 ? `Page ${index + 1}` : 'View File'}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsPreviewOpen(true)}
                              className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-blue-300 hover:shadow-sm"
                            >
                              {activeFile?.type === 'pdf' ? (
                                <div className="flex h-64 items-center justify-center bg-slate-50">
                                  <div className="text-center">
                                    <svg className="mx-auto h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                    </svg>
                                    <p className="mt-1 text-xs font-medium text-slate-500">PDF - Click to preview</p>
                                  </div>
                                </div>
                              ) : (
                                <img
                                  src={activeFile?.url}
                                  alt={`Submission ${selectedFileIndex + 1}`}
                                  className="h-64 w-full object-contain bg-slate-50"
                                />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        {selectedRecord.ocr_text ? (
                          <div className="h-full">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Extracted Solution</p>
                            <div
                              className="max-h-72 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm leading-relaxed"
                              style={{ scrollbarWidth: 'thin' }}
                            >
                              <p className="mb-2 text-[10px] text-slate-400 italic">Extracted text may contain errors.</p>
                              {formatOcrText(selectedRecord.ocr_text)}
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-8">
                            <p className="text-sm text-slate-400">No extracted text available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Item Explanations */}
              {Array.isArray(selectedRecord.item_scores) && selectedRecord.item_scores.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-3">Item Explanations</p>
                  <div className="space-y-3">
                    {selectedRecord.item_scores.map((item) => (
                      <div
                        key={item.item_score_id ?? item.item_no}
                        className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                              Item {item.item_no}
                            </p>
                            <p className="mt-0.5 text-sm font-medium text-slate-700">
                              <MathText text={item.question_content} />
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {item.score_earned != null
                              ? `${Number(item.score_earned).toFixed(1)} / ${Number(item.max_score || 0).toFixed(1)}`
                              : '—'}
                          </span>
                        </div>
                        {item.ai_feedback && (
                          <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-500 mb-1">
                              AI Explanation
                            </p>
                            <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                              {item.ai_feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ), document.body)}

      {isPreviewOpen && selectedRecord && typeof document !== 'undefined' && createPortal((() => {
        const previewFiles = normalizeSubmissionFiles(selectedRecord);
        const previewFile = previewFiles[selectedFileIndex] ?? previewFiles[0] ?? null;
        if (!previewFile) return null;
        return (
          <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
            <div className="relative flex h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-xl bg-white shadow-[0_40px_120px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 0 0 1.5-1.5V4.5a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v15a1.5 1.5 0 0 0 1.5 1.5Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{previewFile.name}</p>
                    <p className="text-xs text-slate-500">
                      {selectedRecord.student_name} &middot; {selectedRecord.assessment_title}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {previewFiles.length > 1 && (
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                      {selectedFileIndex + 1} / {previewFiles.length}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {previewFiles.length > 1 && (
                <div className="flex gap-1.5 border-b border-slate-100 px-6 py-2.5">
                  {previewFiles.map((file, index) => {
                    const isActive = previewFile.id === file.id;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setSelectedFileIndex(index)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        Page {index + 1}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-hidden bg-slate-100 p-4">
                <div className="relative flex h-full items-center justify-center">
                  {previewFiles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedFileIndex((current) => (current - 1 + previewFiles.length) % previewFiles.length)}
                      className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-lg transition hover:bg-white hover:text-blue-600"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                  )}

                  {previewFile.type === 'pdf' ? (
                    <iframe
                      title={previewFile.name}
                      src={previewFile.url}
                      className="h-full w-full rounded-2xl border border-slate-200 bg-white"
                    />
                  ) : (
                    <img
                      src={previewFile.url}
                      alt={`${selectedRecord.student_name} submission ${selectedFileIndex + 1}`}
                      className="h-full rounded-2xl border border-slate-200 bg-white object-contain shadow-lg"
                    />
                  )}

                  {previewFiles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedFileIndex((current) => (current + 1) % previewFiles.length)}
                      className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-lg transition hover:bg-white hover:text-blue-600"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
};

export default TeacherFeedback;
