"use client"

import { useEffect } from "react"

// Batched enter for any .gsap-reveal, gated by prefers-reduced-motion.
// Tool: GSAP ScrollTrigger.batch (transform/opacity only, ease-out 0.45s, stagger 60ms).
// Reduced-motion users never get elements hidden — content stays visible (Tier 3).
export function GsapBatchReveal() {
  useEffect(() => {
    let killed = false
    let cleanup: (() => void) | null = null

    async function init() {
      const { default: gsap } = await import("gsap")
      const { ScrollTrigger } = await import("gsap/ScrollTrigger")
      if (killed) return
      gsap.registerPlugin(ScrollTrigger)

      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Initial state off-thread (no flash), set only when motion is allowed.
        gsap.set(".gsap-reveal", { autoAlpha: 0, y: 14 })

        ScrollTrigger.batch(".gsap-reveal", {
          onEnter: (els) =>
            gsap.to(els as Element[], {
              autoAlpha: 1,
              y: 0,
              duration: 0.45,
              ease: "power3.out",
              stagger: 0.06,
              overwrite: true,
            }),
          start: "top 88%",
          once: true,
        })
        ScrollTrigger.refresh()
      })
      cleanup = () => mm.revert()
    }

    init()

    return () => {
      killed = true
      cleanup?.()
    }
  }, [])

  return null
}
