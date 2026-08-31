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

    function handleChange(e: MediaQueryListEvent) {
      setReducedMotion(e.matches)
    }
    mq.addEventListener("change", handleChange)
    return () => mq.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      onComplete()
      return
    }

    let tl: any = null
    let aborted = false

    async function animate() {
      const gsapModule = await import("gsap")
      if (aborted) return

      const gsap = gsapModule.default

      // Set initial states immediately
      gsap.set(".line span", { y: 100, skewY: 7, opacity: 0 })
      gsap.set(".hero-image", { scale: 1.4, opacity: 0 })

      tl = gsap.timeline()

      tl.to(".line span", 1.8, {
        y: 0,
        skewY: 0,
        opacity: 1,
        ease: "power4.out",
        delay: 0.5,
        stagger: { amount: 0.3 },
      })
        .to(".overlay-top", 1.6, {
          height: 0,
          ease: "expo.inOut",
          stagger: 0.4,
        })
        .to(".overlay-bottom", 1.6, {
          width: 0,
          ease: "expo.inOut",
          delay: -0.8,
          stagger: { amount: 0.4 },
        })
        .to(
          overlayRef.current,
          { css: { display: "none" }, duration: 0 },
          "-=0.4"
        )
        .to(".hero-image", 1.6, {
          scale: 1,
          opacity: 1,
          ease: "expo.inOut",
          delay: -2,
          stagger: { amount: 0.4 },
          onComplete,
        })
    }

    animate()

    return () => {
      aborted = true
      if (tl) tl.kill()
    }
  }, [reducedMotion, onComplete])

  return (
    <div ref={overlayRef} className="intro-overlay">
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
