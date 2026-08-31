# Design Spec: Landing Page Animations (Motion + GSAP + Lenis)

**Date:** 2026-08-31
**Author:** agent (brainstorming)
**Status:** Approved — pending `writing-plans`
**Scope:** Three-layer animation system for the CamerMove landing page. Hybrid approach: Framer Motion (`motion`) for component-level, GSAP for timelines/overlays, Lenis for smooth scroll.

---

## 1. Design Read

Reading this as: *premium transport marketplace landing with cinematic reveal, smooth scroll, and scroll-triggered storytelling — agency creative meets startup polish.*

Dials: `DESIGN_VARIANCE: 5 / MOTION_INTENSITY: 4 / VISUAL_DENSITY: 4` — more expressive than before, but still credible for a transport brand. The animations should feel premium but not distract from the commerce flow.

---

## 2. Architecture

### 2.1 New dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `motion` (Framer Motion) | Component animations: scroll reveal, hover, layout, AnimatePresence | `^12.x` |
| `gsap` | Timeline animations: intro overlay, hero text skew, ScrollTrigger | `^3.12` |
| `@studio-freight/lenis` | Smooth scrolling, ScrollTrigger integration | `^1.x` |

All three go in `apps/web/package.json` dependencies.

### 2.2 Lenis setup

**File:** `apps/web/components/smooth-scroll.tsx` (new, client)

- Initialize Lenis in `useEffect`
- Integrate with GSAP ScrollTrigger via `lenis.on('scroll', ScrollTrigger.update)`
- Use `gsap.ticker.add((time) => lenis.raf(time * 1000))` and `gsap.ticker.lagSmoothing(0)`
- Respect `prefers-reduced-motion` — if user prefers reduced motion, skip Lenis init
- Export `<SmoothScroll>` wrapper component

**File:** `apps/web/app/layout.tsx` (modify)

- Wrap children with `<SmoothScroll>` (dynamic import, ssr: false)

### 2.3 Layer A: Intro Overlay (GSAP)

**File:** `apps/web/components/landing/IntroOverlay.tsx` (new, client)

- 6 black panels: 3 `.overlay-top` (each 33.33vw wide, stacked horizontally in top 50vh) + 3 `.overlay-bottom` (each 33.33vw wide, stacked horizontally in bottom 50vh)
- Panels are positioned absolutely, z-index 8, background `hsl(var(--foreground))` (dark in both themes)
- GSAP timeline on mount:
  1. `.overlay-top` panels animate `height: 0` with `expo.inOut`, stagger 0.4s
  2. `.overlay-bottom` panels animate `width: 0` with `expo.inOut`, stagger 0.4s (overlapping)
  3. Hide `.intro-overlay` div
  4. Call `onComplete` callback
- Duration: ~2.5s total

### 2.4 Layer A: Hero Text Reveal (GSAP)

**File:** `apps/web/components/landing/Hero.tsx` (modify)

- Hero `h1` lines wrapped in `<div className="line"><span>...</span></div>` pattern
- After intro overlay completes, GSAP timeline:
  1. `.line span` from `{ y: 100, skewY: 7, opacity: 0 }` → `{ y: 0, skewY: 0, opacity: 1 }` with `power4.out`, stagger `{ amount: 0.3 }`
  2. Hero images (`.hero-image`) from `{ scale: 1.4 }` → `{ scale: 1 }` with `expo.inOut`, stagger
  3. Trust chips fade in
- Body starts with `visibility: hidden`, set to `visible` after GSAP init (prevents FOUC)

### 2.5 Layer B: Scroll-Triggered Sections (Framer Motion)

Each section gets a `<MotionSection>` wrapper component.

**File:** `apps/web/components/landing/MotionSection.tsx` (new, client)

```tsx
// Uses motion.div with whileInView
// Props: children, className, delay?, direction?
// Variants: fade-up (default), fade-left, fade-right, scale-up
// Respects prefers-reduced-motion via useReducedMotion()
```

**Sections to animate:**

| Section | Animation | Stagger |
|---------|-----------|---------|
| `Steps` | Each step card fades up | 0.15s between cards |
| `PriceSimulator` | Container fades up | none (single element) |
| `AgencyMap` | Map container scales from 0.95 → 1 + fade | none |
| `NextDepartures` | Each trip card fades up | 0.1s between cards |
| `PartnerCta` | Full section fades up | none |

