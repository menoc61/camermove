"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useAuthStore } from "@camermove/frontend"
import { ApiError } from "../../lib/api/client"
import { login } from "../../lib/api/auth"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AdminLoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [touched, setTouched] = useState({ email: false, password: false })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const emailError =
    touched.email && email.length > 0 && !EMAIL_RE.test(email)
      ? "Adresse e-mail invalide."
      : touched.email && email.length === 0
        ? "L'e-mail est requis."
        : null
  const passwordError =
    touched.password && password.length > 0 && password.length < 8
      ? "8 caractères minimum."
      : touched.password && password.length === 0
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
      const res = await login(email, password)
      if (res.user.role !== "admin" && res.user.role !== "super_admin") {
        setError("Accès réservé aux administrateurs.")
        return
      }
      setAuth({ accessToken: res.accessToken, user: res.user })
      router.push(next && next.startsWith("/") ? next : "/admin")
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? "E-mail ou mot de passe incorrect."
            : err.message
          : "Une erreur est survenue. Réessayez.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4" noValidate>
      <FieldGroup>
        <Field data-invalid={!!emailError || undefined}>
          <FieldLabel htmlFor="admin-email">E-mail administrateur</FieldLabel>
          <Input
            id="admin-email"
            type="email"
            required
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "admin-email-error" : undefined}
            className={cn("bg-slate-900 text-slate-100", emailError && "border-destructive")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, email: true }))}
            autoComplete="email"
          />
          <AnimatePresence>
            {emailError ? (
              <motion.p
                id="admin-email-error"
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                className="text-sm text-red-300"
                role="alert"
              >
                {emailError}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </Field>
        <Field data-invalid={!!passwordError || undefined}>
          <FieldLabel htmlFor="admin-password">Mot de passe</FieldLabel>
          <Input
            id="admin-password"
            type="password"
            required
            minLength={8}
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? "admin-password-error" : undefined}
            className={cn("bg-slate-900 text-slate-100", passwordError && "border-destructive")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((p) => ({ ...p, password: true }))}
            autoComplete="current-password"
          />
          <AnimatePresence>
            {passwordError ? (
              <motion.p
                id="admin-password-error"
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                className="text-sm text-red-300"
                role="alert"
              >
                {passwordError}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </Field>

        <AnimatePresence>
          {error ? (
            <motion.p
              initial={{ opacity: 0, scale: 0.98, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -6 }}
              role="alert"
              className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300 border border-red-900"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <motion.div whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
          <Button type="submit" className="rounded-full" disabled={submitting} loading={submitting}>
            {submitting ? "Un instant…" : "Accéder à la console"}
          </Button>
        </motion.div>

        <p className="text-center text-xs text-muted-foreground">
          Espace réservé à l'équipe CamerMove —{" "}
          <Link href="/" className="underline-offset-4 hover:underline">
            retour au site
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
