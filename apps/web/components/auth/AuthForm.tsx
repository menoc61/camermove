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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { PasswordInput } from "./PasswordInput"
import { PasswordStrengthMeter } from "./PasswordStrengthMeter"
import { GoogleButton } from "./GoogleButton"

interface Props {
  mode: "login" | "register"
  next?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@camermove.cm", password: "Admin123!" },
  { label: "Voyageur", email: "user@camermove.cm", password: "User123!" },
  { label: "Partenaire", email: "partner@camermove.cm", password: "Partner123!" },
] as const

export function AuthForm({ mode, next }: Props) {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState(mode === "login" ? "user@camermove.cm" : "")
  const [password, setPassword] = useState(mode === "login" ? "User123!" : "")
  const [firstName, setFirstName] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [lastName, setLastName] = useState("")
  const [touched, setTouched] = useState({ email: false, password: false })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const emailInvalid = touched.email && email.length > 0 && !EMAIL_RE.test(email)
  const emailRequired = touched.email && email.length === 0
  const emailError = emailInvalid ? "Adresse e-mail invalide." : emailRequired ? "L'e-mail est requis." : null

  const passwordInvalid = touched.password && password.length > 0 && password.length < 8;
  const passwordRequired = touched.password && password.length === 0;
  const passwordError = passwordInvalid
    ? "Le mot de passe doit contenir au moins 8 caractères."
    : passwordRequired
      ? "Le mot de passe est requis."
      : null;
  const confirmPasswordError = mode === "register" && confirmTouched && confirmPassword !== password ? "Les mots de passe ne correspondent pas." : null;

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
    if (mode === "register") {
      if (confirmPassword !== password) {
        setError("Les mots de passe ne correspondent pas.")
        return
      }
      if (!termsAccepted) {
        setError("Vous devez accepter les conditions d'utilisation.")
        return
      }
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
      setAuth({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user })
      toast.success(mode === "login" ? "Connexion réussie !" : "Compte créé !")
      router.push(next && next.startsWith("/") ? next : "/dashboard")
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 401
            ? "E-mail ou mot de passe incorrect."
            : err.status === 409
              ? "Un compte existe déjà avec cette adresse e-mail."
              : err.message
          : "Une erreur est survenue. Réessayez."
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4" noValidate>
      {mode === "login" && (
        <div className="rounded-xl border bg-muted/30 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Comptes de démonstration — cliquez pour remplir</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => { setEmail(a.email); setPassword(a.password); setTouched({ email: true, password: true }); setError(null) }}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${email === a.email ? "border-primary bg-primary/10" : "bg-card hover:border-primary/50"}`}
              >
                <span className="block text-xs font-bold">{a.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{a.email}</span>
                <span className="block text-[11px] font-mono">{a.password}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Seed: <code>prisma/seed.ts</code> crée ces 3 comptes (argon2) au premier <code>docker compose up</code>. Mot de passe pré-rempli pour démo.</p>
        </div>
      )}
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
                name="givenName"
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
                name="familyName"
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
            name="email"
            type="email"
            required
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "email-error" : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, email: true }))}
            autoComplete="email"
            inputMode="email"
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
          <div className="flex items-baseline justify-between">
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={8}
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? "password-error" : "password-hint"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, password: true }))}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            hasError={!!passwordError}
            disabled={submitting}
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
              <FieldDescription id="password-hint" className="space-y-1.5">
                <span>8 caractères minimum.</span>
                <PasswordStrengthMeter password={password} />
              </FieldDescription>
            ) : null}
          </AnimatePresence>
        </Field>

        {/* Confirm Password */}
        {mode === "register" && (
          <Field data-invalid={!!confirmPasswordError || undefined}>
            <FieldLabel htmlFor="confirmPassword">Confirmer le mot de passe</FieldLabel>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              required
              minLength={8}
              aria-invalid={!!confirmPasswordError}
              aria-describedby={confirmPasswordError ? "confirm-password-error" : undefined}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setConfirmTouched(true)}
              autoComplete="new-password"
              hasError={!!confirmPasswordError}
              disabled={submitting}
            />
            <AnimatePresence>
              {confirmPasswordError && (
                <motion.p
                  id="confirm-password-error"
                  initial={{ opacity: 0, y: -4, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -4, height: 0 }}
                  className="text-sm text-destructive"
                  role="alert"
                >
                  {confirmPasswordError}
                </motion.p>
              )}
            </AnimatePresence>
          </Field>
        )}

        {/* Terms acceptance */}
        {mode === "register" && (
          <Field orientation="horizontal">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(!!checked)}
            />
            <FieldLabel htmlFor="terms" className="flex items-center">
              J’accepte les <Link href="/terms" className="ml-1 underline hover:text-primary">conditions d&apos;utilisation</Link>
            </FieldLabel>
          </Field>
        )}

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

        <motion.div whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
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

        {/* Divider */}
        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-card px-3 text-muted-foreground">ou</span>
          </div>
        </div>

        <GoogleButton next={next} />

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
