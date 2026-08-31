# Premium UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate CamerMove to BlaBlaCar-level quality with Apple-inspired precision. Warm minimal aesthetic, GSAP + Framer Motion as the animation backbone, micro-interactions on every interactive element, mobile-first.

**Architecture:** Design system first (tokens, components, animation presets), then landing page sections. Each component gets animation variants defined in a shared presets file. GSAP handles intro/text reveals, Framer Motion handles scroll/hover/layout animations.

**Tech Stack:** Plus Jakarta Sans (headings), Inter (body), motion (Framer Motion v13), gsap (v3.15), lenis (v1.3), Next.js 16, React 19, Tailwind v4, shadcn/ui

## Global Constraints

- All animations respect `prefers-reduced-motion` — skip non-essential motion
- Import from `motion/react` (NOT `framer-motion`)
- GSAP dynamically imported (SSR safety)
- `pnpm -r typecheck` must pass after every task
- Semantic tokens only — no hardcoded `slate-*` colors in new code
- Touch targets minimum 44x44px on mobile
- `pnpm -r typecheck` and `pnpm vitest run` must pass at final verification

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `apps/web/lib/animations.ts` | Shared Framer Motion animation presets |
| `apps/web/components/ui/modal.tsx` | Animated modal with backdrop |
| `apps/web/components/ui/toast.tsx` | Animated toast notifications |
| `apps/web/components/ui/skeleton.tsx` | Shimmer loading skeleton |

### Modified files

| File | Change |
|------|--------|
| `apps/web/app/globals.css` | New tokens, shadows, typography scale, font imports |
| `apps/web/app/layout.tsx` | Plus Jakarta Sans font import |
| `apps/web/components/ui/button.tsx` | Animation variants (hover, tap, loading) |
| `apps/web/components/ui/card.tsx` | Hover/tap animations |
| `apps/web/components/ui/input.tsx` | Focus ring animation |
| `apps/web/components/landing/SiteNav.tsx` | Semantic tokens, scroll-aware, mobile nav |
| `apps/web/components/landing/Hero.tsx` | Typography, GSAP text reveal, parallax |
| `apps/web/components/landing/Steps.tsx` | Icons, cards, watermark numbers |
| `apps/web/components/landing/PriceSimulator.tsx` | Input styling, swap animation |
| `apps/web/components/landing/AgencyMap.tsx` | SVG markers, popup styling |
| `apps/web/components/landing/NextDepartures.tsx` | Card design, hover spring |
| `apps/web/components/landing/PartnerCta.tsx` | Gradient bg, decorative elements |
| `apps/web/components/landing/SiteFooter.tsx` | Semantic tokens, mobile accordion |
| `apps/web/app/page.tsx` | Section spacing adjustments |

---

## Tasks

### Task 1: Typography + Design Tokens

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: New CSS tokens, Plus Jakarta Sans font loaded

- [ ] **Step 1: Add Plus Jakarta Sans to layout.tsx**

In `apps/web/app/layout.tsx`, add the font import. Replace the existing font imports:

```tsx
import { Inter, Plus_Jakarta_Sans } from "next/font/google"
```

Replace the font declarations:

```tsx
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700", "800"],
})
```

Update the body className:

```tsx
<body className={cn("font-sans antialiased", inter.variable, plusJakarta.variable, notoSans.variable)}>
```

- [ ] **Step 2: Update globals.css tokens**

Replace the `:root` and `.dark` CSS custom property blocks in `apps/web/app/globals.css` with the new warm-neutral color system. Keep the existing shadcn structure but update values:

