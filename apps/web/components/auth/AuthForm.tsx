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
      const msg =
        err instanceof ApiError
          ? err.status === 401
            ? "E-mail ou mot de passe incorrect."
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
