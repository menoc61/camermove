"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useAuthStore } from "@camermove/frontend"
import { ApiError } from "../../lib/api/client"
import { login } from "../../lib/api/auth"

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

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4" noValidate>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">E-mail administrateur</span>
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
        <span className="mb-1 block text-sm font-medium text-slate-300">Mot de passe</span>
        <input
          type="password"
          required
          minLength={8}
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-px hover:bg-primary-dark active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? "Un instant…" : "Accéder à la console"}
      </button>

      <p className="text-center text-xs text-slate-500">
        Espace réservé à l'équipe CamerMove —{" "}
        <Link href="/" className="underline-offset-4 hover:text-slate-300 hover:underline">
          retour au site
        </Link>
      </p>
    </form>
  )
}