```css
@layer base {
  :root {
    --brand: 168 72% 50%;
    --brand-light: 170 76% 54%;
    --brand-dark: 168 65% 43%;
    --accent: 43 95% 50%;
    --accent-dark: 43 85% 44%;
    --surface-0: 210 20% 98%;
    --surface-1: 0 0% 100%;
    --surface-2: 210 16% 96%;
    --surface-3: 210 14% 93%;
    --ink-0: 210 10% 11%;
    --ink-1: 216 10% 43%;
    --ink-2: 215 8% 55%;
    --border: 214 12% 90%;
    --border-focus: 168 72% 50%;
    --radius: 0.75rem;

    --background: 210 20% 98%;
    --foreground: 210 10% 11%;
    --card: 0 0% 100%;
    --card-foreground: 210 10% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 210 10% 11%;
    --primary: 168 72% 50%;
    --primary-foreground: 0 0% 100%;
    --secondary: 43 95% 50%;
    --secondary-foreground: 210 10% 11%;
    --muted: 210 16% 96%;
    --muted-foreground: 216 10% 43%;
    --accent-foreground: 210 10% 11%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --input: 214 12% 90%;
    --ring: 168 72% 50%;
    --chart-1: 168 72% 50%;
    --chart-2: 43 95% 50%;
    --chart-3: 215 8% 55%;
    --chart-4: 210 14% 93%;
    --chart-5: 168 65% 43%;
  }

  .dark {
    --brand: 170 76% 54%;
    --brand-light: 172 80% 58%;
    --brand-dark: 168 72% 50%;
    --accent: 43 95% 50%;
    --accent-dark: 43 85% 44%;
    --surface-0: 215 20% 9%;
    --surface-1: 215 16% 12%;
    --surface-2: 215 14% 15%;
    --surface-3: 215 12% 18%;
    --ink-0: 210 20% 96%;
    --ink-1: 216 10% 60%;
    --ink-2: 215 8% 45%;
    --border: 215 12% 18%;
    --border-focus: 170 76% 54%;
    --radius: 0.75rem;

    --background: 215 20% 9%;
    --foreground: 210 20% 96%;
    --card: 215 16% 12%;
    --card-foreground: 210 20% 96%;
    --popover: 215 16% 12%;
    --popover-foreground: 210 20% 96%;
    --primary: 170 76% 54%;
    --primary-foreground: 215 20% 9%;
    --secondary: 43 95% 50%;
    --secondary-foreground: 215 20% 9%;
    --muted: 215 14% 15%;
    --muted-foreground: 216 10% 60%;
    --accent-foreground: 215 20% 9%;
    --destructive: 0 62% 50%;
    --destructive-foreground: 0 0% 100%;
    --input: 215 12% 18%;
    --ring: 170 76% 54%;
    --chart-1: 170 76% 54%;
    --chart-2: 43 95% 50%;
    --chart-3: 215 8% 45%;
    --chart-4: 215 12% 18%;
    --chart-5: 168 72% 50%;
  }
}
```

- [ ] **Step 3: Add shadow definitions to globals.css**

After the `@layer base` block, add:

```css
@layer utilities {
  .shadow-xs { box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
  .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06); }
  .shadow-md { box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06); }
  .shadow-lg { box-shadow: 0 4px 12px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08); }
  .shadow-xl { box-shadow: 0 8px 24px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.10); }
}
```

- [ ] **Step 4: Add typography utility classes**

```css
@layer utilities {
  .font-display { font-family: var(--font-heading), system-ui, sans-serif; }
  .text-balance { text-wrap: balance; }
  .tracking-tighter { letter-spacing: -0.025em; }
  .tracking-tightest { letter-spacing: -0.03em; }
}
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/layout.tsx
git commit -m "feat(web): design tokens — Plus Jakarta Sans, warm neutrals, shadows"
```

---

### Task 2: Animation Presets

**Files:**
- Create: `apps/web/lib/animations.ts`

**Interfaces:**
- Consumes: `motion` from `motion/react`
- Produces: Shared animation variants for all components

- [ ] **Step 1: Create animation presets**

Create `apps/web/lib/animations.ts`:

```ts
"use client"

import type { Variants, Transition } from "motion/react"

export const ease = [0.25, 0.1, 0.25, 1] as const

export const spring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
}

export const springSoft: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 20,
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease } },
}

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease } },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
}

export const hoverLift = {
  y: -6,
  transition: spring,
}

export const tapScale = {
  scale: 0.97,
  transition: { duration: 0.1 },
}

export const hoverUnderline = {
  hidden: { scaleX: 0, originX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.2, ease } },
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/animations.ts
git commit -m "feat(web): animation presets — fade, spring, stagger, hover"
```

---

### Task 3: Button Component Redesign

**Files:**
- Modify: `apps/web/components/ui/button.tsx`

**Interfaces:**
- Consumes: animation presets from Task 2
- Produces: Button with `whileHover`, `whileTap`, loading state

- [ ] **Step 1: Read current button.tsx**

Read `apps/web/components/ui/button.tsx` to understand the existing structure.

- [ ] **Step 2: Rewrite button.tsx**

Replace with:

