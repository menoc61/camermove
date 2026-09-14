"use client"

import { Children, cloneElement, isValidElement, useState } from "react"
import Link from "next/link"

const RAIL_LIMIT = 6

/**
 * ServiceRail — bento-grid layout for service cards (Studio-Haas direction).
 *
 * Contract (P5): every service rail on the homepage is a <ServiceRail>
 * with its own server-fetched content. Do not change these props without
 * updating all rails.
 *
 * The grid gives each card a different shape by position (period 4):
 *   0 → feature (2×2)   1 → tall (1×2)
 *   2 → std (1×1)       3 → std (1×1)
 * Any trailing hole in the tiling is filled with a brand cell — the "Voir
 * plus" trigger when more items exist, otherwise a CTA to the service page —
 * so the bento never shows dead space regardless of item count. On mobile/sm
 * the spans collapse to a simple 1-col / 2-col stack with natural heights.
 *
 * Props:
 * - index: "01".."06" — Swiss section number
 * - kicker: micro label, e.g. "Transport interurbain"
 * - title: rail headline
 * - intro: one-line description (max ~60ch)
 * - href / hrefLabel: deep link to the service page
 * - dark?: render on ink background (transport hero rail)
 * - children: grid cards (<ServiceRailCard> recommended)
 */

type CardSize = "feature" | "tall" | "std" | "wide"

const SPAN_BY_POSITION: Record<number, string> = {
  0: "lg:col-span-2 lg:row-span-2",
  1: "lg:row-span-2",
  2: "",
  3: "",
}

function sizeForPosition(i: number): CardSize {
  if (i === 0) return "feature"
  if (i === 1) return "tall"
  return "std"
}

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
  const [showAll, setShowAll] = useState(false)
  const childArray = Children.toArray(children).filter(isValidElement)
  const hasMore = childArray.length > RAIL_LIMIT
  const visible = showAll ? childArray : childArray.slice(0, RAIL_LIMIT)
  const count = visible.length

  const cells: React.ReactNode[] = visible.map((child, i) => {
    const size = sizeForPosition(i)
    const span = count < 3 ? "" : SPAN_BY_POSITION[i % 4] ?? ""
    return (
      <div key={child.key ?? i} className={`h-full ${span}`}>
        {cloneElement(child as React.ReactElement<{ size?: CardSize }>, { size })}
      </div>
    )
  })

  // Fill the trailing hole of the period-4 tiling with a brand cell.
  const remainder = count % 4
  const needsFiller = count >= 3 && remainder !== 0
  const fillerSpan = remainder === 3 ? "lg:col-span-1" : "lg:col-span-2"

  const fillerContent = hasMore && !showAll ? (
    <button
      type="button"
      onClick={() => setShowAll(true)}
      className={`group flex h-full min-h-[11rem] flex-col items-start justify-between border p-5 text-left transition-colors ${
        dark
          ? "border-white/15 bg-white/[0.03] hover:bg-white/[0.07]"
          : "border-line bg-surface-1 hover:bg-surface-2"
      }`}
    >
      <span className={`text-[10px] font-medium uppercase tracking-[0.22em] ${dark ? "text-white/55" : "text-ink-2"}`}>
        {index} · {kicker}
      </span>
      <span className="flex items-end justify-between gap-4 self-stretch">
        <span className={`max-w-[14ch] text-[clamp(1.3rem,1.8vw,1.7rem)] font-medium leading-[1.05] tracking-[-0.02em] ${dark ? "text-paper" : "text-ink"}`}>
          Voir plus
        </span>
        <span
          aria-hidden
          className="font-body text-[clamp(1.6rem,2.4vw,2.2rem)] leading-none transition-transform duration-300 group-hover:translate-y-0.5"
          style={{ color: dark ? "#E8A548" : "#C2772A" }}
        >
          ↓
        </span>
      </span>
    </button>
  ) : (
    <Link
      href={href}
      className={`group flex h-full min-h-[11rem] flex-col items-start justify-between border p-5 transition-colors ${
        dark
          ? "border-white/15 bg-white/[0.03] hover:bg-white/[0.07]"
          : "border-line bg-surface-1 hover:bg-surface-2"
      }`}
    >
      <span className={`text-[10px] font-medium uppercase tracking-[0.22em] ${dark ? "text-white/55" : "text-ink-2"}`}>
        {index} · {kicker}
      </span>
      <span className="flex items-end justify-between gap-4 self-stretch">
        <span className={`max-w-[14ch] text-[clamp(1.3rem,1.8vw,1.7rem)] font-medium leading-[1.05] tracking-[-0.02em] ${dark ? "text-paper" : "text-ink"}`}>
          {hrefLabel}
        </span>
        <span
          aria-hidden
          className="font-body text-[clamp(1.6rem,2.4vw,2.2rem)] leading-none transition-transform duration-300 group-hover:translate-x-1"
          style={{ color: dark ? "#E8A548" : "#C2772A" }}
        >
          →
        </span>
      </span>
    </Link>
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
          </div>
        </div>

        <div
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${
            count < 3 ? "" : "lg:auto-rows-[13rem]"
          }`}
        >
          {cells}
          {needsFiller && (
            <div className={`h-full ${fillerSpan}`}>{fillerContent}</div>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * ServiceRailCard — bento card for rail children. Fills whatever cell the
 * grid assigns it; `size` (injected by ServiceRail) scales the typography.
 * Image grows to fill, meta rows stay pinned bottom.
 */
export function ServiceRailCard({
  href,
  image,
  imageAlt,
  top,
  title,
  bottom,
  badge,
  size = "std",
}: {
  href: string
  image: string
  imageAlt: string
  top: string
  title: string
  bottom: string
  badge?: string
  size?: CardSize
}) {
  const feature = size === "feature"
  return (
    <Link
      href={href}
      className="group flex h-full min-h-[13rem] flex-col border border-line bg-surface-1"
    >
      <div className={`relative min-h-0 flex-1 overflow-hidden bg-surface-2 ${size === "std" ? "aspect-[16/10] lg:aspect-auto" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={imageAlt}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
        />
        {badge ? (
          <span className="absolute left-3 top-3 bg-ink px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-paper">
            {badge}
          </span>
        ) : null}
      </div>
      <div className={`p-4 ${feature ? "md:p-5" : ""}`}>
        <p className={`font-medium uppercase tracking-[0.22em] text-ink-2 ${feature ? "text-[11px]" : "text-[10px]"}`}>
          {top}
        </p>
        <p
          className={`mt-2 font-medium leading-snug tracking-[-0.01em] text-ink ${
            feature
              ? "text-[clamp(1.25rem,1.9vw,1.8rem)]"
              : size === "tall"
                ? "text-[18px]"
                : "text-[17px]"
          }`}
        >
          {title}
        </p>
        <p
          className={`mt-2 border-t border-line pt-2 uppercase tracking-[0.14em] text-ink-1 ${
            feature ? "text-[13px] font-medium text-ink" : "text-[12px]"
          }`}
        >
          {bottom}
        </p>
      </div>
    </Link>
  )
}
