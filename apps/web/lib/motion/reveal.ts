"use client"

import { useEffect, useRef, useState } from "react"
import type { Transition, Variants } from "motion/react"
import { useMotionPreference } from "./preference"

/**
 * Shared reveal / entrance-motion vocabulary. Absorbs the former
 * `lib/animations.ts` constants and the former GSAP-based `batchReveal`
 * into one motion/react + IntersectionObserver implementation that
 * respects reduced motion in a single place.
 */
export const ease = [0.23, 1, 0.32, 1] as const // --ease-out

export const spring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease } },
}

export const tapScale = {
  scale: 0.97,
  transition: { duration: 0.1 },
}

export interface RevealOptions {
  /** Vertical offset in px before revealing (default 14). */
  y?: number
  /** Reveal only once, or toggle on every enter/exit (default once). */
  once?: boolean
  /** IntersectionObserver root margin (default "0px 0px -12% 0px"). */
  rootMargin?: string
}

export interface RevealState<T extends HTMLElement = HTMLElement> {
  /** Attach to the element to observe. */
  ref: React.RefObject<T | null>
  /** True once the element entered the viewport (or reduced motion is on). */
  shown: boolean
}

/**
 * Scroll-reveal observer. Under reduced motion the element is shown
 * immediately with no animation — callers just gate their motion props on
 * `shown` (e.g. `animate={shown ? "visible" : "hidden"}`).
 */
export function useReveal<T extends HTMLElement = HTMLElement>(
  options: RevealOptions = {}
): RevealState<T> {
  const { y = 14, once = true, rootMargin = "0px 0px -12% 0px" } = options
  const reduced = useMotionPreference()
  const targetRef = useRef<T | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    if (reduced) {
      setShown(true)
      return
    }
    if (typeof IntersectionObserver === "undefined") {
      setShown(true)
      return
    }
    el.style.setProperty("--reveal-y", `${y}px`)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            if (once) observer.disconnect()
          } else if (!once) {
            setShown(false)
          }
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [reduced, once, rootMargin, y])

  return {
    ref: targetRef,
    shown,
  }
}