```tsx
"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, type HTMLMotionProps } from "motion/react"
import { cn } from "@/lib/utils"
import { spring, tapScale } from "@/lib/animations"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))}>
          {children}
        </Slot>
      )
    }

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        whileHover={disabled || loading ? undefined : { y: -2, transition: spring }}
        whileTap={disabled || loading ? undefined : tapScale}
        {...(props as HTMLMotionProps<"button">)}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </motion.button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/button.tsx
git commit -m "feat(web): Button — animation variants, loading state, warm radii"
```

---

### Task 4: Card + Input Components

**Files:**
- Modify: `apps/web/components/ui/card.tsx`
- Modify: `apps/web/components/ui/input.tsx`

**Interfaces:**
- Consumes: animation presets from Task 2
- Produces: Card with hover lift, Input with focus animation

- [ ] **Step 1: Read current files**

Read `apps/web/components/ui/card.tsx` and `apps/web/components/ui/input.tsx`.

- [ ] **Step 2: Rewrite card.tsx**

Replace with:

```tsx
"use client"

import * as React from "react"
import { motion, type HTMLMotionProps } from "motion/react"
import { cn } from "@/lib/utils"
import { spring } from "@/lib/animations"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { hoverable?: boolean }
>(({ className, hoverable = false, ...props }, ref) => (
  <motion.div
    ref={ref}
    className={cn(
      "rounded-2xl border bg-card text-card-foreground shadow-sm",
      className
    )}
    whileHover={hoverable ? { y: -4, boxShadow: "0 4px 12px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08)" } : undefined}
    transition={hoverable ? spring : undefined}
    {...(props as HTMLMotionProps<"div">)}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("font-heading text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

- [ ] **Step 3: Rewrite input.tsx**

Replace with:

```tsx
"use client"

import * as React from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  const [focused, setFocused] = React.useState(false)

  return (
    <motion.input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-surface-2 px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
        className
      )}
      ref={ref}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
      animate={focused ? { boxShadow: "0 0 0 3px rgba(14,159,143,0.15)" } : { boxShadow: "0 0 0 0px rgba(14,159,143,0)" }}
      transition={{ duration: 0.2 }}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/card.tsx apps/web/components/ui/input.tsx
git commit -m "feat(web): Card hover lift + Input focus glow animation"
```

---

### Task 5: Modal + Toast + Skeleton

**Files:**
- Create: `apps/web/components/ui/modal.tsx`
- Create: `apps/web/components/ui/toast.tsx`
- Create: `apps/web/components/ui/skeleton.tsx`

**Interfaces:**
- Consumes: animation presets from Task 2
- Produces: Modal, Toast, Skeleton components with animations

- [ ] **Step 1: Create modal.tsx**

```tsx
"use client"

import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

function Modal({ open, onClose, children, className }: ModalProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            className="fixed inset-0 bg-ink-0/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              "relative z-50 w-full max-w-lg rounded-2xl bg-surface-1 p-6 shadow-xl",
              className
            )}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function ModalHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-4", className)}>{children}</div>
}

function ModalTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-lg font-heading font-semibold", className)}>{children}</h2>
}

function ModalBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(className)}>{children}</div>
}

function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-6 flex justify-end gap-3", className)}>{children}</div>
}

export { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter }
```

- [ ] **Step 2: Create toast.tsx**

```tsx
"use client"

import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react"

interface Toast {
  id: string
  type: "success" | "error" | "warning" | "info"
  message: string
}

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const styles = {
  success: "border-success/20 bg-success/5",
  error: "border-destructive/20 bg-destructive/5",
  warning: "border-accent/20 bg-accent/5",
  info: "border-brand/20 bg-brand/5",
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = icons[toast.type]
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 shadow-lg bg-surface-1",
                styles[toast.type]
              )}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm flex-1">{toast.message}</p>
              <button
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export { ToastContainer, type Toast }
```

- [ ] **Step 3: Create skeleton.tsx**

```tsx
"use client"

import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean
}

function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("rounded-xl bg-surface-2 overflow-hidden", className)}
      {...props}
    >
      {shimmer && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  )
}

