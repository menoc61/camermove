"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { SearchBar } from "../search/search-bar"
import { Button } from "@/components/ui/button"

/* Reel chapters: each one paints a CamerMove service with an on-brand gradient
   instead of an external image. No CDN dependency, no 404s, and the visual
   stays on-brand even before the (placeholder) video loads. */
const REEL = [
  {
    label: "Transport interurbain",
    title: "Yaoundé ⇄ Douala, billets comparés en un clin d'œil",
    src: "/videos/placeholder.mp4",
    chapter: "01",
    eyebrow: "Bus & voiture",
    gradient: "linear-gradient(135deg, #0E0E0E 0%, #1F3A5F 55%, #C2772A 100%)",
    accent: "#E8A548",
  },
  {
    label: "Hôtels vérifiés",
    title: "Suites et chambres climatisées, de Yaoundé à Kribi",
    src: "/videos/placeholder.mp4",
    chapter: "02",
    eyebrow: "Hébergement",
    gradient: "linear-gradient(135deg, #1B1B1B 0%, #5C2A2A 50%, #C28A3A 100%)",
    accent: "#F1C27D",
  },
  {
    label: "Colis & courses",
    title: "Envoyez un colis de Douala à Bafoussam, suivi en direct",
    src: "/videos/placeholder.mp4",
    chapter: "03",
    eyebrow: "Logistique",
    gradient: "linear-gradient(135deg, #0E1A1F 0%, #134E5E 60%, #71B280 100%)",
    accent: "#9DE0A5",
  },
  {
    label: "Location de véhicules",
    title: "Prise en charge aéroport, retour libre — sans paperasse",
    src: "/videos/placeholder.mp4",
    chapter: "04",
    eyebrow: "Mobilité",
    gradient: "linear-gradient(135deg, #101524 0%, #2A2F6E 55%, #6F4FB8 100%)",
    accent: "#A48BF0",
  },
  {
    label: "Assurance voyage",
    title: "Couverture santé, bagages et rapatriement, dès 2 500 XAF",
    src: "/videos/placeholder.mp4",
    chapter: "05",
    eyebrow: "Protection",
    gradient: "linear-gradient(135deg, #0A1320 0%, #1B3B6F 50%, #3FA7D6 100%)",
    accent: "#7DD3FC",
  },
  {
    label: "Billetterie événementielle",
    title: "Concerts, matchs et festivals — billets mobiles authentiques",
    src: "/videos/placeholder.mp4",
    chapter: "06",
    eyebrow: "Loisirs",
    gradient: "linear-gradient(135deg, #1A0F1F 0%, #5B1E5B 55%, #E255A1 100%)",
    accent: "#F9A8D4",
  },
  {
    label: "Mobile Money & carte",
    title: "Orange Money, MTN MoMo, carte Visa — paiement unifié",
    src: "/videos/placeholder.mp4",
    chapter: "07",
    eyebrow: "Paiement",
    gradient: "linear-gradient(135deg, #1A1300 0%, #4D3800 55%, #FFB000 100%)",
    accent: "#FFD75E",
  },
] as const

const AUTO_ADVANCE_MS = 6_500

interface HeroProps {
  minPrice?: number
  nextDepartureAt?: string
}

function departureLabel(iso?: string): string {
  if (!iso) return "Départs quotidiens"
  const time = new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Douala",
  })
  return `Prochain départ · ${time}`
}

