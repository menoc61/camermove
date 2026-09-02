# CamerMove UI Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update dark mode color scheme for better contrast, add GSAP entrance animations to auth pages, add sonner toasts for user feedback, and add motion micro-interactions to all buttons across the app.

**Architecture:** Modify CSS custom properties for warmer dark mode, enhance `AnimatedAuthWrapper` and `AuthForm` with GSAP timelines and sonner toasts, add GSAP entrance animations to `ApplyWizard`, and wrap all interactive buttons with `motion` micro-interactions. Toaster component added to root layout.

**Tech Stack:** Tailwind CSS v4 (CSS custom properties), GSAP 3.15 (dynamic import pattern), Motion/React 13.1 (`motion`, `AnimatePresence`), Sonner 2.0 (`toast`), Next.js 16 App Router.

## Global Constraints

- All GSAP usage must gate on `useReducedMotion()` from `motion/react` — no animations for reduced-motion users
- GSAP must be dynamically imported (`await import("gsap")`) — consistent with existing codebase pattern
- No new dependencies — all libraries already in `package.json`
- Follow existing code style: no comments, `motion/react` imports (not `framer-motion`), shadcn UI components
- `sonner` toast is already used in admin components — same import pattern: `import { toast } from "sonner"`
- Micro-interaction pattern: `whileHover={{ scale: 1.02 }}`, `whileTap={{ scale: 0.97 }}`, `transition={{ type: "spring", stiffness: 400, damping: 25 }}`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/app/globals.css` | Modify | Dark mode color updates |
| `apps/web/app/layout.tsx` | Modify | Add `<Toaster />` to root layout |
| `apps/web/components/auth/AnimatedAuthWrapper.tsx` | Modify | GSAP staggered entrance timeline |
| `apps/web/components/auth/AuthForm.tsx` | Modify | Sonner toasts + button micro-interactions |
| `apps/web/components/partner/ApplyWizard.tsx` | Modify | GSAP entrance + toasts + button micro-interactions |
| `apps/web/components/admin/AdminLoginForm.tsx` | Modify | Button micro-interactions |
| `apps/web/components/booking/recap.tsx` | Modify | Button micro-interactions |
| `apps/web/app/results/page.tsx` | Modify | Button micro-interactions on pagination + filter clear |
| `apps/web/components/dashboard/Dashboard.tsx` | Modify | Button micro-interactions on retry |

---

### Task 1: Update dark mode color scheme in globals.css

**Files:**
- Modify: `apps/web/app/globals.css:108-147`

**Interfaces:** None — pure CSS changes, no downstream dependencies.

- [ ] **Step 1: Update dark mode CSS custom properties**

Replace the `.dark` block (lines 108–147) with updated values. The specific changes:

```css
.dark {
    --brand: 170 76% 54%;
    --brand-light: 172 80% 58%;
    --brand-dark: 168 72% 50%;
    --accent: 43 95% 50%;
    --accent-dark: 43 85% 44%;
    --surface-0: 215 20% 11%;
    --surface-1: 215 16% 14%;
    --surface-2: 215 14% 17%;
    --surface-3: 215 12% 20%;
    --ink-0: 210 20% 96%;
    --ink-1: 215 10% 60%;
    --ink-2: 215 8% 45%;
    --border: 214 15% 25%;
    --border-focus: 170 76% 54%;
    --radius: 0.75rem;

    --background: 215 20% 12%;
    --foreground: 210 20% 96%;
    --card: 215 16% 15%;
    --card-foreground: 210 20% 96%;
    --popover: 215 16% 15%;
    --popover-foreground: 210 20% 96%;
    --primary: 170 76% 54%;
    --primary-foreground: 215 20% 9%;
    --secondary: 43 95% 50%;
    --secondary-foreground: 215 20% 9%;
    --muted: 215 14% 17%;
    --muted-foreground: 215 10% 60%;
    --accent-foreground: 215 20% 9%;
    --destructive: 0 62% 50%;
    --destructive-foreground: 0 0% 100%;
    --input: 214 15% 25%;
    --ring: 170 76% 54%;
    --chart-1: 170 76% 54%;
    --chart-2: 43 95% 50%;
    --chart-3: 215 8% 45%;
    --chart-4: 215 12% 20%;
    --chart-5: 168 72% 50%;
}
```

- [ ] **Step 2: Verify no visual regressions**

Run: `pnpm --filter @camermove/web typecheck`
Expected: PASS (CSS-only changes, no type errors)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "fix: warmer dark mode colors with better contrast"
```

