"use client"

import { useEffect, useState } from "react"
import { useReducedMotion } from "motion/react"

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"
const MIN_DURATION = 1200
const EXIT_DURATION = 900

/**
 * Intro — full-screen ink overlay with wordmark, 0→100% counter,
 * hairline progress bar and a two-panel curtain reveal.
 * Skipped instantly when sessionStorage 'cm-intro-seen' is set.
 * Renders nothing when the user prefers reduced motion. SSR-safe.
 */
export function Intro() {
  const shouldReduce = useReducedMotion()
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">("loading")
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (shouldReduce) {
      setPhase("done")
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    try {
      if (window.sessionStorage.getItem("cm-intro-seen")) {
        setPhase("done")
        document.body.style.overflow = prevOverflow
        return
      }
    } catch {
      // sessionStorage unavailable — play the intro once
    }

    let fontsReady = typeof document.fonts === "undefined"
    if (!fontsReady) {
      document.fonts.ready.then(
        () => {
          fontsReady = true
        },
        () => {
          fontsReady = true
        },
      )
    }

    let finished = false
    let raf = 0
    let exitTimer = 0
    const start = performance.now()

    const tick = (now: number) => {
      const tween = Math.min((now - start) / MIN_DURATION, 1)
      const complete = tween >= 1 && fontsReady
      setProgress(complete ? 100 : Math.round(Math.min(tween, 0.99) * 100))
      if (complete && !finished) {
        finished = true
        try {
          window.sessionStorage.setItem("cm-intro-seen", "1")
        } catch {
          // ignore — intro simply replays next visit
        }
        setPhase("leaving")
        exitTimer = window.setTimeout(() => {
          setPhase("done")
          document.body.style.overflow = prevOverflow
        }, EXIT_DURATION)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(exitTimer)
      document.body.style.overflow = prevOverflow
    }
  }, [shouldReduce])

  if (shouldReduce) return null
  if (phase === "done") return null

  const leaving = phase === "leaving"
  const curtain = (delay: number): React.CSSProperties => ({
    transform: leaving ? "translateY(-100%)" : "translateY(0)",
    transition: `transform ${EXIT_DURATION}ms ${EASE} ${delay}ms`,
  })

  return (
    <div
      aria-label="Chargement de CamerMove"
      className="fixed inset-0 z-[100]"
    >
      {/* Back curtain panel — lags slightly for a layered reveal */}
      <div aria-hidden className="absolute inset-0 bg-ink-1" style={curtain(90)} />
      {/* Front curtain panel — carries the content */}
      <div className="absolute inset-0 bg-ink text-paper" style={curtain(0)}>
        <div
          className="flex h-full flex-col justify-between px-6 py-8 sm:px-8 md:px-12 md:py-10"
          style={{
            opacity: leaving ? 0 : 1,
            transform: leaving ? "translateY(-24px)" : "translateY(0)",
            transition: leaving ? `opacity 300ms ${EASE}, transform 500ms ${EASE}` : undefined,
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
              Plateforme multi-services · Cameroun
            </p>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
              Édition 2026
            </p>
          </div>

          <div>
            <p className="font-body text-[clamp(2.6rem,9vw,7rem)] font-medium leading-[0.95] tracking-[-0.035em]">
              CAMERMOVE
            </p>
            <div className="mt-8 flex items-end justify-between gap-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
                Chargement — <span className="num-tabular text-paper">{progress} %</span>
              </p>
              <p className="hidden text-[11px] uppercase tracking-[0.22em] text-white/35 sm:block">
                Yaoundé ⇄ Douala
              </p>
            </div>
            {/* Hairline progress bar */}
            <div className="relative mt-4 h-px w-full bg-white/15" aria-hidden>
              <span
                className="absolute inset-y-0 left-0 bg-paper"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
