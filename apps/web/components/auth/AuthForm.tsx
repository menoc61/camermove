"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useAuthStore } from "@camermove/frontend"
import { ApiError } from "../../lib/api/client"
import { login, register } from "../../lib/api/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const emailInvalid = email.length > 0 && !EMAIL_RE.test(email)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
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
      router.push(next && next.startsWith("/") ? next : "/dashboard")
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
        {mode === "register" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="firstName">Prénom</FieldLabel>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lastName">Nom</FieldLabel>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </Field>
          </div>
        )}

        <Field data-invalid={emailInvalid || undefined}>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            type="email"
            required
            aria-invalid={emailInvalid}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {emailInvalid && <FieldDescription>Adresse e-mail invalide.</FieldDescription>}
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "register" && (
            <FieldDescription>8 caractères minimum.</FieldDescription>
          )}
        </Field>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full rounded-full" disabled={submitting}>
          {submitting
            ? "Un instant…"
            : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              Pas encore de compte&nbsp;?{" "}
              <Link
                href="/register"
                className="font-semibold text-primary-dark underline-offset-4 hover:underline"
              >
                Créer un compte
              </Link>
            </>
          ) : (
            <>
              Déjà inscrit&nbsp;?{" "}
              <Link
                href="/login"
                className="font-semibold text-primary-dark underline-offset-4 hover:underline"
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
