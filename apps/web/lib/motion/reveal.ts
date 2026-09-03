"use client"
import { ensureGsap } from "./gsap"

export function batchReveal(selector = ".gsap-reveal") {
  const gsap = ensureGsap()
  const mm = gsap.matchMedia()
  mm.add(
    {
      reduce: "(prefers-reduced-motion: reduce)",
      motion: "(prefers-reduced-motion: no-preference)",
    },
    (ctx) => {
      const reduce = (ctx.conditions as Record<string, boolean>)?.reduce
      if (reduce) {
        gsap.set(selector, { clearProps: "all" })
        return
      }
      gsap.set(selector, { autoAlpha: 0, y: 14 })
      // @ts-ignore ScrollTrigger.batch is valid
      const { ScrollTrigger } = require("gsap/ScrollTrigger")
      ScrollTrigger.batch(selector, {
        onEnter: (els: Element[]) =>
          gsap.to(els, {
            autoAlpha: 1,
            y: 0,
            duration: 0.45,
            ease: "power3.out",
            stagger: 0.06,
            overwrite: "auto",
            onStart() {
              ;(els as Element[]).forEach((el) => ((el as HTMLElement).style.willChange = "transform,opacity"))
            },
            onComplete() {
              ;(els as Element[]).forEach((el) => ((el as HTMLElement).style.willChange = "auto"))
            },
          }),
        start: "top 88%",
        once: true,
      })
      ScrollTrigger.refresh()
      return () => {
        mm.revert()
      }
    }
  )
  return mm
}

export function heroTimeline(root: HTMLElement) {
  const gsap = ensureGsap()
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (reduce) return gsap.timeline()
  const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.7 } })
  tl.from(root.querySelectorAll(".hero-kicker"), { y: 16, autoAlpha: 0, duration: 0.5 }, 0)
    .from(root.querySelectorAll(".hero-title"), { y: 24, autoAlpha: 0, duration: 0.7 }, "<0.08")
    .from(root.querySelectorAll(".hero-cta"), { scale: 0.96, autoAlpha: 0, duration: 0.5 }, "<0.12")
  return tl
}
