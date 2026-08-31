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
    let tickerCallback: ((time: number) => void) | null = null
    let gsapInstance: any = null

    async function init() {
      const gsapModule = await import("gsap")
      gsapInstance = gsapModule.default
      const { ScrollTrigger } = await import("gsap/ScrollTrigger")
      const Lenis = (await import("@studio-freight/lenis")).default

      gsapInstance.registerPlugin(ScrollTrigger)

      lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      })

      lenis.on("scroll", ScrollTrigger.update)

      tickerCallback = (time: number) => {
        lenis.raf(time * 1000)
      }
      gsapInstance.ticker.add(tickerCallback)
      gsapInstance.ticker.lagSmoothing(0)

      gsapInstance.set("body", { css: { visibility: "visible" } })
    }

    init()

    return () => {
      if (gsapInstance && tickerCallback) {
        gsapInstance.ticker.remove(tickerCallback)
      }
      if (lenis) lenis.destroy()
    }
  }, [reducedMotion])

  return <>{children}</>
}
