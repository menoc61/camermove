"use client"
import { useEffect, useState } from "react"
import { getTransporterStats, getTransporterProfile } from "@/lib/api/transporter"

export function TransporterDashboardClient({ token }: { token: string }) {
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getTransporterStats(token), getTransporterProfile(token)])
      .then(([s, p]) => { setStats(s as unknown as Record<string, number>); setProfile(p as unknown as Record<string, unknown>) })
      .catch((e) => setError(e.message))
  }, [token])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!stats) return <p className="text-sm text-muted-foreground">Chargement...</p>

  const cards = [
    { label: "Trajets actifs", value: stats.activeTrips ?? 0 },
    { label: "Départs du jour", value: stats.upcomingTrips ?? 0 },
    { label: "Réservations totales", value: stats.totalBookings ?? 0 },
    { label: "Réservations aujourd'hui", value: stats.todayBookings ?? 0 },
    { label: "Revenu confirmé (XAF)", value: stats.totalRevenue ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Transporteur — Tableau de bord</h1>
      {profile && <p className="text-sm text-muted-foreground">Profil : {(profile as { companyName?: string }).companyName ?? (profile as { email?: string }).email}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-5">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="mt-2 text-2xl font-bold">{c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border p-5 text-sm text-muted-foreground">
        <p>Gérez votre flotte, itinéraires et tarifs depuis les onglets. Vos réservations et paiements sont visibles en temps réel.</p>
      </div>
    </div>
  )
}