export function Hero({ minPrice, nextDepartureAt }: HeroProps) {
  const reelRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const shouldReduce = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  // Drive the active video + global progress from the reel container's own scroll.
  // Manual scroll pauses auto-advance so the user can browse without the reel
  // jumping back to the previous chapter under their cursor.
  useEffect(() => {
    const root = reelRef.current
    if (!root) return
    let userPausedUntil = 0
    const PAUSE_AFTER_SCROLL_MS = 8_000

    const onScroll = () => {
      const total = root.scrollWidth - root.clientWidth
      const scrolled = Math.min(Math.max(root.scrollLeft, 0), total)
      const pct = total > 0 ? scrolled / total : 0
      setProgress(pct)
      const idx = Math.min(
        REEL.length - 1,
        Math.max(0, Math.round(pct * (REEL.length - 1)))
      )
      setActiveIndex(idx)
      userPausedUntil = Date.now() + PAUSE_AFTER_SCROLL_MS
    }
    onScroll()
    root.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)

    // Auto-advance: walk the reel forward at a calm cadence. Respects
    // prefers-reduced-motion and the manual-scroll pause window.
    const interval = setInterval(() => {
      if (shouldReduce) return
      if (Date.now() < userPausedUntil) return
      setActiveIndex((i) => {
        const next = (i + 1) % REEL.length
        const total = root.scrollWidth - root.clientWidth
        const targetX = (next / (REEL.length - 1)) * total
        root.scrollTo({ left: targetX, behavior: "smooth" })
        return next
      })
    }, AUTO_ADVANCE_MS)

    return () => {
      clearInterval(interval)
      root.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [shouldReduce])

  // Only the active video plays, others are paused to save bandwidth.
  useEffect(() => {
    if (shouldReduce) return
    videoRefs.current.forEach((v, i) => {
      if (!v) return
      if (i === activeIndex) {
        v.play().catch(() => {})
      } else {
        v.pause()
      }
    })
  }, [activeIndex, shouldReduce])

  // Click on a chapter scrolls the reel container there.
  const goTo = (i: number) => {
    const root = reelRef.current
    if (!root) return
    const total = root.scrollWidth - root.clientWidth
    const targetX = (i / (REEL.length - 1)) * total
    root.scrollTo({ left: targetX, behavior: shouldReduce ? "auto" : "smooth" })
  }

  return (
    <section
      aria-label="CamerMove — plateforme de mobilité"
      className="relative overflow-clip bg-ink text-paper"
    >
      {/* Top eyebrow */}
      <div className="relative z-10 border-b border-white/10">
        <div className="mx-auto flex max-w-[1560px] items-center justify-between gap-6 px-6 py-4 sm:px-8 md:px-12">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
            Plateforme multi-services · Cameroun
          </p>
          <p className="hidden text-[11px] uppercase tracking-[0.22em] text-white/55 sm:block">
            Édition 2026
          </p>
        </div>
      </div>

      {/* Headline */}
      <div className="relative z-10 mx-auto max-w-[1560px] px-6 pb-10 pt-12 sm:px-8 sm:pt-16 md:px-12 md:pb-16 md:pt-24">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10">
          <div className="col-span-12 lg:col-span-8">
            <motion.h1
              initial={shouldReduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="font-body text-[clamp(2.4rem,7vw,6.4rem)] font-medium leading-[0.95] tracking-[-0.035em] text-paper text-balance"
            >
              La mobilité africaine,
              <br />
              <span className="text-white/55">réinventée</span> de Yaoundé à Douala.
            </motion.h1>
          </div>
          <div className="col-span-12 flex flex-col gap-6 lg:col-span-4 lg:items-end lg:justify-end">
            <motion.p
              initial={shouldReduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[36ch] text-base leading-[1.55] text-white/65 text-pretty"
            >
              Un seul compte, six services. Comparez les bus, réservez un hôtel,
              louez un véhicule, expédiez un colis, souscrivez une assurance,
              achetez un billet d’événement — payez en Mobile Money.
            </motion.p>
            <motion.div
              initial={shouldReduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-white/45"
            >
              <span className="block h-px w-12 bg-white/40" aria-hidden />
              <span>Faire défiler pour explorer</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Horizontal video reel — real scroll container with snap */}
      <div
        ref={reelRef}
        className="relative z-0 flex w-full snap-x snap-mandatory select-none overflow-x-auto"
        style={{ height: "min(78vh, 760px)" }}
      >
        {REEL.map((item, i) => (
          <article
            key={item.chapter}
            className="relative h-full w-[85vw] flex-shrink-0 snap-center overflow-hidden sm:w-screen"
            aria-roledescription="slide"
            aria-label={`${item.chapter} — ${item.title}`}
          >
            {/* On-brand gradient poster — no external image dependency */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: item.gradient }}
            />
            {/* Service badge — keeps the reel legible while the placeholder video plays */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="rounded-full border border-white/25 bg-black/20 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.32em] text-white/85 backdrop-blur-sm"
                style={{ color: item.accent }}
              >
                {item.eyebrow}
              </div>
            </div>
            {/* Video (autoplay, muted, loop, playsInline) */}
            {!shouldReduce && (
              <video
                ref={(el) => {
                  videoRefs.current[i] = el
                }}
                src={item.src}
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover opacity-0"
              />
            )}
            {/* Subtle dark veil for legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/60" />

            {/* Caption — Swiss label block */}
            <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[1560px] flex-wrap items-end justify-between gap-6 px-6 pb-10 sm:px-8 md:px-12 md:pb-12">
              <div className="flex items-end gap-6">
                <span className="block font-body text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-none tracking-[-0.04em] text-paper">
                  {item.chapter}
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
                    {item.label}
                  </p>
                  <p className="mt-2 max-w-[40ch] text-base font-normal leading-snug text-paper sm:text-lg">
                    {item.title}
                  </p>
                </div>
              </div>
              <span
                aria-hidden
                className="hidden font-body text-[11px] uppercase tracking-[0.22em] text-white/55 md:block"
              >
                Camermove · Reel {String(i + 1).padStart(2, "0")} / {String(REEL.length).padStart(2, "0")}
              </span>
            </div>
          </article>
        ))}
      </div>

      {/* Progress bar + chapter selector (sticky below the fixed header) */}
      <div className="sticky top-[72px] z-10 border-t border-white/10 bg-ink/85 backdrop-blur lg:top-24">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-4 px-6 py-4 sm:px-8 md:flex-row md:items-center md:gap-8 md:px-12">
          <div className="flex items-center gap-3 overflow-x-auto md:flex-1">
            {REEL.map((item, i) => (
              <button
                key={item.chapter}
                onClick={() => goTo(i)}
                aria-current={i === activeIndex}
                className="group flex min-h-[44px] shrink-0 items-center gap-2 px-4 py-1 text-left"
              >
                <span
                  className={`text-[10px] font-medium uppercase tracking-[0.22em] transition-colors ${
                    i === activeIndex ? "text-paper" : "text-white/40 group-hover:text-white/70"
                  }`}
                >
                  {item.chapter}
                </span>
                <span
                  className={`block h-px w-8 transition-colors md:w-12 ${
                    i === activeIndex ? "bg-paper" : "bg-white/20"
                  }`}
                  aria-hidden
                />
                <span
                  className={`hidden whitespace-nowrap text-[11px] uppercase tracking-[0.18em] transition-colors md:inline ${
                    i === activeIndex ? "text-paper" : "text-white/35"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
          <div
            className="relative h-px w-full bg-white/10 md:w-48"
            aria-hidden
          >
            <span
              className="absolute inset-y-0 left-0 bg-paper"
              style={{ width: `${Math.max(8, progress * 100)}%`, transition: "width 120ms linear" }}
            />
          </div>
        </div>
      </div>

      {/* Search panel — directly under the hero, on a paper surface */}
      <div className="relative z-0 bg-paper text-ink">
        <div className="mx-auto max-w-[1560px] px-6 py-14 sm:px-8 md:px-12 md:py-20">
          <div className="grid grid-cols-12 gap-x-6 gap-y-10">
            <div className="col-span-12 lg:col-span-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
                01 — Rechercher
              </p>
              <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.025em] text-ink text-balance">
                Un bus, un train, un vol, un départ — au bon prix, au bon moment.
              </h2>
              <p className="mt-5 max-w-[40ch] text-base leading-[1.55] text-ink-1">
                {departureLabel(nextDepartureAt)}
                {minPrice != null && (
                  <>
                    {" · dès "}
                    <span className="num-tabular font-medium text-ink">
                      {new Intl.NumberFormat("fr-FR").format(minPrice)} XAF
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <div className="border border-line bg-surface-1 p-5 sm:p-6">
                <SearchBar />
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
                    Produit héros · transport interurbain
                  </p>
                  <Link
                    href="/results?origin=Yaound%C3%A9&destination=Douala&pax=1"
                    aria-label="Réserver un trajet Yaoundé → Douala"
                  >
                    <Button
                      size="lg"
                      className="rounded-none bg-ink px-7 py-6 text-[12px] font-medium uppercase tracking-[0.22em] text-paper hover:bg-ink-1"
                    >
                      Réserver un trajet
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
