"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useAuthStore } from "@camermove/frontend"
import { ApiError } from "../../lib/api/client"
import { login } from "../../lib/api/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AdminLoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
        <Field>
          <FieldLabel htmlFor="admin-email">E-mail administrateur</FieldLabel>
          <Input
            id="admin-email"
            type="email"
            required
            className="bg-slate-900 text-slate-100"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-password">Mot de passe</FieldLabel>
          <Input
            id="admin-password"
            type="password"
            required
            minLength={8}
            className="bg-slate-900 text-slate-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <Button type="submit" className="rounded-full" disabled={submitting}>
          {submitting ? "Un instant…" : "Accéder à la console"}
        </Button>

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
