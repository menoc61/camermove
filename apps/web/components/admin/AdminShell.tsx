"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@camermove/frontend"
import { apiFetch } from "../../lib/api/client"
import type { AuthUser } from "../../lib/api/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const NAV = [
  "Tableau de bord",
  "Utilisateurs",
  "Transporteurs",
  "Trajets",
  "RÃ©servations",
  "Paiements",
  "Commissions",
  "ParamÃ¨tres",
  "Journal d'audit",
] as const

export function AdminShell() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const [profile, setProfile] = useState<AuthUser & { status: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<string>("Tableau de bord")

  useEffect(() => {
    if (!accessToken) {
      setError("Session expirÃ©e â€” reconnectez-vous.")
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
            {profile ? `${profile.email} Â· ${profile.role}` : "â€¦"}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {!error && !profile && <p className="text-sm text-slate-500">Chargementâ€¦</p>}

        {profile && (
          <>
            <nav aria-label="Sections admin" className="mb-8 flex flex-wrap gap-2">
              {NAV.map((item) => (
                <Button
                  key={item}
                  variant={active === item ? "default" : "outline"}
                  size="sm"
                  className={cn("rounded-full", active !== item && "border-border bg-card")}
                  onClick={() => setActive(item)}
                >
                  {item}
                </Button>
              ))}
            </nav>

            <Card>
              <CardHeader>
                <CardTitle>{active}</CardTitle>
                <CardDescription>
                  Ce module arrive avec la prochaine itération de la console (gestion des{" "}
                  {active.toLowerCase()}).
                </CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
