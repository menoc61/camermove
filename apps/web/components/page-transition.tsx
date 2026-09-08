"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useReducedMotion } from "motion/react"

// YOLO-style route transition: quick fade + 8px rise on every navigation
// (power3.out 0.45s). Skipped entirely under prefers-reduced-motion.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const shouldReduce = useReducedMotion()

  useEffect(() => {
    if (shouldReduce) return
    if (!ref.current) return
    let killed = false
    let ctx: { revert: () => void } | null = null
    async function run() {
      const gsap = (await import("gsap")).default
      if (killed || !ref.current) return
      ctx = gsap.context(() => {
        gsap.fromTo(
          ref.current!,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", overwrite: true }
        )
      })
    }
    run()
    return () => {
      killed = true
      ctx?.revert()
    }
  }, [pathname, shouldReduce])

  return (
    <div ref={ref} style={{ willChange: shouldReduce ? undefined : "transform, opacity" }}>
      {children}
    </div>
  )
}
