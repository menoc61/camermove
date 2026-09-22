"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useMotionPreference } from "./preference"

/**
 * OverlayNavController — owns full-screen overlay navigation:
 * - open/close state + hamburger morph (3 lines → X)
 * - yolo-style GSAP overlay timeline, dynamic import quarantined HERE
 * - body scroll-lock, restored on close AND on unmount
 * - Escape-to-close with focus returned to the hamburger
 * - focus moves into the overlay on open, Tab trapped while open
 *
 * Reduced-motion: content appears instantly (no hidden states, no GSAP).
 */
export interface OverlayNavController {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  /** Attach to the fixed hamburger button. */
  hamburgerRef: React.RefObject<HTMLButtonElement | null>
  /** Attach to the hamburger's three line spans, in order. */
  linesRef: React.MutableRefObject<(HTMLSpanElement | null)[]>
  /** Attach to the overlay container (spread onKeyDown too). */
  overlayRef: React.RefObject<HTMLDivElement | null>
  /** Attach to each overlay link, in DOM order. */
  linksRef: React.MutableRefObject<(HTMLAnchorElement | null)[]>
  /** Spread onto the overlay container for Tab trapping. */
  onKeyDown: (e: React.KeyboardEvent) => void
}

export function useOverlayNav(): OverlayNavController {
  const reduced = useMotionPreference()
  const [isOpen, setIsOpen] = useState(false)
  const hamburgerRef = useRef<HTMLButtonElement | null>(null)
  const linesRef = useRef<(HTMLSpanElement | null)[]>([])
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const linksRef = useRef<(HTMLAnchorElement | null)[]>([])

  // ── GSAP timelines (dynamic import, quarantined in this module) ──
  const animateHamburger = useCallback(
    async (open: boolean) => {
      if (reduced) return
      const { gsap } = await import("gsap")
      const [l1, l2, l3] = linesRef.current
      if (!l1 || !l2 || !l3) return
      if (open) {
        gsap.to(l1, { y: 8, rotate: 45, duration: 0.3, ease: "power2.out" })
        gsap.to(l2, { opacity: 0, scaleX: 0, duration: 0.2, ease: "power2.out" })
        gsap.to(l3, { y: -8, rotate: -45, duration: 0.3, ease: "power2.out" })
      } else {
        gsap.to(l1, { y: 0, rotate: 0, duration: 0.3, ease: "power2.out" })
        gsap.to(l2, { opacity: 1, scaleX: 1, duration: 0.2, ease: "power2.out" })
        gsap.to(l3, { y: 0, rotate: 0, duration: 0.3, ease: "power2.out" })
      }
    },
    [reduced]
  )

  const openNav = useCallback(async () => {
    setIsOpen(true)
    document.body.style.overflow = "hidden"
    await animateHamburger(true)
    const overlay = overlayRef.current
    if (!overlay || reduced) return
    const { gsap } = await import("gsap")
    gsap.set(overlay, { y: "-100%" })
    gsap.set(linksRef.current, { y: "110%", opacity: 0 })
    gsap
      .timeline()
      .to(overlay, { y: "0%", duration: 0.75, ease: "expo.inOut" })
      .fromTo(
        linksRef.current,
        { y: "110%", opacity: 0 },
        { y: "0%", opacity: 1, duration: 0.7, ease: "expo.out", stagger: 0.07 },
        "-=0.4"
      )
  }, [reduced, animateHamburger])

  const closeNav = useCallback(async () => {
    await animateHamburger(false)
    const overlay = overlayRef.current
    if (!overlay || reduced) {
      setIsOpen(false)
      document.body.style.overflow = ""
      return
    }
    const { gsap } = await import("gsap")
    gsap
      .timeline({
        onComplete: () => {
          setIsOpen(false)
          gsap.set(overlay, { y: "-100%" })
          document.body.style.overflow = ""
        },
      })
      .to(overlay, { y: "-100%", duration: 0.6, ease: "expo.inOut" })
  }, [reduced, animateHamburger])

  const toggle = useCallback(() => {
    if (isOpen) void closeNav()
    else void openNav()
  }, [isOpen, openNav, closeNav])

  // Escape closes + focus returns to the hamburger. Focus moves into the
  // overlay on open so keyboard users never lose their place.
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void closeNav()
        hamburgerRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    const first = overlayRef.current?.querySelector<HTMLElement>("a")
    first?.focus()
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, closeNav])

  // Scroll-lock safety net: whatever the close path did, unmount restores.
  useEffect(() => {
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  // Minimal focus trap: Tab cycles within the overlay instead of escaping.
  const onOverlayKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !overlayRef.current) return
    const focusables = overlayRef.current.querySelectorAll<HTMLElement>(
      "a[href], button"
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (!first || !last) return
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  return {
    isOpen,
    open: openNav,
    close: closeNav,
    toggle,
    hamburgerRef,
    linesRef,
    overlayRef,
    linksRef,
    onKeyDown: onOverlayKeyDown,
  }
}