export { Skeleton }
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/modal.tsx apps/web/components/ui/toast.tsx apps/web/components/ui/skeleton.tsx
git commit -m "feat(web): Modal + Toast + Skeleton — animated UI components"
```

---

### Task 6: SiteNav Redesign

**Files:**
- Modify: `apps/web/components/landing/SiteNav.tsx`

**Interfaces:**
- Consumes: Button from Task 3, animation presets from Task 2
- Produces: Scroll-aware nav with mobile hamburger

- [ ] **Step 1: Read current SiteNav.tsx**

Read `apps/web/components/landing/SiteNav.tsx`.

- [ ] **Step 2: Rewrite SiteNav.tsx**

Replace with a full redesign:
- Scroll-aware: transparent at top → `bg-surface-0/80 backdrop-blur-xl` on scroll
- Semantic tokens (no hardcoded slate colors)
- Mobile hamburger that morphs to X via GSAP
- Full-screen overlay menu with staggered link reveal
- Logo with subtle hover scale
- Nav links with underline slide-in
- Login button with hover lift

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/landing/SiteNav.tsx
git commit -m "feat(web): SiteNav — scroll-aware, mobile nav, semantic tokens"
```

---

### Task 7: Hero Redesign

**Files:**
- Modify: `apps/web/components/landing/Hero.tsx`

**Interfaces:**
- Consumes: IntroOverlay (existing), MotionSection (existing)
- Produces: Hero with Plus Jakarta Sans, GSAP text reveal, parallax images

- [ ] **Step 1: Read current Hero.tsx**

Read `apps/web/components/landing/Hero.tsx`.

- [ ] **Step 2: Rewrite Hero.tsx**

Key changes:
- Typography: Plus Jakarta Sans `text-5xl md:text-7xl font-extrabold tracking-[-0.03em] leading-[1.05]`
- Text reveal: GSAP `y: 100% → 0%` with `skewY: 7deg → 0deg`, stagger 0.12s
- Badge: `rounded-full bg-brand/10 text-brand-dark px-4 py-1.5 text-xs font-semibold uppercase tracking-widest`
- Body: Inter 500, `text-ink-1`, max-width 52ch
- Images: Warm shadows, `rounded-2xl`, parallax on scroll
- Trust indicators: Staggered fade-in

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/landing/Hero.tsx
git commit -m "feat(web): Hero — Plus Jakarta Sans, GSAP text reveal, parallax"
```

---

### Task 8: Steps Redesign

**Files:**
- Modify: `apps/web/components/landing/Steps.tsx`

**Interfaces:**
- Consumes: MotionSection from existing, animation presets
- Produces: Steps with icons, cards, watermark numbers, stagger

- [ ] **Step 1: Read current Steps.tsx**

Read `apps/web/components/landing/Steps.tsx`.

- [ ] **Step 2: Rewrite Steps.tsx**

Key changes:
- Numbers: Plus Jakarta Sans 800, `text-6xl text-brand/20` watermark
- Icons: Lucide icons (Search, CreditCard, QrCode) in `rounded-xl bg-brand/10 p-3`
- Cards: `bg-surface-1 rounded-2xl p-6 shadow-sm`
- Stagger: `staggerChildren: 0.12` on scroll

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/landing/Steps.tsx
git commit -m "feat(web): Steps — icons, cards, watermark numbers, stagger"
```

---

### Task 9: PriceSimulator Redesign

**Files:**
- Modify: `apps/web/components/landing/PriceSimulator.tsx`

**Interfaces:**
- Consumes: Input from Task 4, Button from Task 3
- Produces: Simulator with input styling, swap animation, result animation

- [ ] **Step 1: Read current PriceSimulator.tsx**

Read `apps/web/components/landing/PriceSimulator.tsx`.

- [ ] **Step 2: Rewrite PriceSimulator.tsx**

Key changes:
- Container: `bg-surface-1 rounded-2xl shadow-md p-6`
- Inputs: `rounded-xl bg-surface-2 focus:ring-2 focus:ring-brand/30`
- Swap button: 180deg rotation on click (GSAP)
- Submit: Loading spinner animation
- Result: Price scale-in, link underline slide

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/landing/PriceSimulator.tsx
git commit -m "feat(web): PriceSimulator — input styling, swap animation, result"
```

---

### Task 10: AgencyMap Redesign

**Files:**
- Modify: `apps/web/components/landing/AgencyMap.tsx`

**Interfaces:**
- Consumes: existing Leaflet setup
- Produces: Map with SVG markers, styled popups, legend

- [ ] **Step 1: Read current AgencyMap.tsx**

Read `apps/web/components/landing/AgencyMap.tsx`.

- [ ] **Step 2: Rewrite AgencyMap.tsx**

Key changes:
- Container: `rounded-2xl overflow-hidden shadow-lg`
- Markers: SVG DivIcon with brand teal, scale-bounce on appear
- Popup: `rounded-xl shadow-lg p-4`
- Legend: Floating card with count

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/landing/AgencyMap.tsx
git commit -m "feat(web): AgencyMap — SVG markers, styled popups, legend"
```

