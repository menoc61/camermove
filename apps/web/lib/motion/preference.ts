"use client"

import { useEffect, useState } from "react"

/**
 * Single shared source of truth for `prefers-reduced-motion`.
 *
 * One module-level MediaQueryList + one listener serve every consumer;
 * hooks subscribe through a tiny Set-based emitter. SSR-safe: returns
 * `false` (no preference) until the effect attaches on the client.
 */
type Listener = (reduced: boolean) => void

const listeners = new Set<Listener>()
let mql: MediaQueryList | null = null

function ensureMql(): MediaQueryList | null {
  if (typeof window === "undefined") return null
  if (!mql) {
    mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    mql.addEventListener("change", (e) => {
      for (const fn of listeners) fn(e.matches)
    })
  }
  return mql
}

/** Current reduced-motion state (client-safe read without subscribing). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    ? (mql ?? ensureMql())?.matches ?? false
    : false
}

/** React hook — the one place reduced motion is answered in the app. */
export function useMotionPreference(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = ensureMql()
    if (!query) return
    setReduced(query.matches)
    const listener: Listener = setReduced
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return reduced
}
