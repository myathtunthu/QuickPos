import React from 'react';

export default function Skeleton({ width = 'w-full', height = 'h-4', className = '', rounded = 'rounded-xl' }) {
  return (
    <div className={`${width} ${height} ${rounded} ${className} animate-pulse border border-white/5 bg-slate-800/60`} />
  );
}

export function RecordSkeleton() {
  return (
    <div className="app-card flex items-center justify-between gap-4 p-5">
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center gap-3">
          <Skeleton width="w-16" height="h-6" />
          <Skeleton width="w-24" height="h-4" />
        </div>
        <Skeleton width="w-36" height="h-6" className="mb-3" />
        <Skeleton width="w-24" height="h-4" />
      </div>
      <Skeleton width="w-28" height="h-9" rounded="rounded-2xl" />
    </div>
  );
}
