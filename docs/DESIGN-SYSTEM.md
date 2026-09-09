# CamerMove — Design System

> Swiss / Bauhaus minimalism. Helvetica-style typography. Cool gray, pure white, natural wood. Hairline rules, zero radius, no shadows, numbered section heads.

## 1. Direction

The CamerMove brand is a **multi-service mobility platform for Cameroon** — transport interurbain is the hero, but hotels, rentals, colis, assurance, and billetterie are all first-class. The visual language reflects that seriousness:

- **Swiss** — 1560px content rail, 12-col grid, generous whitespace, hairlines
- **Bauhaus** — geometric primitives, primary palette limited to ink/paper/wood, function over decoration
- **Helvetica** — neutral, legible, calm; the work is the content

We do **not** use: gradients, glow shadows, rounded corners (`--radius: 0`), cobalt CamerMove blue, icon-everywhere, or glassmorphism.

## 2. Color tokens

Source of truth: `apps/web/app/globals.css` (Next.js) and `dist/assets/css/main.css` (static deploy).

| Token | Hex | Use |
|-------|-----|-----|
| `--ink` | `#0E0E0E` | Primary text, primary buttons, dark sections |
| `--ink-1` | `#2A2A2A` | Secondary ink |
| `--ink-2` | `#6B6B6B` | Cool gray — muted text, labels |
| `--paper` | `#F5F4F1` | Warm off-white — page background |
| `--surface-1` | `#FFFFFF` | Pure white card |
| `--surface-2` | `#ECEAE5` | Light stone — hover, alternate |
| `--surface-3` | `#DCD9D2` | Mid stone — dividers (filled) |
| `--line` | `#D8D4CC` | Hairlines, table borders |
| `--wood` | `#B89B7B` | Accent — price tags, badge outlines |
| `--wood-dark` | `#6F5638` | Deep wood — emphasized accent text |
| `--wood-light` | `#DCC6A8` | Light wood — background tints (rare) |
| `--stone` | `#8C8A85` | Cool stone — secondary accents |

> Use wood tones **sparingly** — they should draw the eye to a price, a tag, or a key moment, not blanket the page.

## 3. Typography

| Level | Size | Weight | Tracking | Use |
|-------|------|--------|----------|-----|
| Eyebrow | 11px | 500 | 0.22em uppercase | Section labels (`02 — Processus`) |
| Display | clamp(2.4rem, 7vw, 6.4rem) | 500 | -0.035em | Hero h1 |
| H2 | clamp(2rem, 3.6vw, 3.2rem) | 500 | -0.025em | Section titles |
| H3 | 20–24px | 500 | -0.02em | Sub-section / card titles |
| Body | 15–16px | 400 | normal | Paragraphs |
| Mono (numbers) | inherit | 500 | 0 | Prices, counters, time — `.num-tabular` |

Font stack: `Inter, "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`. Inter is the web analogue; Helvetica Neue wins on macOS, Arial on Windows.

## 4. Grid

- 12 columns
- 24px gutter (default), collapses to 16px on mobile
- Outer margin: 24px mobile · 32px tablet · 48px desktop
- Max content width: **1560px** (desktop-first)
- Breakpoints:
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px
  - `2xl`: 1560px

## 5. Components

### Button

```tsx
<Button className="bg-ink text-paper px-7 py-6 text-[12px] font-medium uppercase tracking-[0.22em] hover:bg-ink-1">
  Réserver un trajet
</Button>
```

- Square corners
- Single color fill (ink or paper for ghost)
- 0.22em tracking, uppercase
- Underline grows on hover for text-only CTAs (`<span class="block h-px w-8 group-hover:w-14" />`)

### Section

```tsx
<section className="section section-pad">
  <div className="container">
    <div className="section-head">
      <div>
        <p className="eyebrow">04 — Services</p>
        <h2>...</h2>
      </div>
      <p>...</p>
    </div>
  </div>
</section>
```

`.section` = `border-top: 1px solid var(--line); background: var(--paper)`.
`.section--ink` = dark variant (Partner CTA, footer).
`.section-pad` = 80px / 112px top-bottom.

### Service card (bento)

```tsx
<Link className="svc svc--hero svc--ink"> {/* hero variant */}
  <div className="svc__head">
    <span className="svc__n">01 · Produit héros</span>
    <span className="svc__line" />
  </div>
  <div className="svc__art">{/* SVG or image */}</div>
  <div className="svc__body">
    <h3>Transport interurbain</h3>
    <p>...</p>
    <span className="svc__cta">Réserver un bus <span className="svc__cta-line" /></span>
  </div>
</Link>
```

### Horizontal video reel

Used on the landing hero. 5 chapters, scroll-driven, full-width, ~76vh tall. See `dist/assets/js/main.js` for the scroll-driven progress + active chapter tracking.

## 6. Motion

| Token | Value |
|-------|-------|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` |
| `--duration-fast` | 160ms |
| `--duration-base` | 280ms |

- **Never** animate `box-shadow`, `background-color` on large surfaces, or anything that triggers layout
- **Prefer** transforms (translate, scale, rotate) and opacity
- Reveal animations use `.reveal` + `.is-visible` (IntersectionObserver in `main.js`)
- `prefers-reduced-motion: reduce` → all motion collapses to 0.01ms

## 7. Accessibility

- All interactive elements have a visible focus ring (`outline-ring/40`)
- All images have `alt` (decorative images use `alt=""` + `aria-hidden`)
- All form fields have associated `<label>`
- Section landmarks: `<header>`, `<nav>`, `<main>`, `<section aria-label>`, `<footer>`
- Color contrast: ink on paper is 16.5:1, ink-2 on paper is 4.9:1
- Reduced motion respected
- Touch targets ≥ 44×44px (apply `min-h-[44px] min-w-[44px]` on icon-only buttons)

## 8. Mobile responsive

- **Mobile-first** breakpoints (`sm` → `md` → `lg` → `xl`)
- The horizontal video reel degrades to vertical scrolling on `< 768px` is **not** done — the reel is intentionally desktop-only; mobile shows the poster of the active chapter instead, controlled by JS
- Top-of-page grid (`.grid-12`) collapses to single-column on `< 768px`
- All CTAs have a full-width variant for mobile (`.w-full`)
- The hamburger nav overlay is full-screen on mobile, two-column on desktop

## 9. Where to use each

| Use case | File |
|----------|------|
| Next.js app (full CamerMove web) | `apps/web/app/globals.css` + `apps/web/components/landing/*` |
| Standalone static landing (deploy) | `dist/index.html` + `dist/assets/css/main.css` |
| Figma / design tokens | This file (single source of truth) |

If a color or spacing differs between Next.js and the static deploy, the static deploy is the reference. Update both.
