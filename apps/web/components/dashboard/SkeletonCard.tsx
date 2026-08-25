"use client"
/**
 * SkeletonCard — 3 stacked bars with animate-pulse. Used while the
 * dashboard data is loading.
 */
export function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-slate-200" />
    </div>
  )
}
