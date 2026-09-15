"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useMotionPreference } from "./preference"

/**
 * ReelController — owns the hero reel lifecycle end to end:
 * - slide index + scroll progress derived from the container's own scroll
 * - autoplay interval with guaranteed cleanup (no leaks on unmount)
 * - pause on hover/focus and after manual scrolling
 * - reduced-motion: autoplay and Ken Burns disabled, jumps are instant
 * - keyboard navigation (ArrowLeft / ArrowRight / Home / End) on the container
 *
 * All scroll/interval/resize listeners are added here and removed here.
 */
export interface ReelControllerOptions {
  /** Number of slides in the reel. */
  slideCount: number
  /** Autoplay cadence in ms (default 6500). */
  autoAdvanceMs?: number
  /** How long manual scrolling pauses autoplay (default 8000). */
  pauseAfterManualMs?: number
}

export interface ReelController<T extends HTMLElement = HTMLDivElement> {
  /** Attach to the scrollable reel container. */
  containerRef: React.RefObject<T | null>
  /** Index of the currently active slide. */
  activeIndex: number
  /** Scroll progress 0..1 across the whole reel. */
  progress: number
  /** Programmatic navigation (chapter buttons, arrows). */
  goTo: (index: number) => void
  next: () => void
  prev: () => void
  /** Keyboard handler — spread onto the container. */
  onKeyDown: (e: React.KeyboardEvent) => void
  /** Pause/resume on hover & focus — spread onto the container. */
  onMouseEnter: () => void
  onMouseLeave: () => void
  onFocus: () => void
  onBlur: () => void
  /** True when reduced motion is on (autoplay off, instant scrolls). */
  reduced: boolean
}

const AUTO_ADVANCE_MS = 6_500
const PAUSE_AFTER_SCROLL_MS = 8_000

export function useReelController<T extends HTMLElement = HTMLDivElement>({
  slideCount,
  autoAdvanceMs = AUTO_ADVANCE_MS,
  pauseAfterManualMs = PAUSE_AFTER_SCROLL_MS,
}: ReelControllerOptions): ReelController<T> {
  const reduced = useMotionPreference()
  const containerRef = useRef<T | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const hoverPaused = useRef(false)
  const focusPaused = useRef(false)
  const userPausedUntil = useRef(0)

  const scrollToIndex = useCallback(
    (index: number, smooth: boolean) => {
      const root = containerRef.current
      if (!root) return
      const total = root.scrollWidth - root.clientWidth
      if (total <= 0) return
      const clamped = Math.min(slideCount - 1, Math.max(0, index))
      const targetX = (clamped / (slideCount - 1)) * total
      root.scrollTo({ left: targetX, behavior: smooth ? "smooth" : "auto" })
    },
    [slideCount]
  )

  // Sync index + progress from native scroll (touch, scrollbar, keyboard).
  // All listeners are registered and removed here — no leaks.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const onScroll = () => {
      const total = root.scrollWidth - root.clientWidth
      const scrolled = Math.min(Math.max(root.scrollLeft, 0), total)
      const pct = total > 0 ? scrolled / total : 0
      setProgress(pct)
      setActiveIndex(
        Math.min(slideCount - 1, Math.max(0, Math.round(pct * (slideCount - 1))))
      )
      userPausedUntil.current = Date.now() + pauseAfterManualMs
    }
    onScroll()
    root.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      root.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [slideCount, pauseAfterManualMs])

  // Autoplay interval — cleared on unmount / option change. Skipped entirely
  // while hovered, focused, recently scrolled, or under reduced motion.
  useEffect(() => {
    if (reduced) return
    const interval = setInterval(() => {
      if (hoverPaused.current || focusPaused.current) return
      if (Date.now() < userPausedUntil.current) return
      setActiveIndex((i) => {
        const next = (i + 1) % slideCount
        scrollToIndex(next, true)
        return next
      })
    }, autoAdvanceMs)
    return () => clearInterval(interval)
  }, [reduced, slideCount, autoAdvanceMs, scrollToIndex])

  const goTo = useCallback(
    (index: number) => scrollToIndex(index, !reduced),
    [reduced, scrollToIndex]
  )
  const next = useCallback(() => goTo(activeIndex + 1), [goTo, activeIndex])
  const prev = useCallback(() => goTo(activeIndex - 1), [goTo, activeIndex])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault()
        next()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        prev()
      } else if (e.key === "Home") {
        e.preventDefault()
        goTo(0)
      } else if (e.key === "End") {
        e.preventDefault()
        goTo(slideCount - 1)
      }
    },
    [next, prev, goTo, slideCount]
  )

  return {
    containerRef,
    activeIndex,
    progress,
    goTo,
    next,
    prev,
    onKeyDown,
    onMouseEnter: () => {
      hoverPaused.current = true
    },
    onMouseLeave: () => {
      hoverPaused.current = false
    },
    onFocus: () => {
      focusPaused.current = true
    },
    onBlur: () => {
      focusPaused.current = false
    },
    reduced,
  }
}