---

### Task 2: Add Toaster to root layout

**Files:**
- Modify: `apps/web/app/layout.tsx:55-68`

**Interfaces:**
- Consumes: `Toaster` from `@/components/ui/sonner`
- Produces: Sonner toast notifications available app-wide via `toast()` calls

- [ ] **Step 1: Import and render Toaster in layout**

In `apps/web/app/layout.tsx`, add the import and render the component inside the `<body>`:

```tsx
import { Toaster } from "@/components/ui/sonner"
```

Place `<Toaster />` as the last child inside `<body>`, after `<SmoothScroll>`:

```tsx
<body>
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
  />
  <SmoothScroll>
    <QueryProvider>{children}</QueryProvider>
  </SmoothScroll>
  <Toaster />
</body>
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @camermove/web typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat: add sonner Toaster to root layout"
```

---

### Task 3: GSAP entrance animations in AnimatedAuthWrapper

**Files:**
- Modify: `apps/web/components/auth/AnimatedAuthWrapper.tsx`

**Interfaces:**
- Consumes: `useReducedMotion` from `motion/react`, dynamic `import("gsap")`
- Produces: Staggered entrance animation for auth pages (title → subtitle → form card)

- [ ] **Step 1: Add GSAP timeline with staggered entrance**

Replace the entire `AnimatedAuthWrapper` component with:

```tsx
"use client"

import { useRef, useEffect } from "react"
import { motion, useReducedMotion } from "motion/react"

export function AnimatedAuthWrapper({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldReduce = useReducedMotion()

  useEffect(() => {
    if (shouldReduce) return
    let killed = false
    let ctx: ReturnType<typeof import("gsap").default.context> | null = null

    async function init() {
      const { default: gsap } = await import("gsap")
      if (killed || !containerRef.current) return

      ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

        tl.from(containerRef.current!, {
          opacity: 0,
          y: 24,
          duration: 0.5,
        })
          .from(
            containerRef.current!.querySelector("[data-auth-title]"),
            { opacity: 0, y: 12, duration: 0.4 },
            "-=0.3"
          )
          .from(
            containerRef.current!.querySelector("[data-auth-subtitle]"),
            { opacity: 0, y: 8, duration: 0.35 },
            "-=0.2"
          )
          .from(
            containerRef.current!.querySelector("[data-auth-card]"),
            { opacity: 0, y: 16, scale: 0.98, duration: 0.45 },
            "-=0.2"
          )
      }, containerRef)
    }

    init()
    return () => {
      killed = true
      ctx?.revert()
    }
  }, [shouldReduce])

  return (
    <div
      ref={containerRef}
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 px-4 py-10"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1
            data-auth-title
            className="text-3xl font-bold tracking-tighter"
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              data-auth-subtitle
              className="mt-2 text-sm text-muted-foreground"
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        <div
          data-auth-card
          className="rounded-2xl border bg-card p-6 shadow-sm md:p-8"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @camermove/web typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/auth/AnimatedAuthWrapper.tsx
git commit -m "feat: add GSAP staggered entrance to auth wrapper"
```

---

### Task 4: Sonner toasts + button micro-interactions in AuthForm

**Files:**
- Modify: `apps/web/components/auth/AuthForm.tsx`

