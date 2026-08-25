"use client"
/**
 * HistoryToggle — collapsible section header with chevron, count badge,
 * and French toggle labels per UI-SPEC. Defaults to closed.
 */
import { useState } from "react"
import type { ReactNode } from "react"

export function HistoryToggle({
  count,
  defaultOpen = false,
  children,
}: {
  count: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="mt-6">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-sm"
      >
        <span className="text-sm font-medium text-slate-900">
          {open ? "Masquer l'historique" : "Voir l'historique"}
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
            {count}
          </span>
          <span
            className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </span>
      </button>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </section>
  )
}
