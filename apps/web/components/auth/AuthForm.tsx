"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useAuthStore } from "@camermove/frontend"
import { ApiError } from "../../lib/api/client"
import { login, register } from "../../lib/api/auth"

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

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4" noValidate>
      {mode === "register" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Prénom</span>
            <input
              className={inputCls}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Nom</span>
            <input
              className={inputCls}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </label>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">E-mail</span>
        <input
          type="email"
          required
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</span>
        <input
          type="password"
          required
          minLength={8}
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        {mode === "register" && (
          <span className="mt-1 block text-xs text-slate-500">8 caractères minimum.</span>
        )}
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-px hover:bg-primary-dark active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
      </button>

      <p className="text-center text-sm text-slate-600">
        {mode === "login" ? (
          <>
            Pas encore de compte&nbsp;?{" "}
            <Link href="/register" className="font-semibold text-primary-dark underline-offset-4 hover:underline">
              Créer un compte
            </Link>
          </>
        ) : (
          <>
            Déjà inscrit&nbsp;?{" "}
            <Link href="/login" className="font-semibold text-primary-dark underline-offset-4 hover:underline">
              Se connecter
            </Link>
          </>
        )}
      </p>
    </form>
  )
}