**Interfaces:**
- Consumes: `toast` from `sonner`, `motion` from `motion/react` (already imported)
- Produces: Toast notifications on login/register success/failure; hover/tap micro-interactions on submit button

- [ ] **Step 1: Add toast import and micro-interactions**

Add `import { toast } from "sonner"` after the existing imports (line 6 area).

In the `submit` function, after `setAuth(...)` (line 73), add:
```tsx
toast.success(mode === "login" ? "Connexion réussie !" : "Compte créé !")
```

In the catch block, after `setError(...)` (line 76-82), add:
```tsx
toast.error(err instanceof ApiError ? (err.status === 401 ? "E-mail ou mot de passe incorrect." : err.message) : "Une erreur est survenue. Réessayez.")
```

For the submit button (line 201-214), add `whileHover` alongside the existing `whileTap`:

```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
>
  <Button
    type="submit"
    className="w-full rounded-full"
    disabled={submitting}
    loading={submitting}
  >
    {submitting
      ? "Un instant…"
      : mode === "login"
        ? "Se connecter"
        : "Créer mon compte"}
  </Button>
</motion.div>
```

The full AuthForm.tsx after changes:

```tsx
"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { useAuthStore } from "@camermove/frontend"
import { ApiError } from "../../lib/api/client"
import { login, register } from "../../lib/api/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"

interface Props {
  mode: "login" | "register"
  next?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthForm({ mode, next }: Props) {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [touched, setTouched] = useState({ email: false, password: false })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const emailInvalid = touched.email && email.length > 0 && !EMAIL_RE.test(email)
  const emailRequired = touched.email && email.length === 0
  const emailError = emailInvalid ? "Adresse e-mail invalide." : emailRequired ? "L'e-mail est requis." : null

  const passwordInvalid = touched.password && password.length > 0 && password.length < 8
  const passwordRequired = touched.password && password.length === 0
  const passwordError = passwordInvalid
    ? "Le mot de passe doit contenir au moins 8 caractères."
    : passwordRequired
      ? "Le mot de passe est requis."
      : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ email: true, password: true })
    setError(null)
    if (!EMAIL_RE.test(email)) {
      setError("Adresse e-mail invalide.")
      return
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }
    setSubmitting(true)
    try {
      const res =
        mode === "login"
          ? await login(email, password)
          : await register({
              email,
              password,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
            })
      setAuth({ accessToken: res.accessToken, user: res.user })
      toast.success(mode === "login" ? "Connexion réussie !" : "Compte créé !")
      router.push(next && next.startsWith("/") ? next : "/dashboard")
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? "E-mail ou mot de passe incorrect."
            : err.message
          : "Une erreur est survenue. Réessayez."
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4" noValidate>
      <FieldGroup>
        {mode === "register" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <Field>
              <FieldLabel htmlFor="firstName">Prénom</FieldLabel>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                placeholder="Ex. Paul"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lastName">Nom</FieldLabel>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                placeholder="Ex. Biya"
              />
            </Field>
          </motion.div>
        )}

        <Field data-invalid={!!emailError || undefined}>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            type="email"
            required
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "email-error" : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, email: true }))}
            autoComplete="email"
            placeholder="vous@exemple.cm"
            className={cn(emailError && "border-destructive focus-visible:ring-destructive")}
          />
          <AnimatePresence>
            {emailError ? (
              <motion.p
                id="email-error"
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                className="text-sm text-destructive"
                role="alert"
              >
                {emailError}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </Field>

        <Field data-invalid={!!passwordError || undefined}>
          <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? "password-error" : "password-hint"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, password: true }))}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className={cn(passwordError && "border-destructive focus-visible:ring-destructive")}
          />
          <AnimatePresence>
            {passwordError ? (
              <motion.p
                id="password-error"
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                className="text-sm text-destructive"
                role="alert"
              >
                {passwordError}
              </motion.p>
            ) : mode === "register" && !passwordError ? (
              <FieldDescription id="password-hint">8 caractères minimum.</FieldDescription>
            ) : null}
          </AnimatePresence>
        </Field>

        <AnimatePresence>
          {error ? (
            <motion.p
              key={error}
              initial={{ opacity: 0, scale: 0.98, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -6 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              role="alert"
              aria-live="assertive"
              className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={submitting}
            loading={submitting}
          >
            {submitting
              ? "Un instant…"
              : mode === "login"
                ? "Se connecter"
                : "Créer mon compte"}
          </Button>
        </motion.div>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              Pas encore de compte&nbsp;?{" "}
              <Link
                href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Créer un compte
              </Link>
            </>
          ) : (
            <>
              Déjà inscrit&nbsp;?{" "}
              <Link
                href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Se connecter
              </Link>
            </>
          )}
        </p>
      </FieldGroup>
    </form>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @camermove/web typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/auth/AuthForm.tsx
git commit -m "feat: add sonner toasts and button micro-interactions to AuthForm"
```

