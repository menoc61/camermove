# Premium UI Design System — CamerMove

> **Goal:** Elevate CamerMove to BlaBlaCar-level quality with Apple-inspired precision. Warm minimal aesthetic, GSAP + Framer Motion as the animation backbone, micro-interactions on every interactive element, mobile-first.

**Reference:** BlaBlaCar (warm, social, trust-focused) with Apple design language (precise typography, smooth motion, generous whitespace).

**Approach:** Design system first, then landing page, then all surfaces.

---

## 1. Design Tokens

### Typography

**Fonts:** Plus Jakarta Sans (headings/display) + Inter (body)

| Role | Font | Weight | Size Range | Tracking |
|------|------|--------|------------|----------|
| Display | Plus Jakarta Sans | 800 | 3rem–5rem | -0.03em |
| H1 | Plus Jakarta Sans | 700 | 2.5rem–4rem | -0.025em |
| H2 | Plus Jakarta Sans | 700 | 1.75rem–2.5rem | -0.02em |
| H3 | Plus Jakarta Sans | 600 | 1.25rem–1.5rem | -0.01em |
| Body | Inter | 400/500 | 1rem | 0 |
| Small | Inter | 400/500 | 0.875rem | 0 |
| Caption | Inter | 500 | 0.75rem | 0.02em |

**Line heights:** Headings 1.1, body 1.6, tight for CTAs 1.2.

### Color System

**Brand:** Teal primary (`#0e9f8f`) + Amber accent (`#f4b607`).

**Neutrals:** Warm-shifted away from cold slate toward blue-grey.

| Token | Purpose | Light | Dark |
|-------|---------|-------|------|
| `--brand` | Primary | `#0e9f8f` | `#12c4b2` |
| `--brand-light` | Hover | `#12c4b2` | `#17d9c7` |
| `--brand-dark` | Pressed | `#0b8274` | `#0e9f8f` |
| `--accent` | CTA | `#f4b607` | `#f4b607` |
| `--accent-dark` | CTA hover | `#e0a506` | `#e0a506` |
| `--surface-0` | Page bg | `#fafbfc` | `#0f1218` |
| `--surface-1` | Card bg | `#ffffff` | `#181d25` |
| `--surface-2` | Elevated | `#f5f7f9` | `#1e242e` |
| `--surface-3` | Hover | `#eef1f4` | `#252c38` |
| `--ink-0` | Primary text | `#1a1d21` | `#f0f2f5` |
| `--ink-1` | Secondary | `#5f6b7a` | `#9ba3b0` |
| `--ink-2` | Tertiary | `#8d99a8` | `#6b7685` |
| `--border` | Borders | `#e8ecf0` | `#2a3240` |
| `--border-focus` | Focus ring | `#0e9f8f` | `#12c4b2` |

### Spacing Scale (4px base)

`0.5(2), 1(4), 1.5(6), 2(8), 3(12), 4(16), 5(20), 6(24), 8(32), 10(40), 12(48), 16(64), 20(80), 24(96), 32(128)`

Apple-style: generous whitespace. Default to more space, not less.

### Shadows (Warm-toned)

