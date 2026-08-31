"use client"

import { useEffect, useRef } from "react"
import { useReducedMotion } from "motion/react"

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion()
  const initialized = useRef(false)

  useEffect(() => {
    if (reducedMotion || initialized.current) return
    initialized.current = true

    let lenis: any = null
    let rafId: number | null = null

    async function init() {
      const gsapModule = await import("gsap")
      const gsap = gsapModule.default
      const { ScrollTrigger } = await import("gsap/ScrollTrigger")
      const Lenis = (await import("@studio-freight/lenis")).default

      gsap.registerPlugin(ScrollTrigger)

      lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      })

      lenis.on("scroll", ScrollTrigger.update)

      gsap.ticker.add((time: number) => {
        lenis.raf(time * 1000)
      })
      gsap.ticker.lagSmoothing(0)

      gsap.set("body", { css: { visibility: "visible" } })
    }

    init()

    return () => {
      if (lenis) lenis.destroy()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [reducedMotion])

  if (reducedMotion) {
    return <>{children}</>
  }

  return <>{children}</>
}