---

### Task 5: GSAP animations + toasts + micro-interactions in ApplyWizard

**Files:**
- Modify: `apps/web/components/partner/ApplyWizard.tsx`

**Interfaces:**
- Consumes: `useReducedMotion` from `motion/react`, `toast` from `sonner`, `motion` from `motion/react`, dynamic `import("gsap")`
- Produces: Staggered entrance on wizard steps, toasts on step transitions and final submission, button micro-interactions

- [ ] **Step 1: Rewrite ApplyWizard with GSAP + toasts + micro-interactions**

Full replacement:

```tsx
"use client"
/**
 * ApplyWizard — formulaire en 3 étapes « Devenir partenaire transporteur ».
 * Étape 1 : infos entreprise · Étape 2 : documents (présignature puis PUT
 * direct vers MinIO via DocumentsStep) · Étape 3 : récapitulatif + envoi,
 * puis carte de statut via GET /partner-applications/me.
 */
import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { toast } from "sonner"
import {
  getMyApplication,
  presignDocument,
  submitApplication,
  uploadToPresigned,
  type DocumentType,
  type MyApplication,
} from "../../lib/api/partner"
import { DocumentsStep } from "./DocumentsStep"
import { StatusCard } from "./StatusCard"
import {
  DOC_TYPES,
  EMPTY_DOCS,
  EMPTY_FORM,
  Field,
  MAX_DOC_BYTES,
  MIME_OK,
  validateCompany,
  type FormState,
} from "./form-core"

export function ApplyWizard({ token }: { token: string }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [docs, setDocs] = useState(EMPTY_DOCS)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [details, setDetails] = useState<MyApplication | null>(null)
  const stepRef = useRef<HTMLDivElement>(null)
  const shouldReduce = useReducedMotion()

  const uploaded = DOC_TYPES.filter(({ type }) => docs[type].status === "done")
  const inputCls = (bad?: string) => `mt-1 w-full rounded border px-3 py-2 text-sm ${bad ? "border-red-400" : ""}`

  useEffect(() => {
    if (shouldReduce || !stepRef.current) return
    let killed = false

    async function init() {
      const { default: gsap } = await import("gsap")
      if (killed || !stepRef.current) return

      gsap.from(stepRef.current, {
        opacity: 0,
        y: 16,
        duration: 0.4,
        ease: "power3.out",
      })

      const fields = stepRef.current.querySelectorAll("[data-wizard-field]")
      if (fields.length) {
        gsap.from(fields, {
          opacity: 0,
          y: 10,
          duration: 0.3,
          stagger: 0.04,
          ease: "power2.out",
          delay: 0.1,
        })
      }
    }

    init()
    return () => { killed = true }
  }, [step, shouldReduce])

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
    setFeedback(null)
  }

  async function handleFile(type: DocumentType, file: File | null) {
    setFeedback(null)
    if (!file) return
    if (!MIME_OK.includes(file.type) || file.size < 1 || file.size > MAX_DOC_BYTES) {
      setDocs((d) => ({ ...d, [type]: { status: "error", name: file.name } }))
      return
    }
    setDocs((d) => ({ ...d, [type]: { status: "uploading", name: file.name } }))
    try {
      const { objectKey, uploadUrl } = await presignDocument(token, { type, mimetype: file.type, size: file.size })
      await uploadToPresigned(uploadUrl, file)
      setDocs((d) => ({ ...d, [type]: { status: "done", name: file.name, objectKey, mimetype: file.type, size: file.size } }))
    } catch {
      setDocs((d) => ({ ...d, [type]: { status: "error", name: file.name } }))
    }
  }

  function next() {
    if (step === 1) {
      const e = validateCompany(form)
      setErrors(e)
      if (Object.values(e).some(Boolean)) return
      toast.success("Étape 1 complétée")
      setStep(2)
    } else if (step === 2) {
      if (docs.business_registration.status !== "done") return setFeedback("Le registre de commerce est obligatoire.")
      if (uploaded.length < 1) return setFeedback("Ajoutez au moins un document.")
      toast.success("Étape 2 complétée")
      setStep(3)
    }
  }

  async function submit() {
    setSubmitting(true)
    setFeedback(null)
    try {
      await submitApplication(token, {
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim(),
        phone: form.phone.trim(),
        ...(form.city.trim() && { city: form.city.trim() }),
        ...(form.transportType.trim() && { transportType: form.transportType.trim() }),
        ...(form.vehicleCount.trim() && { vehicleCount: Number(form.vehicleCount.trim()) }),
        routesServed: form.routesServed.split(",").map((r) => r.trim()).filter(Boolean),
        ...(form.message.trim() && { message: form.message.trim() }),
        documents: uploaded.map(({ type }) => ({
          type, objectKey: docs[type].objectKey!, mimetype: docs[type].mimetype!, size: docs[type].size!,
        })),
      })
      try {
        setDetails(await getMyApplication(token))
      } catch {
        // Statut détaillé indisponible : la carte générique reste affichée.
      }
      setSent(true)
      toast.success("Demande envoyée avec succès !")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'envoi de la demande."
      setFeedback(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return <StatusCard details={details} fallbackCompanyName={form.companyName} routesServed={form.routesServed} />
  }

  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-4 text-xs text-muted-foreground">
        {["Entreprise", "Documents", "Récapitulatif"].map((label, i) => (
          <li key={label} className={step === i + 1 ? "font-semibold text-primary" : ""}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {feedback && <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">{feedback}</div>}

      {step === 1 && (
        <div ref={stepRef} className="space-y-3 rounded-xl border p-3">
          <Field data-wizard-field label="Nom de l'entreprise *" error={errors.companyName}>
            <input className={inputCls(errors.companyName)} placeholder="ex: Transports Unis SARL" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} aria-invalid={!!errors.companyName} />
          </Field>
          <Field data-wizard-field label="Nom du contact *" error={errors.contactName}>
            <input className={inputCls(errors.contactName)} placeholder="ex: Jean Mbarga" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} aria-invalid={!!errors.contactName} />
          </Field>
          <Field data-wizard-field label="Téléphone *" error={errors.phone}>
            <input className={inputCls(errors.phone)} placeholder="+2376XXXXXXXX" value={form.phone} onChange={(e) => update("phone", e.target.value)} aria-invalid={!!errors.phone} />
          </Field>
          <Field data-wizard-field label="Ville" error={errors.city}>
            <input className={inputCls(errors.city)} placeholder="ex: Douala" value={form.city} onChange={(e) => update("city", e.target.value)} aria-invalid={!!errors.city} />
          </Field>
          <Field data-wizard-field label="Type de transport" error={errors.transportType}>
            <input className={inputCls(errors.transportType)} placeholder="ex: interurbain, fret, tourisme" value={form.transportType} onChange={(e) => update("transportType", e.target.value)} aria-invalid={!!errors.transportType} />
          </Field>
          <Field data-wizard-field label="Nombre de véhicules" error={errors.vehicleCount}>
            <input className={inputCls(errors.vehicleCount)} inputMode="numeric" placeholder="ex: 12" value={form.vehicleCount} onChange={(e) => update("vehicleCount", e.target.value)} aria-invalid={!!errors.vehicleCount} />
          </Field>
          <Field data-wizard-field label="Routes desservies (séparées par des virgules)" error={errors.routesServed}>
            <input className={inputCls(errors.routesServed)} placeholder="ex: Douala-Yaounde, Bafoussam-Dschang" value={form.routesServed} onChange={(e) => update("routesServed", e.target.value)} aria-invalid={!!errors.routesServed} />
          </Field>
          <Field data-wizard-field label="Message (optionnel)" error={errors.message}>
            <textarea rows={3} className={inputCls(errors.message)} placeholder="Presentez votre activite..." value={form.message} onChange={(e) => update("message", e.target.value)} aria-invalid={!!errors.message} />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div ref={stepRef}>
          <DocumentsStep docs={docs} onFile={(t, f) => void handleFile(t, f)} />
        </div>
      )}

      {step === 3 && (
        <div ref={stepRef} className="space-y-2 rounded-xl border p-3 text-sm">
          <p><span className="text-muted-foreground">Entreprise :</span> {form.companyName}</p>
          <p><span className="text-muted-foreground">Contact :</span> {form.contactName} · {form.phone}</p>
          {form.city && <p><span className="text-muted-foreground">Ville :</span> {form.city}</p>}
          {form.transportType && <p><span className="text-muted-foreground">Type de transport :</span> {form.transportType}</p>}
          {form.vehicleCount && <p><span className="text-muted-foreground">Véhicules :</span> {form.vehicleCount}</p>}
          {form.routesServed && (
            <p><span className="text-muted-foreground">Routes desservies :</span> {form.routesServed.split(",").map((r) => r.trim()).filter(Boolean).join(", ") || "—"}</p>
          )}
          {form.message && <p><span className="text-muted-foreground">Message :</span> {form.message}</p>}
          <div>
            <p className="text-muted-foreground">Documents :</p>
            <ul className="list-disc pl-5">
              {uploaded.map(({ type, label }) => (
                <li key={type}>{label} — {docs[type].name} ({Math.round((docs[type].size ?? 0) / 1024)} Ko)</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
          <button type="button" onClick={() => setStep(step - 1)} disabled={step === 1} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">
            <ChevronLeft className="mr-1 inline h-4 w-4" />Retour
          </button>
        </motion.div>
        {step < 3 ? (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
            <button type="button" onClick={next} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
              Continuer<ChevronRight className="ml-1 inline h-4 w-4" />
            </button>
          </motion.div>
        ) : (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
            <button type="button" onClick={() => void submit()} disabled={submitting} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {submitting ? "Envoi…" : "Envoyer la demande"}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @camermove/web typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/partner/ApplyWizard.tsx
git commit -m "feat: GSAP entrance, toasts, and micro-interactions for ApplyWizard"
```

