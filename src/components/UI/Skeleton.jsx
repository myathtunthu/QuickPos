import React from 'react';

export default function Skeleton({ width = 'w-full', height = 'h-4', className = '', rounded = 'rounded-lg' }) {
  return (
    <div className={`${width} ${height} ${className} ${rounded} bg-slate-800/50 animate-pulse border border-white/5`} />
  );
}

// 🌟 Record ဇယားများအတွက် အသင့်သုံး Skeleton Card
export function RecordSkeleton() {
  return (
    <div className="bg-[#0d1120] p-6 rounded-2xl border border-white/5 flex justify-between items-center gap-4">
      <div>
        <div className="flex items-center gap-3 mb-3">
          <Skeleton width="w-16" height="h-6" />
          <Skeleton width="w-24" height="h-4" />
        </div>
        <Skeleton width="w-32" height="h-6" className="mb-3" />
        <Skeleton width="w-20" height="h-4" />
      </div>
      <div className="flex flex-col items-end">
        <Skeleton width="w-28" height="h-8" className="mb-2" />
      </div>
    </div>
  );
}