| Level | Usage | Value |
|-------|-------|-------|
| `shadow-xs` | Inputs, subtle | `0 1px 2px rgba(0,0,0,0.03)` |
| `shadow-sm` | Small cards | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)` |
| `shadow-md` | Cards, dropdowns | `0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)` |
| `shadow-lg` | Modals, elevated | `0 4px 12px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08)` |
| `shadow-xl` | Hero, featured | `0 8px 24px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.10)` |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 6px | Tags, badges |
| `radius-md` | 10px | Inputs, small cards |
| `radius-lg` | 14px | Cards, buttons |
| `radius-xl` | 20px | Modals, hero images |
| `radius-full` | 9999px | Pills, avatars |

---

## 2. Animation System

### Motion Principles

1. **Purposeful** — every animation communicates state, hierarchy, or spatial relationship
2. **Quick** — 150ms–400ms micro-interactions, 600ms–800ms page transitions
3. **Smooth** — spring physics for natural feel, never linear
4. **Respectful** — `prefers-reduced-motion` disables all non-essential motion

### GSAP Responsibilities

| Pattern | Timing | Easing | Used In |
|---------|--------|--------|---------|
| Page intro overlay | 2.5s total | `power4.out` + `expo.inOut` | Hero load |
| Text line reveal | 1.2s per line | `power3.out`, stagger 0.12s | Hero heading |
| Image scale reveal | 1.0s | `expo.out` | Hero images |
| Counter number tick | 0.8s | `power2.out` | Steps numbers, prices |
| Parallax scroll | Scroll-linked | Scroll-driven | Hero images, backgrounds |
| Hamburger morph | 0.3s | `power2.inOut` | Mobile nav |
| Number flip | 0.5s | `power2.out` | Price changes |

### Framer Motion Responsibilities

| Pattern | Props | Used In |
|---------|-------|---------|
| Scroll fade-in | `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true, margin: "-80px" }}` | All sections |
| Staggered children | `transition={{ staggerChildren: 0.1 }}` | Card grids, lists |
| Hover lift | `whileHover={{ y: -6 }}`, spring `{ stiffness: 400, damping: 25 }` | Cards, buttons |
| Tap scale | `whileTap={{ scale: 0.97 }}` | All interactive elements |
| Layout animation | `layout` + `layoutId` | Tab switches, filters |
| Page transition | `AnimatePresence` + `motion.div` | Route changes |
| Modal enter/exit | `initial={{ opacity: 0, scale: 0.95 }}` | Modals, drawers |
| Input focus | `animate={{ boxShadow: "0 0 0 3px rgba(14,159,143,0.3)" }}` | All inputs |
| Skeleton shimmer | Opacity pulse 0.4 → 0.7 → 0.4 | Loading states |

### Micro-Interaction Catalog

| Element | Interaction | Animation |
|---------|-------------|-----------|
| Button | Hover | Lift y: -2 + shadow increase |
| Button | Tap | Scale 0.97 + darken |
| Button | Loading | Spinner fade-in, text fades out |
| Card | Hover | Lift y: -4 to -8 + shadow expansion |
| Card | Tap | Scale 0.98 |
| Input | Focus | Border color transition + glow ring |
| Input | Error | Shake x: [-8, 8, -6, 6, 0] 0.4s |
| Select | Open | Dropdown slide down + fade 0.2s |
| Link | Hover | Underline slides in from left |
| Nav | Scroll | Background opacity + shadow transition |
| Toast | Enter | Slide from right + fade |
| Toast | Exit | Slide right + fade out |
| Badge | Appear | Scale from 0.8 + fade |
| Price | Change | Number flip (counter) |
| Map marker | Appear | Scale from 0 + bounce spring |
| Map marker | Hover | Scale 1.2 + shadow |
| Search | Submit | Button loading, results fade in |
| Swap button | Click | 180deg rotation |
| Skeleton | Loading | Shimmer pulse |

### Mobile-Specific Animations

| Pattern | Implementation |
|---------|----------------|
| Bottom sheet | Slide up from bottom + backdrop fade |
| Pull-to-refresh | Rubber-band stretch + spinner |
| Swipe gestures | `drag="x"` with `onDragEnd` snap |
| Hamburger menu | Lines morph to X (GSAP) |
| Tab bar | Active indicator slides (spring) |
| Page swipe | `AnimatePresence` direction-aware exit |

---

## 3. Landing Page Sections

### SiteNav

- Scroll-aware: transparent at top → `bg-surface-0/80 backdrop-blur-xl` on scroll
- Mobile: hamburger morphs to X via GSAP, full-screen overlay with staggered link reveal
- Logo: subtle scale-on-hover (0.98 → 1.0) spring
- Nav links: underline slides in from left on hover
- Login button: `whileHover` lift + `whileTap` scale
- Semantic token colors (dark mode ready)

### Hero

- Typography: Plus Jakarta Sans display `text-5xl md:text-7xl font-extrabold tracking-[-0.03em] leading-[1.05]`
- Text reveal: GSAP `y: 100% → 0%` with `skewY: 7deg → 0deg`, stagger 0.12s
- Badge pill: `rounded-full bg-brand/10 text-brand-dark px-4 py-1.5 text-xs font-semibold uppercase tracking-widest`
- Body: Inter 500, `text-ink-1`, max-width 52ch
- Search bar: Elevated card `shadow-md rounded-xl`, focus-within ring animation
- Trust indicators: 3 items, icon + text, fade-in stagger after hero text
- Images: Overlapping composition, parallax on scroll (GSAP), warm shadows, `rounded-2xl`
- Price badge: `bg-accent text-ink-0` with scale-in

### Steps ("Comment ca marche")

- Numbers: Plus Jakarta Sans 800, `text-6xl text-brand/20` watermark
- Icons: Lucide in `rounded-xl bg-brand/10 p-3` container, scale-in with stagger
- Cards: `bg-surface-1 rounded-2xl p-6 shadow-sm`
- Stagger: `staggerChildren: 0.12` on scroll
- Connector: Dashed line between cards on desktop

### PriceSimulator

- Container: `bg-surface-1 rounded-2xl shadow-md p-6`
- Inputs: `rounded-xl border-border bg-surface-2 focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-200`
- Swap button: 180deg rotation on click (GSAP)
- Submit: Loading spinner animation
- Result: Price scale-in, link underline slide
- Autocomplete: `motion.div` slide-down enter

### AgencyMap

- Container: `rounded-2xl overflow-hidden shadow-lg`
- Markers: SVG DivIcon, scale-bounce on appear, pulse on hover
- Popup: `rounded-xl shadow-lg p-4`
- Legend: Floating card with count, fade-in

### NextDepartures

- Cards: `bg-surface-1 rounded-2xl p-5 shadow-sm hover:shadow-md`, `whileHover={{ y: -6 }}` spring
- Time: Plus Jakarta Sans 700, `text-2xl`
- Price: `bg-brand/10 text-brand-dark rounded-full px-3 py-1` scale-in
- Company row: Icon placeholder + name + vehicle type
- "Reserver": Arrow slides right on hover
- Grid: `staggerChildren: 0.08` scroll reveal
- Empty state: Illustrated placeholder

### Partner CTA

- Background: Gradient `brand-dark` → `brand` with noise texture
- Centered content, max-width 640px
- Heading: Plus Jakarta Sans 700, `text-white text-3xl md:text-4xl`
- Button: `bg-accent text-ink-0 rounded-full font-bold px-8 py-3` hover lift + shadow
- Decorative: Floating shapes with GSAP parallax

### SiteFooter

- Background: `bg-ink-0`
- Text: Semantic tokens (`text-surface-2`, `text-surface-3`)
- Columns: Logo + tagline, Product, Company, Legal
- Bottom: Copyright + social icons with hover scale
- Mobile: Single column, accordion sections

---

## 4. Component Patterns

### Buttons

```
Primary:   bg-brand text-white rounded-xl font-semibold px-6 py-3
           hover: lift y:-2 + shadow-md
           tap: scale 0.97
           loading: spinner replace