---

### Task 6: Button micro-interactions in AdminLoginForm

**Files:**
- Modify: `apps/web/components/admin/AdminLoginForm.tsx:150-152`

**Interfaces:** None — wraps existing Button component with motion.

- [ ] **Step 1: Add motion wrapper around submit button**

Replace line 150-152:

```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
>
  <Button type="submit" className="w-full rounded-full" disabled={submitting} loading={submitting}>
    {submitting ? "Un instant…" : "Accéder à la console"}
  </Button>
</motion.div>
```

Also update the feedback alert border (line 143) from `border border-red-900` to `border border-destructive/20` for consistency with the new color scheme.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @camermove/web typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/AdminLoginForm.tsx
git commit -m "feat: button micro-interactions for AdminLoginForm"
```

---

### Task 7: Button micro-interactions in booking Recap

**Files:**
- Modify: `apps/web/components/booking/recap.tsx:83-85`

**Interfaces:** None — wraps existing Button.

- [ ] **Step 1: Add motion import and wrapper**

Add `import { motion } from "motion/react"` after line 1 imports.

Replace line 83-85:

```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
>
  <Button onClick={submit} disabled={loading || !token || invalidPassengers || phoneInvalid} className="w-full rounded-full">
    {loading ? "Réservation…" : "Confirmer la réservation"}
  </Button>
