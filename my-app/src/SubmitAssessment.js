import React, { useMemo, useState } from 'react';

const assessmentDetails = {
  title: 'Linear Equations Quiz',
  due: 'February 25, 2026',
  points: 50,
};

const SubmitAssessment = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);

  const fileLabel = useMemo(() => {
    if (selectedFiles.length === 0) return 'Drop files here or click to browse';
    return `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} ready to upload`;
  }, [selectedFiles.length]);

  const handleFiles = (event) => {
    const fileList = Array.from(event.target.files || []);
    if (fileList.length === 0) return;
    setSelectedFiles((current) => [...current, ...fileList]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const fileList = Array.from(event.dataTransfer.files || []);
    if (fileList.length === 0) return;
    setSelectedFiles((current) => [...current, ...fileList]);
  };

  const clearFiles = () => setSelectedFiles([]);

  const preventDefault = (event) => event.preventDefault();

  return (
    <div className="min-h-screen bg-transparent py-8">
      <div className="max-w-6xl mx-auto space-y-6 px-4 md:px-6">
        <div className="space-y-2 px-2">
          <h1 className="text-3xl font-bold text-slate-900">Submit Assessment</h1>
          <p className="text-sm text-slate-500">Upload your completed work and let us know which assessment you are submitting.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr]">
          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-slate-900">Assessment Details</h2>
            <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-500">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 uppercase tracking-[0.3em]">Assessment</span>
                <span className="text-base text-slate-900 font-semibold">{assessmentDetails.title}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 uppercase tracking-[0.3em]">Due Date</span>
                <span className="text-base text-slate-900 font-semibold">{assessmentDetails.due}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 uppercase tracking-[0.3em]">Total Points</span>
                <span className="text-base text-slate-900 font-semibold">{assessmentDetails.points}</span>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-slate-900">Upload Handwritten Solutions</h2>
            <p className="text-sm text-slate-500 mt-1">
              Take photos or scan your handwritten solutions and upload them here. You can upload multiple files up to
              10MB each.
            </p>

            <label
              onDragOver={preventDefault}
              onDragEnter={preventDefault}
              onDragLeave={preventDefault}
              onDrop={handleDrop}
              className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center transition hover:border-blue-400 hover:bg-blue-50"
            >
              <input onChange={handleFiles} type="file" multiple accept=".jpg,.jpeg,.png,.pdf" className="hidden" />
              <span className="text-3xl">⤴️</span>
              <p className="text-sm font-semibold text-slate-700">{fileLabel}</p>
              <p className="text-xs text-slate-500">Supported formats: JPG, PNG, PDF (Max 10MB per file)</p>
              <span className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow">Choose Files</span>
            </label>

            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                {selectedFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-2">
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={clearFiles}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:bg-blue-400"
            disabled={selectedFiles.length === 0}
          >
            Submit Assessment
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmitAssessment;