---

### Task 11: NextDepartures Redesign

**Files:**
- Modify: `apps/web/components/landing/NextDepartures.tsx`

**Interfaces:**
- Consumes: animation presets from Task 2
- Produces: Cards with hover spring, company row, arrow animation

- [ ] **Step 1: Read current NextDepartures.tsx**

Read `apps/web/components/landing/NextDepartures.tsx`.

- [ ] **Step 2: Rewrite NextDepartures.tsx**

Key changes:
- Cards: `bg-surface-1 rounded-2xl p-5 shadow-sm hover:shadow-md`
- Time: Plus Jakarta Sans 700, `text-2xl`
- Price: `bg-brand/10 text-brand-dark rounded-full px-3 py-1` scale-in
- Company row: Icon placeholder + name + vehicle type
- "Reserver": Arrow slides right on hover
- Grid: `staggerChildren: 0.08` scroll reveal

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/landing/NextDepartures.tsx
git commit -m "feat(web): NextDepartures — card design, hover spring, company row"
```

---

### Task 12: PartnerCta + SiteFooter

**Files:**
- Modify: `apps/web/components/landing/PartnerCta.tsx`
- Modify: `apps/web/components/landing/SiteFooter.tsx`

**Interfaces:**
- Consumes: Button from Task 3, animation presets from Task 2
- Produces: CTA with gradient bg, Footer with semantic tokens

- [ ] **Step 1: Read current files**

Read `apps/web/components/landing/PartnerCta.tsx` and `apps/web/components/landing/SiteFooter.tsx`.

- [ ] **Step 2: Rewrite PartnerCta.tsx**

Key changes:
- Background: Gradient `brand-dark` → `brand` with noise texture
- Centered content, max-width 640px
- Heading: Plus Jakarta Sans 700, `text-white text-3xl md:text-4xl`
- Button: `bg-accent text-ink-0 rounded-full font-bold px-8 py-3` hover lift

- [ ] **Step 3: Rewrite SiteFooter.tsx**

Key changes:
- Background: `bg-ink-0`
- Text: Semantic tokens (`text-surface-2`, `text-surface-3`)
- Columns: Logo + tagline, Product, Company, Legal
- Bottom: Copyright + social icons with hover scale
- Mobile: Single column

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/landing/PartnerCta.tsx apps/web/components/landing/SiteFooter.tsx
git commit -m "feat(web): PartnerCta gradient + SiteFooter semantic tokens"
```

---

### Task 13: Page Integration

**Files:**
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: all redesigned sections
- Produces: Updated page with consistent spacing

- [ ] **Step 1: Read current page.tsx**

Read `apps/web/app/page.tsx`.

- [ ] **Step 2: Update section spacing**

Ensure consistent spacing between sections:
- Hero: no top padding (handled internally)
- Steps: `py-16 md:py-24`
- PriceSimulator: `py-16 md:py-24`
- AgencyMap: `py-16 md:py-24`
- NextDepartures: `py-16 md:py-24`
- PartnerCta: no padding (full-width)

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): page spacing consistency"
```

---

### Task 14: Full Verification

**Files:** none (verification only)

- [ ] **Step 1: Full monorepo typecheck**

Run: `pnpm -r typecheck`
Expected: 0 new errors (pre-existing `apps/api` errors unchanged)

- [ ] **Step 2: Shared tests**

Run: `cd packages/shared && pnpm vitest run`
Expected: 9/9 pass

- [ ] **Step 3: Dead code scan**

Run: `rg -n "TODO|FIXME" --type ts apps/web/components/landing/ apps/web/components/ui/ apps/web/lib/animations.ts`
Expected: no matches

- [ ] **Step 4: Visual verification**

Start dev server and verify:
- Landing page loads with intro animation
- All sections render with new design
- Mobile nav works
- Dark mode works
- All micro-interactions functional

---

*Plan written per writing-plans skill. Ready for execution.*
