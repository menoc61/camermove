"use client"

import { useEffect, useRef, useState } from "react"

interface IntroOverlayProps {
  onComplete: () => void
}

export function IntroOverlay({ onComplete }: IntroOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", h)
    return () => mq.removeEventListener("change", h)
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      onComplete()
      if (overlayRef.current) overlayRef.current.style.display = "none"
      return
    }

    let mm: ReturnType<typeof import("gsap").default.matchMedia> | null = null
    let aborted = false

    async function animate() {
      const { default: gsap } = await import("gsap")
      if (aborted) return

      // Gate: rare/first-time → delight allowed. Purpose: explanation (reveal).
      // Tool: GSAP (needs scrub pin later, programmatic control). Props: transform/opacity only.
      mm = gsap.matchMedia()
      mm.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          isMotion: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const reduce = (ctx.conditions as Record<string, boolean>).reduceMotion
          if (reduce) {
            gsap.set(document.body, { clearProps: "visibility" })
            document.body.style.visibility = "visible"
            if (overlayRef.current) overlayRef.current.style.display = "none"
            onComplete()
            return
          }

          gsap.set(".line span", { yPercent: 100, skewY: 7, autoAlpha: 0 })
          gsap.set(".hero-image", { scale: 1.06, autoAlpha: 0 })
          gsap.set(".overlay-top", { scaleY: 1, transformOrigin: "top" })
          gsap.set(".overlay-bottom", { scaleX: 1, transformOrigin: "left" })
          gsap.set(document.body, { autoAlpha: 1, visibility: "visible" })

          const tl = gsap.timeline({ delay: 0.3 })

          tl.to(".line span", {
            yPercent: 0,
            skewY: 0,
            autoAlpha: 1,
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.08,
          })
            .to(
              ".overlay-top",
              {
                scaleY: 0,
                duration: 0.8,
                ease: "expo.inOut",
                stagger: 0.07,
              },
              "+=0.15"
            )
            .to(
              ".overlay-bottom",
              {
                scaleX: 0,
                duration: 0.8,
                ease: "expo.inOut",
                stagger: 0.06,
              },
              "-=0.55"
            )
            .set(overlayRef.current, { display: "none" }, "-=0.2")
            .to(
              ".hero-image",
              {
                scale: 1,
                autoAlpha: 1,
                duration: 0.9,
                ease: "expo.out",
                stagger: 0.08,
                onComplete,
              },
              "-=0.7"
            )
        }
      )
    }

    animate()

    return () => {
      aborted = true
      mm?.revert()
    }
  }, [reducedMotion, onComplete])

  return (
    <div ref={overlayRef} className="intro-overlay" aria-hidden>
      <div className="overlay-top-container">
        <div className="overlay-top" />
        <div className="overlay-top" />
        <div className="overlay-top" />
      </div>
      <div className="overlay-bottom-container">
        <div className="overlay-bottom" />
        <div className="overlay-bottom" />
        <div className="overlay-bottom" />
      </div>
    </div>
  )
}
