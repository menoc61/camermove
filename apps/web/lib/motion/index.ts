"use client"

/**
 * CamerMove motion adapter — the single entry point for all motion in the
 * web app. Everything motion-related is owned here:
 *
 * - `useMotionPreference` — one shared `prefers-reduced-motion` listener
 * - `useReelController` — hero reel: index, autoplay, pause, keyboard nav
 * - `useOverlayNav` — overlay menu: scroll-lock, focus trap, Escape, GSAP
 * - `useReveal` — scroll reveal via IntersectionObserver + motion/react
 * - `ease` / `spring` / `scaleIn` / `tapScale` — shared motion vocabulary
 *
 * GSAP dynamic imports are quarantined inside `overlay.ts` (and, until the
 * remaining non-landing consumers migrate, in those components only).
 */
export { useMotionPreference, prefersReducedMotion } from "./preference"
export { useReelController } from "./reel"
export type { ReelController, ReelControllerOptions } from "./reel"
export { useOverlayNav } from "./overlay"
export type { OverlayNavController } from "./overlay"
export { useReveal, ease, spring, scaleIn, tapScale } from "./reveal"
export type { RevealOptions, RevealState } from "./reveal"