</motion.div>
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @camermove/web typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/booking/recap.tsx
git commit -m "feat: button micro-interactions for booking Recap"
```

---

### Task 8: Button micro-interactions in results page

**Files:**
- Modify: `apps/web/app/results/page.tsx:140-155, 186-206`

**Interfaces:** None — wraps existing Button components.

- [ ] **Step 1: Add motion import**

Add `import { motion } from "motion/react"` in the imports section (after line 1 or near the other imports).

- [ ] **Step 2: Wrap "Réinitialiser" button (line 140-155)**

```tsx
{(sortBy !== "price_asc" || minPrice !== undefined || maxPrice !== undefined) && (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.97 }}
    transition={{ type: "spring", stiffness: 400, damping: 25 }}
  >
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      onClick={() => {
        const next = new URLSearchParams(sp.toString())
        next.delete("sortBy")
        next.delete("minPrice")
        next.delete("maxPrice")
        next.delete("page")
        router.push(`${pathname}?${next.toString()}`, { scroll: false })
      }}
    >
      Réinitialiser
    </Button>
  </motion.div>
)}
```

- [ ] **Step 3: Wrap pagination buttons (lines 186-206)**

```tsx
<div className="flex items-center gap-2">
  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
    <Button
      variant="outline"
      size="icon"
      disabled={page <= 1}
      onClick={() => goTo(page - 1)}
      aria-label="Page précédente"
    >
      <ChevronLeft className="size-4" />
    </Button>
  </motion.div>
  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
    <Button
      variant="outline"
      size="icon"
      disabled={page >= totalPages}
      onClick={() => goTo(page + 1)}
      aria-label="Page suivante"
    >
      <ChevronRight className="size-4" />
    </Button>
  </motion.div>
