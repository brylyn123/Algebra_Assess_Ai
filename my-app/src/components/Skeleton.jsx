import React from 'react';

export function Skeleton({ className = '', count = 1, rounded = 'rounded-2xl' }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`skeleton-loading ${rounded} ${className}`}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`rounded-[1.45rem] border border-slate-100 bg-white p-5 ${className}`}>
      <Skeleton className="mb-3 h-4 w-1/3" rounded="rounded-lg" />
      <Skeleton className="mb-2 h-3 w-full" rounded="rounded-lg" />
      <Skeleton className="mb-2 h-3 w-5/6" rounded="rounded-lg" />
      {lines > 2 && <Skeleton className="h-3 w-2/3" rounded="rounded-lg" />}
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="rounded-[1.8rem] bg-slate-100 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="mb-3 h-3 w-24" rounded="rounded-md" />
          <Skeleton className="mb-2 h-8 w-16" rounded="rounded-lg" />
        </div>
        <Skeleton className="h-12 w-12" rounded="rounded-2xl" />
      </div>
      <Skeleton className="mt-4 h-3 w-32" rounded="rounded-md" />
    </div>
  );
}

export function SkeletonList({ count = 4 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}
