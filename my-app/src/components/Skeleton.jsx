import React from 'react';

export function Skeleton({ className = '', rounded = 'rounded-lg' }) {
  return (
    <div
      className={`skeleton-loading ${rounded} ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonWelcome() {
  return (
    <div className="rounded-xl bg-gradient-to-r from-blue-200 via-blue-300 to-indigo-200 p-4">
      <Skeleton className="mb-2 h-2.5 w-20 rounded-full bg-white/40" />
      <Skeleton className="mb-1.5 h-5 w-32 rounded-lg bg-white/50" />
      <Skeleton className="h-3 w-48 rounded-md bg-white/30" />
    </div>
  );
}

export function SkeletonStatRow() {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
      <Skeleton className="mb-2 h-2 w-16 rounded-full" />
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
            <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="mb-1 h-2 w-12 rounded-full" />
              <Skeleton className="h-4 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonSection({ rows = 3, hasHeader = true }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
      {hasHeader && (
        <div className="mb-2 flex items-center justify-between">
          <Skeleton className="h-2 w-24 rounded-full" />
          <Skeleton className="h-2.5 w-12 rounded-md" />
        </div>
      )}
      <div className="space-y-1.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-2.5">
            <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="mb-1 h-3 w-3/4 rounded-md" />
              <Skeleton className="h-2.5 w-1/2 rounded-full" />
            </div>
            <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonQuickActions() {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
      <Skeleton className="mb-2 h-2 w-20 rounded-full" />
      <div className="grid grid-cols-2 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center rounded-lg bg-slate-50 p-2.5">
            <Skeleton className="mb-1.5 h-8 w-8 rounded-lg" />
            <Skeleton className="mb-0.5 h-2 w-12 rounded-full" />
            <Skeleton className="h-1.5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonStatusCards() {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
      <Skeleton className="mb-2 h-2 w-12 rounded-full" />
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg bg-slate-50 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <Skeleton className="h-2.5 w-16 rounded-md" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <Skeleton className="mb-2 h-2 w-24 rounded-full" />
            <Skeleton className="h-6 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm ${className}`}>
      <Skeleton className="mb-2 h-3 w-1/3 rounded-md" />
      <Skeleton className="mb-1.5 h-2.5 w-full rounded-full" />
      <Skeleton className="mb-1.5 h-2.5 w-5/6 rounded-full" />
      {lines > 2 && <Skeleton className="h-2.5 w-2/3 rounded-full" />}
    </div>
  );
}

export function SkeletonList({ count = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}