</div>
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @camermove/web typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/results/page.tsx
git commit -m "feat: button micro-interactions for results page"
```

---

### Task 9: Button micro-interactions in Dashboard retry

**Files:**
- Modify: `apps/web/components/dashboard/Dashboard.tsx:60-62`

**Interfaces:** None — wraps existing Button.

- [ ] **Step 1: Add motion import**

Add `import { motion } from "motion/react"` in the imports section.

- [ ] **Step 2: Wrap retry button**

Replace line 60-62:

```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
  className="w-fit"
>
  <Button variant="outline" size="sm" onClick={() => refetch()} className="w-fit">
    Réessayer
  </Button>
</motion.div>
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @camermove/web typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/dashboard/Dashboard.tsx
git commit -m "feat: button micro-interactions for Dashboard retry"
```

---

### Task 10: Final verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm --filter @camermove/web typecheck`
Expected: PASS

- [ ] **Step 2: Lint**

Run: `pnpm --filter @camermove/web lint`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 3: Visual check**

Run: `pnpm --filter @camermove/web dev`
Open http://localhost:3001 in browser, verify:
- Dark mode: warmer background, visible borders, readable muted text
- Login page: GSAP staggered entrance animation plays
- Register page: same animation, toast on success
- Partner apply: wizard steps animate, toasts on step completion
- All buttons: subtle scale on hover/tap
- Reduced motion: no animations when system preference is set
