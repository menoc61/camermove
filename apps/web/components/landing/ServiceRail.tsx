"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { useReducedMotion } from "motion/react"

/**
 * ServiceRail — generic swippable horizontal rail (Studio-Haas direction).
 *
 * Contract (P5): every service rail on the homepage is a <ServiceRail>
 * with its own server-fetched content. Do not change these props without
 * updating all rails.
 *
 * Props:
 * - index: "01".."06" — Swiss section number
 * - kicker: micro label, e.g. "Transport interurbain"
 * - title: rail headline
 * - intro: one-line description (max ~60ch)
 * - href / hrefLabel: deep link to the service page
 * - dark?: render on ink background (transport hero rail)
 * - children: snap-aligned cards (<ServiceRailCard> recommended)
 */
export function ServiceRail({
  index,
  kicker,
  title,
  intro,
  href,
  hrefLabel,
  dark = false,
  children,
}: {
  index: string
  kicker: string
  title: string
  intro: string
  href: string
  hrefLabel: string
  dark?: boolean
  children: React.ReactNode
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const shouldReduce = useReducedMotion()

  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const total = el.scrollWidth - el.clientWidth
    setProgress(total > 0 ? el.scrollLeft / total : 0)
  }, [])

  const scrollBy = useCallback(
    (dir: 1 | -1) => {
      const el = trackRef.current
      if (!el) return
      el.scrollTo({
        left: el.scrollLeft + dir * el.clientWidth * 0.8,
        behavior: shouldReduce ? "auto" : "smooth",
      })
    },
    [shouldReduce],
  )

  return (
    <section
      aria-label={`${index} — ${kicker}`}
      className={dark ? "bg-ink text-paper" : "border-t border-line bg-paper text-ink"}
    >
      <div className="mx-auto max-w-[1560px] px-6 py-16 sm:px-8 md:px-12 md:py-24">
        <div className="mb-8 flex flex-col gap-6 border-b border-line pb-8 md:mb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.22em] ${dark ? "text-white/55" : "text-ink-2"}`}>
              {index} — {kicker}
            </p>
            <h2 className="mt-3 max-w-[20ch] text-[clamp(1.8rem,3.2vw,2.8rem)] font-medium leading-[1.02] tracking-[-0.025em] text-balance">
              {title}
            </h2>
            <p className={`mt-4 max-w-[52ch] text-[14px] leading-[1.55] ${dark ? "text-white/65" : "text-ink-1"}`}>
              {intro}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={href}
              className={`inline-flex min-h-[44px] items-center border px-5 text-[12px] font-medium uppercase tracking-[0.22em] transition-colors ${
                dark
                  ? "border-white/25 text-paper hover:bg-paper hover:text-ink"
                  : "border-ink/25 text-ink hover:bg-ink hover:text-paper"
              }`}
            >
              {hrefLabel}
            </Link>
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Faire défiler vers la gauche"
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center border text-lg leading-none transition-colors ${
                dark ? "border-white/25 hover:bg-paper hover:text-ink" : "border-ink/25 hover:bg-ink hover:text-paper"
              }`}
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Faire défiler vers la droite"
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center border text-lg leading-none transition-colors ${
                dark ? "border-white/25 hover:bg-paper hover:text-ink" : "border-ink/25 hover:bg-ink hover:text-paper"
              }`}
            >
              →
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          onScroll={onScroll}
          className="-mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-2 sm:-mx-8 sm:px-8 md:-mx-12 md:px-12"
        >
          {children}
        </div>

        <div className={`relative mt-6 h-px w-full ${dark ? "bg-white/10" : "bg-ink/10"}`} aria-hidden>
          <span
            className={dark ? "absolute inset-y-0 left-0 bg-paper" : "absolute inset-y-0 left-0 bg-ink"}
            style={{ width: `${Math.max(6, progress * 100)}%`, transition: "width 120ms linear" }}
          />
        </div>
      </div>
    </section>
  )
}

/**
 * ServiceRailCard — snap-aligned card for rail children.
 * Image (16/10) + top meta row + title + bottom meta row, wrapped in a link.
 */
export function ServiceRailCard({
  href,
  image,
  imageAlt,
  top,
  title,
  bottom,
  badge,
}: {
  href: string
  image: string
  imageAlt: string
  top: string
  title: string
  bottom: string
  badge?: string
}) {
  return (
    <Link
      href={href}
      className="group w-[78vw] shrink-0 snap-start border border-line bg-surface-1 sm:w-[380px]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={imageAlt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {badge ? (
          <span className="absolute left-3 top-3 bg-ink px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-paper">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-2">{top}</p>
        <p className="mt-2 text-[17px] font-medium leading-snug tracking-[-0.01em] text-ink">{title}</p>
        <p className="mt-2 border-t border-line pt-2 text-[12px] uppercase tracking-[0.14em] text-ink-1">{bottom}</p>
      </div>
    </Link>
  )
}
