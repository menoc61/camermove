# Landing Page Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three-layer cinematic animations to the landing page: intro overlay reveal, hero text/image reveal, and scroll-triggered section animations using Framer Motion, GSAP, and Lenis.

**Architecture:** Hybrid approach — Framer Motion (`motion`) for component-level scroll reveals and hover micro-interactions, GSAP for the intro overlay timeline and hero text skew effect, Lenis for smooth scrolling with GSAP ScrollTrigger integration. All animations respect `prefers-reduced-motion`.

**Tech Stack:** `motion` (Framer Motion v12+), `gsap` (v3.12+), `@studio-freight/lenis` (v1+), Next.js 16, React 19, Tailwind v4

## Global Constraints

- `pnpm -r typecheck` must pass after every task
- All animations respect `prefers-reduced-motion` — if user prefers reduced motion, skip all animation effects
- Body starts with `visibility: hidden`, GSAP sets it to `visible` after init (prevents FOUC)
- IntroOverlay uses `hsl(var(--foreground))` for panel background (works in both light/dark themes)
- GSAP animations use `useLayoutEffect` with cleanup (`tl.kill()`) to handle React strict mode
- Lenis is dynamically imported with `{ ssr: false }` (no server-side rendering)

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `apps/web/components/smooth-scroll.tsx` | Lenis + GSAP ScrollTrigger integration (client, dynamic) |
| `apps/web/components/landing/IntroOverlay.tsx` | 6-panel intro overlay with GSAP timeline |
| `apps/web/components/landing/MotionSection.tsx` | Scroll-triggered section wrapper (Framer Motion) |

### Modified files

| File | Change |
|------|--------|
| `apps/web/package.json` | Add `motion`, `gsap`, `@studio-freight/lenis` |
| `apps/web/app/layout.tsx` | Wrap children with `<SmoothScroll>` |
| `apps/web/components/landing/Hero.tsx` | Add line-span wrappers, GSAP text reveal + image scale |
| `apps/web/app/page.tsx` | Add IntroOverlay, wrap sections with MotionSection |
| `apps/web/app/globals.css` | Add body visibility rule, marker pulse keyframe |
| `apps/web/components/landing/Steps.tsx` | Token sweep (slate → semantic) + wrap with MotionSection |

---

## Tasks

### Task 1: Install animation dependencies

**Files:**
- Modify: `apps/web/package.json` (pnpm install)

**Interfaces:**
- Consumes: nothing
- Produces: `motion`, `gsap`, `@studio-freight/lenis` available for import

- [ ] **Step 1: Install packages**

Run: `cd apps/web && pnpm add motion gsap @studio-freight/lenis`
Expected: packages added to dependencies

