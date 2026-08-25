"use client"
/**
 * EmptyState — centered message + optional CTA button. Used by the dashboard
 * when a section has no items.
 */
import Link from "next/link"

export function EmptyState({
  title,
  cta,
}: {
  title: string
  cta?: { href: string; label: string }
}) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="mt-4 inline-block rounded-lg bg-[#0e9f8f] px-4 py-2 text-sm font-medium text-white"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  )
}