### 2.6 Hover micro-interactions (Framer Motion)

| Element | Effect |
|---------|--------|
| Trip cards (NextDepartures) | `whileHover: { y: -4, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }` with spring transition |
| SearchBar button | `whileHover: { scale: 1.02 }` / `whileTap: { scale: 0.98 }` |
| PriceSimulator "Vérifier" button | `whileHover: { scale: 1.03 }` / `whileTap: { scale: 0.97 }` |
| Trust icons | `whileHover: { y: -2 }` with spring |
| Nav links | `whileHover: { y: -1 }` |

### 2.7 AgencyMap marker animation (GSAP)

- Markers use `DivIcon` with a pulse animation CSS keyframe (not GSAP — simpler)
- Add `@keyframes pulse` to globals.css: scale 1 → 1.2 → 1 with opacity fade
- Markers enter with staggered fade-in when map loads

---

## 3. File Structure

### New files

| File | Responsibility |
|------|---------------|
| `apps/web/components/smooth-scroll.tsx` | Lenis + GSAP ScrollTrigger integration |
| `apps/web/components/landing/IntroOverlay.tsx` | 6-panel intro overlay |
| `apps/web/components/landing/MotionSection.tsx` | Scroll-triggered section wrapper |

### Modified files

| File | Change |
|------|--------|
| `apps/web/package.json` | Add `motion`, `gsap`, `@studio-freight/lenis` |
| `apps/web/app/layout.tsx` | Wrap with `<SmoothScroll>`, body visibility |
| `apps/web/components/landing/Hero.tsx` | Line-span wrapper, GSAP text reveal + image scale |
| `apps/web/app/page.tsx` | Add IntroOverlay, wrap sections with MotionSection |
| `apps/web/app/globals.css` | Add marker pulse keyframe, body visibility rule |

---

## 4. Animation Flow

```
Page loads
  → Body visibility: hidden (GSAP sets it)
  → IntroOverlay renders (6 black panels cover screen)
  → GSAP timeline starts:
      1. Hero text spans animate from {y:100, skewY:7} (visible behind panels)
      2. Top panels height → 0 (stagger)
      3. Bottom panels width → 0 (stagger)
      4. IntroOverlay hidden
      5. Hero images scale 1.4 → 1 (stagger)
      6. Body visibility: visible
  → Lenis activates
  → User scrolls:
      - Steps cards fade up (stagger 0.15s)
      - PriceSimulator fades up
      - AgencyMap scales in
      - Trip cards fade up (stagger 0.1s)
      - PartnerCta fades up
```

---

## 5. Reduced Motion

- `useReducedMotion()` from `motion` — if true:
  - Skip Lenis init (native scroll)
  - Skip intro overlay (show content immediately)
  - Skip hero text skew (simple fade instead)
  - Skip scroll-triggered animations (content visible immediately)
  - Skip hover micro-interactions
- Implementation: check `prefers-reduced-motion` in each component's animation logic

---

## 6. Performance

- `motion` components use `transform` and `opacity` only (GPU-accelerated)
- GSAP uses `gsap.set()` for initial states to avoid flash
- Lenis uses `requestAnimationFrame`
- IntroOverlay panels are removed from DOM after animation (`display: none`)
- Images use `loading="lazy"` (already done in Task 8)
- `will-change: transform` on animated elements (auto-managed by motion/GSAP)

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| GSAP + React strict mode double-fire | Use `useLayoutEffect` with cleanup (`tl.kill()`) |
| Lenis + ScrollTrigger desync | Standard integration pattern: `lenis.on('scroll', ScrollTrigger.update)` |
| Flash of unstyled content | Body starts `visibility: hidden`, GSAP sets visible |
| Bundle size increase (~40kB gzipped) | All three libs are tree-shakeable; lazy-load Lenis via dynamic import |
| Mobile performance | Respect `prefers-reduced-motion`; disable Lenis on mobile if needed |

---

*Spec written per brainstorming skill. Awaiting spec self-review and user approval before `writing-plans`.*
