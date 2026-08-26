"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@camermove/frontend"
import { apiFetch } from "../../lib/api/client"
import type { AuthUser } from "../../lib/api/auth"

const NAV = [
  "Tableau de bord",
  "Utilisateurs",
  "Transporteurs",
  "Trajets",
  "Réservations",
  "Paiements",
  "Commissions",
  "Paramètres",
  "Journal d'audit",
] as const

export function AdminShell() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const [profile, setProfile] = useState<AuthUser & { status: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<string>("Tableau de bord")

  useEffect(() => {
    if (!accessToken) {
      setError("Session expirée — reconnectez-vous.")
      return
    }
    apiFetch<{ id: string; email: string; role: string; status: string }>("/api/v1/me/profile", {
      token: accessToken,
    })
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
  }, [accessToken])

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-slate-950">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-[4px] bg-primary" aria-hidden />
            <span className="font-bold tracking-tight text-white">CamerMove</span>
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Console admin
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {profile ? `${profile.email} · ${profile.role}` : "…"}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {!error && !profile && <p className="text-sm text-slate-500">Chargement…</p>}

        {profile && (
          <>
            <nav aria-label="Sections admin" className="mb-8 flex flex-wrap gap-2">
              {NAV.map((item) => (
                <button
                  key={item}
                  onClick={() => setActive(item)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    active === item
                      ? "bg-primary text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:border-primary/50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>

            <section className="rounded-card border border-slate-200 bg-white p-8">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{active}</h1>
              <p className="mt-2 max-w-[60ch] text-sm text-slate-500">
                Ce module arrive avec la prochaine itération de la console (gestion des{" "}
                {active.toLowerCase()}).
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
