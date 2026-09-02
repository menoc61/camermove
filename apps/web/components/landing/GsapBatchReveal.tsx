"use client"

import { useEffect } from "react"
import { useReducedMotion } from "motion/react"

// Demonstrates gsap-scrolltrigger skill: batched enter for any .gsap-reveal
// Gate: occasional (scroll reveal) → standard. Purpose: preventing jarring change.
// Tool: GSAP ScrollTrigger.batch (cheapest that needs scrub/batching) → transform/opacity only, ease-out 0.35s, stagger 60ms.
export function GsapBatchReveal() {
  const shouldReduce = useReducedMotion()

  useEffect(() => {
    if (shouldReduce) return
    let killed = false
    let ctx: ReturnType<typeof import("gsap").default.context> | null = null

    async function init() {
      const { default: gsap } = await import("gsap")
      const { ScrollTrigger } = await import("gsap/ScrollTrigger")
      if (killed) return
      gsap.registerPlugin(ScrollTrigger)

      ctx = gsap.context(() => {
        // Batch all .gsap-reveal that haven't been handled by Motion
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

        // Set initial state off-thread (no flash)
        gsap.set(".gsap-reveal", { autoAlpha: 0, y: 14 })
        ScrollTrigger.refresh()
      })
    }

    init()

    return () => {
      killed = true
      ctx?.revert()
    }
  }, [shouldReduce])

  return null
}