Secondary: bg-surface-2 text-ink-0 rounded-xl font-semibold px-6 py-3
           hover: bg-surface-3
           tap: scale 0.97

Ghost:     bg-transparent text-ink-1 rounded-xl px-4 py-2
           hover: bg-surface-2

CTA:       bg-accent text-ink-0 rounded-full font-bold px-8 py-3
           hover: lift y:-2 + shadow-lg
```

### Cards

```
Default:   bg-surface-1 rounded-2xl p-6 shadow-sm
           hover: shadow-md + lift y:-4

Featured:  bg-surface-1 rounded-2xl p-6 shadow-md border-brand/20
           hover: shadow-lg + lift y:-6
```

### Inputs

```
Default:   rounded-xl border-border bg-surface-2 px-4 py-3
           focus: ring-2 ring-brand/30 border-brand
           transition: all 0.2s

Error:     border-red-400 + shake animation
```

### Modals

```
Backdrop:  bg-ink-0/50 backdrop-blur-sm
Panel:     bg-surface-1 rounded-2xl shadow-xl p-6
           enter: scale 0.95 → 1 + fade
           exit: scale 1 → 0.95 + fade
```

### Toasts

```
Container: bg-surface-1 rounded-xl shadow-lg p-4
           enter: slide from right + fade
           exit: slide right + fade
```

---

## 5. Mobile-First Considerations

- All touch targets minimum 44x44px
- Bottom sheet pattern for modals on mobile (slide up)
- Swipe gestures on cards where appropriate
- Hamburger nav with full-screen overlay
- Reduced shadow complexity on mobile (performance)
- `will-change: transform` on animated elements
- Passive scroll listeners via Lenis

---

## 6. Files to Modify

### Design System (packages/frontend or apps/web)

| File | Change |
|------|--------|
| `apps/web/app/globals.css` | New tokens, shadow definitions, font imports |
| `apps/web/app/layout.tsx` | Plus Jakarta Sans font import |
| `apps/web/package.json` | No new deps (motion + gsap + lenis already installed) |

### Landing Page Components

| File | Change |
|------|--------|
| `apps/web/components/landing/SiteNav.tsx` | Semantic tokens, scroll-aware, mobile nav |
| `apps/web/components/landing/Hero.tsx` | Typography upgrade, GSAP text reveal, parallax |
| `apps/web/components/landing/Steps.tsx` | Icons, cards, watermark numbers, stagger |
| `apps/web/components/landing/PriceSimulator.tsx` | Input styling, swap animation, result animation |
| `apps/web/components/landing/AgencyMap.tsx` | Marker SVG, popup styling, legend |
| `apps/web/components/landing/NextDepartures.tsx` | Card design, hover spring, company row |
| `apps/web/components/landing/PartnerCta.tsx` | Gradient bg, decorative elements |
| `apps/web/components/landing/SiteFooter.tsx` | Semantic tokens, mobile accordion |
| `apps/web/app/page.tsx` | Section spacing adjustments |

### New Files

| File | Purpose |
|------|---------|
| `apps/web/components/ui/button.tsx` | Redesign with animation variants |
| `apps/web/components/ui/card.tsx` | Redesign with hover/tap animations |
| `apps/web/components/ui/input.tsx` | Redesign with focus animations |
| `apps/web/components/ui/modal.tsx` | New modal with enter/exit animations |
| `apps/web/components/ui/toast.tsx` | New toast with slide animations |
| `apps/web/components/ui/skeleton.tsx` | Shimmer loading skeleton |
| `apps/web/lib/animations.ts` | Shared animation variants/presets |

---

*Design spec complete. Ready for implementation planning.*