- [ ] **Step 2: Verify install**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 new errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "chore(web): add motion, gsap, lenis animation dependencies"
```

---

### Task 2: SmoothScroll component (Lenis + GSAP)

**Files:**
- Create: `apps/web/components/smooth-scroll.tsx`

**Interfaces:**
- Consumes: nothing (leaf utility)
- Produces: `<SmoothScroll>{children}</SmoothScroll>` wrapper component

- [ ] **Step 1: Create component**

Create `apps/web/components/smooth-scroll.tsx`:

```tsx
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

      // Set body visible after Lenis is ready
      gsap.to("body", 0, { css: { visibility: "visible" } })
    }

    init()

    return () => {
      if (lenis) lenis.destroy()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [reducedMotion])

  // If reduced motion, just render children without Lenis
  if (reducedMotion) {
    return <>{children}</>
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/smooth-scroll.tsx
git commit -m "feat(web): add SmoothScroll with Lenis + GSAP ScrollTrigger"
```

---

### Task 3: IntroOverlay component

**Files:**
- Create: `apps/web/components/landing/IntroOverlay.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `<IntroOverlay onComplete={() => void} />` — renders 6 panels, animates them away, calls onComplete

- [ ] **Step 1: Create component**

Create `apps/web/components/landing/IntroOverlay.tsx`:

```tsx
"use client"

import { useEffect, useRef, type RefObject } from "react"

interface IntroOverlayProps {
  onComplete: () => void
  containerRef?: RefObject<HTMLDivElement | null>
}

export function IntroOverlay({ onComplete, containerRef }: IntroOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef?.current) return

    let tl: any = null

    async function animate() {
      const gsapModule = await import("gsap")
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
      if (tl) tl.kill()
    }
  }, [containerRef, onComplete])

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
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/landing/IntroOverlay.tsx
git commit -m "feat(web): add IntroOverlay with GSAP panel reveal timeline"
```

---

### Task 4: MotionSection component

**Files:**
- Create: `apps/web/components/landing/MotionSection.tsx`

**Interfaces:**
- Consumes: `motion` from `motion/react`
- Produces: `<MotionSection>` wrapper with scroll-triggered animations

- [ ] **Step 1: Create component**

Create `apps/web/components/landing/MotionSection.tsx`:

```tsx
"use client"

import { type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

type Direction = "up" | "left" | "right" | "scale"

interface MotionSectionProps {
  children: ReactNode
  className?: string
  direction?: Direction
  delay?: number
  stagger?: number
}

const directionVariants = {
  up: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  },
  left: {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
  },
}

export function MotionSection({
  children,
  className,
  direction = "up",
  delay = 0,
}: MotionSectionProps) {
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={directionVariants[direction]}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/landing/MotionSection.tsx
git commit -m "feat(web): add MotionSection scroll-triggered animation wrapper"
```

---

### Task 5: Modify Hero.tsx for GSAP text reveal + image scale

**Files:**
- Modify: `apps/web/components/landing/Hero.tsx`

**Interfaces:**
- Consumes: GSAP (dynamic import) for text/image reveal
- Produces: Hero with `.line > span` wrappers and `.hero-image` classes for GSAP targeting

- [ ] **Step 1: Rewrite Hero.tsx**

Replace `apps/web/components/landing/Hero.tsx` with:

```tsx
"use client"

import { useRef, useCallback } from "react"
import Image from "next/image"
import { QrCode, ShieldCheck, Wallet } from "lucide-react"
import { SearchBar } from "../search/search-bar"
import { Badge } from "@/components/ui/badge"
import { IntroOverlay } from "./IntroOverlay"

const trust = [
  { icon: ShieldCheck, label: "Paiement Mobile Money sécurisé" },
  { icon: QrCode, label: "E-billet QR immédiat" },
  { icon: Wallet, label: "Meilleurs prix du jour" },
]

interface HeroProps {
  minPrice?: number
}

export function Hero({ minPrice }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null)
  const animationComplete = useRef(false)

  const handleAnimationComplete = useCallback(() => {
    animationComplete.current = true
  }, [])

  return (
    <section className="relative overflow-hidden bg-background">
      <div
        ref={heroRef}
        className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-20 pt-10 sm:px-6 md:pt-16 lg:grid-cols-12"
      >
        <div className="lg:col-span-6">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-dark">
            Yaoundé ⇄ Douala · quotidien
          </p>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.05] tracking-tighter text-foreground md:text-6xl">
            <div className="line">
              <span>Le bus Yaoundé–Douala,</span>
            </div>
            <div className="line">
              <span>réservé en deux minutes.</span>
            </div>
          </h1>
          <p className="mt-5 max-w-[65ch] text-base leading-relaxed text-muted-foreground md:text-lg">
            Comparez les départs du jour, payez par Mobile Money et recevez votre
            e-billet QR immédiatement.
          </p>

          <div className="relative z-10 mt-8 max-w-xl rounded-2xl border bg-card p-4 shadow-lg shadow-slate-900/5 sm:p-5">
            <SearchBar />
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {trust.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Icon
                  className="h-4 w-4 text-primary-dark"
                  strokeWidth={1.75}
                  aria-hidden
                />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative hidden lg:col-span-6 lg:block">
          <div className="hero-image relative ml-auto aspect-[4/5] w-[78%] overflow-hidden rounded-3xl shadow-xl shadow-slate-900/10">
            <Image
              src="https://picsum.photos/seed/camermove-highway/900/1100"
              alt="Route interurbaine au Cameroun"
              fill
              priority
              sizes="(min-width: 1024px) 42vw, 0vw"
              className="object-cover"
            />
            {minPrice != null && (
              <Badge className="absolute left-4 top-4 bg-secondary font-bold text-secondary-foreground">
                À partir de{" "}
                {new Intl.NumberFormat("fr-CM").format(minPrice)} XAF
              </Badge>
            )}
          </div>
          <div className="hero-image absolute -bottom-6 left-0 aspect-[16/10] w-[46%] rotate-[-4deg] overflow-hidden rounded-2xl border-4 border-white shadow-lg shadow-slate-900/15">
            <Image
              src="https://picsum.photos/seed/camermove-douala/720/450"
              alt="Départ de bus à Douala"
              fill
              loading="lazy"
              sizes="(min-width: 1024px) 24vw, 0vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>

      <IntroOverlay
        onComplete={handleAnimationComplete}
        containerRef={heroRef}
      />
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/landing/Hero.tsx
git commit -m "feat(web): add GSAP text reveal + image scale to Hero with IntroOverlay"
```

---

### Task 6: Update globals.css (body visibility + overlay styles + marker pulse)

**Files:**
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: nothing
- Produces: CSS rules for intro overlay, body visibility, marker pulse

- [ ] **Step 1: Add CSS rules**

Add to `apps/web/app/globals.css` after the `@layer base` block:

```css
/* Body starts hidden — GSAP sets visible after animation */
body {
  visibility: hidden;
}

/* Intro overlay panels */
.intro-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  pointer-events: none;
}

.intro-overlay .overlay-top-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50vh;
  display: flex;
}

.intro-overlay .overlay-bottom-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50vh;
  display: flex;
}

.intro-overlay .overlay-top {
  flex: 1;
  background: hsl(var(--foreground));
}

.intro-overlay .overlay-bottom {
  flex: 1;
  background: hsl(var(--foreground));
}

/* Agency map marker pulse */
@keyframes marker-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.7;
  }
}

.animate-marker-pulse {
  animation: marker-pulse 2s ease-in-out infinite;
}

/* Line span for hero text reveal */
.line {
  overflow: hidden;
}

.line span {
  display: inline-block;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(web): add intro overlay styles, body visibility, marker pulse CSS"
```

---

### Task 7: Update layout.tsx with SmoothScroll

**Files:**
- Modify: `apps/web/app/layout.tsx:43-54`

**Interfaces:**
- Consumes: `<SmoothScroll>` from Task 2
- Produces: Root layout wrapping children with SmoothScroll

- [ ] **Step 1: Add dynamic import and wrap children**

In `apps/web/app/layout.tsx`, add import after line 3:

```tsx
import dynamic from "next/dynamic"
```

Add after the font declarations (after line 9):

```tsx
const SmoothScroll = dynamic(
  () => import("@/components/smooth-scroll").then((m) => m.SmoothScroll),
  { ssr: false }
)
```

Replace the `<body>` content (lines 46-52) with:

```tsx
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SmoothScroll>
          <QueryProvider>{children}</QueryProvider>
        </SmoothScroll>
      </body>
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web): wrap layout with SmoothScroll for Lenis"
```

---

### Task 8: Update page.tsx with MotionSection wrappers

**Files:**
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `<MotionSection>` from Task 4
- Produces: Page with scroll-triggered animations on each section

- [ ] **Step 1: Add imports and wrap sections**

In `apps/web/app/page.tsx`, add import after line 10:

```tsx
import { MotionSection } from "@/components/landing/MotionSection"
```

Wrap sections with MotionSection. Replace the sections from line 73 to 121 with:

```tsx
        <Steps />

        <MotionSection>
          <section className="bg-background">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tighter text-foreground md:text-4xl">
                  Vérifiez le prix de votre trajet
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                  Entrez votre ville de départ et destination pour voir les prix en temps réel.
                </p>
              </div>
              <div className="mx-auto mt-10 max-w-2xl">
                <PriceSimulator />
              </div>
            </div>
          </section>
        </MotionSection>

        <MotionSection direction="scale">
          <section id="agences" className="bg-background">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tighter text-foreground md:text-4xl">
                    Nos agences partenaires
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Retrouvez les points de départ de nos transporteurs partenaires au Cameroun.
                  </p>
                </div>
              </div>
              <div className="mt-10">
                <Suspense fallback={<Skeleton className="h-[360px] w-full rounded-xl md:h-[420px]" />}>
                  <AgencyMapSection agencies={agencies} />
                </Suspense>
              </div>
              <ul className="sr-only">
                {agencies.map((a) => (
                  <li key={a.id}>
                    <a href={`/results?origin=${encodeURIComponent(a.city ?? "")}&pax=1`}>
                      {a.companyName} — {a.city ?? "Cameroun"}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </MotionSection>

        <NextDepartures trips={trips} />

        <MotionSection>
          <PartnerCta />
        </MotionSection>
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): wrap landing sections with MotionSection scroll animations"
```

---

### Task 9: Steps.tsx token sweep + MotionSection

**Files:**
- Modify: `apps/web/components/landing/Steps.tsx`

**Interfaces:**
- Consumes: `<MotionSection>` from Task 4
- Produces: Steps with semantic tokens + staggered scroll reveal

- [ ] **Step 1: Rewrite Steps.tsx**

Replace `apps/web/components/landing/Steps.tsx` with:

```tsx
"use client"

import { MotionSection } from "./MotionSection"

const steps = [
  {
    num: "01",
    title: "Recherchez",
    body: "Choisissez votre date et comparez les départs disponibles en quelques secondes.",
  },
  {
    num: "02",
    title: "Réservez et payez",
    body: "Sélectionnez vos sièges, payez par Mobile Money ou carte, en toute sécurité.",
  },
  {
    num: "03",
    title: "Voyagez avec votre e-billet",
    body: "Recevez un billet QR sur votre téléphone : présentez-le au contrôle, rien à imprimer.",
  },
]

export function Steps() {
  return (
    <section id="etapes" className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="text-3xl font-bold tracking-tighter text-foreground md:text-4xl">
          Comment ça marche
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-8 border-t border-border pt-10 md:grid-cols-3">
          {steps.map((s, i) => (
            <MotionSection key={s.num} delay={i * 0.15}>
              <div>
                <div className="font-mono text-5xl font-bold text-primary">
                  {s.num}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </MotionSection>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/landing/Steps.tsx
git commit -m "feat(web): add MotionSection stagger to Steps + semantic tokens"
```

---

### Task 10: Add hover micro-interactions to NextDepartures

**Files:**
- Modify: `apps/web/components/landing/NextDepartures.tsx`

**Interfaces:**
- Consumes: `motion` from `motion/react`
- Produces: Trip cards with hover spring animation

- [ ] **Step 1: Add motion import and wrap trip cards**

In `apps/web/components/landing/NextDepartures.tsx`, add import after line 2:

```tsx
import { motion } from "motion/react"
```

Replace the `<Link>` inside the trip map (the card element) with a motion-wrapped version. Find the `trips.map` block and replace the `<Link>` with:

```tsx
              <motion.div
                key={t.id}
                whileHover={{ y: -4, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Link
                  href={`/trips/${t.id}`}
                  className="group block rounded-lg border bg-card p-5 transition-colors hover:border-primary/40 active:scale-[0.99]"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                      {timeFr(t.departureAt)}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary-dark">
                      {priceXaf(t.price)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dateFr(t.departureAt)}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                    <span className="truncate text-muted-foreground">
                      {t.companyName}
                      {t.vehicleTypeInfo ? ` · ${t.vehicleTypeInfo}` : ""}
                    </span>
                    <span className="ml-2 shrink-0 font-medium text-primary-dark group-hover:underline">
                      Réserver
                    </span>
                  </div>
                </Link>
              </motion.div>
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/landing/NextDepartures.tsx
git commit -m "feat(web): add motion hover spring to NextDepartures trip cards"
```

---

### Task 11: Full typecheck + verification

**Files:** none (verification only)

- [ ] **Step 1: Full monorepo typecheck**

Run: `pnpm -r typecheck`
Expected: 0 new errors (pre-existing `apps/api` errors in `admin/`/`transporter/` unchanged)

- [ ] **Step 2: Shared tests**

Run: `cd packages/shared && pnpm vitest run`
Expected: 9/9 pass

- [ ] **Step 3: Dead code scan**

Run: `rg -n "TODO|FIXME" --type ts apps/web/components/landing/ apps/web/components/smooth-scroll.tsx`
Expected: no matches

- [ ] **Step 4: Commit if fixes needed**

```bash
git add -A
git commit -m "chore: verification fixes from full typecheck"
```

---

*Plan written per writing-plans skill. Ready for execution.*
