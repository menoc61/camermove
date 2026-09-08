"use client"
import { useState } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import {
  fetchInsurancePolicies,
  subscribeInsurance,
  COVERAGE_LABELS,
  COVERAGE_PRICES,
  type CoverageType,
} from "@/lib/api/insurance"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Stepper } from "@/components/ui/stepper"
import { ShieldCheck, TriangleAlert } from "lucide-react"

const COVERAGES: CoverageType[] = ["basic", "standard", "premium", "family"]

export default function InsurancePage() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()

  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [travelers, setTravelers] = useState(1)
  const [coverageType, setCoverageType] = useState<CoverageType>("standard")
  const [lastPolicy, setLastPolicy] = useState<{ policyNumber: string | null; premium: number } | null>(null)

  const { data: policies, isLoading, error } = useQuery({
    queryKey: ["insurance-policies", token],
    queryFn: () => fetchInsurancePolicies(token!),
    enabled: !!token,
  })

  const subscribe = useMutation({
    mutationFn: () =>
      subscribeInsurance(token!, {
        destination,
        startDate,
        endDate,
        travelersCount: travelers,
        coverageType,
      }),
    onSuccess: (policy) => {
      setLastPolicy({ policyNumber: policy.policyNumber, premium: policy.premium })
      qc.invalidateQueries({ queryKey: ["insurance-policies"] })
    },
  })

  const total = (COVERAGE_PRICES[coverageType] ?? 0) * travelers

  return (
    <main className="mx-auto max-w-6xl px-6 pb-6 pt-24 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Assurance voyage</h1>
        {policies && <Badge variant="outline">{policies.length} police(s)</Badge>}
      </div>

      {!token && (
        <Alert>
          <TriangleAlert />
          <AlertDescription>
            <Link href="/login?next=/insurance" className="underline">Connectez-vous</Link> pour souscrire une assurance voyage.
          </AlertDescription>
        </Alert>
      )}

      {/* Subscription form */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Souscrire une couverture</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); subscribe.mutate() }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Destination</label>
              <Input placeholder="Douala" value={destination} onChange={(e) => setDestination(e.target.value)} required minLength={2} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Début de couverture</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Fin de couverture</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-sm text-muted-foreground">Voyageurs</label>
              <Stepper value={travelers} min={1} max={20} onChange={(n) => setTravelers(n)} label="voyageurs" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Type de couverture</label>
              <div className="grid grid-cols-2 gap-2">
                {COVERAGES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setCoverageType(c)}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${coverageType === c ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
                  >
                    <span className="font-semibold">{COVERAGE_LABELS[c]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {new Intl.NumberFormat("fr-CM").format(COVERAGE_PRICES[c])} XAF / voyageur
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-bold">Total : {new Intl.NumberFormat("fr-CM").format(total)} XAF</p>
            <Button type="submit" disabled={!token || subscribe.isPending}>
              {subscribe.isPending ? "Souscription..." : "Souscrire"}
            </Button>
          </div>
          {subscribe.isError && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>Souscription impossible — vérifiez les dates et réessayez.</AlertDescription>
            </Alert>
          )}
          {lastPolicy && (
            <Alert>
              <ShieldCheck />
              <AlertTitle>Assurance souscrite — police {lastPolicy.policyNumber}</AlertTitle>
              <AlertDescription>
                Prime : {new Intl.NumberFormat("fr-CM").format(lastPolicy.premium)} XAF. Votre attestation figure dans « Mes polices ».
              </AlertDescription>
            </Alert>
          )}
        </form>
      </div>

      {/* My policies */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Mes polices</h2>
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>Impossible de charger vos polices.</AlertDescription>
          </Alert>
        )}
        {token && policies && policies.length === 0 && (
          <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="rounded-full bg-muted p-3"><ShieldCheck className="size-6 text-muted-foreground" /></div>
            <p className="text-sm text-muted-foreground">Aucune police — souscrivez votre première couverture ci-dessus.</p>
          </CardContent></Card>
        )}
        {policies && policies.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {policies.map((p) => (
              <Card key={p.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <ShieldCheck className="size-5 text-primary" />
                  <Badge variant={p.status === "active" || p.status === "confirmed" ? "default" : "outline"}>{p.status}</Badge>
                </div>
                <h3 className="font-semibold">{COVERAGE_LABELS[p.coverageType]} — {p.destination}</h3>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.startDate).toLocaleDateString("fr-FR")} → {new Date(p.endDate).toLocaleDateString("fr-FR")} · {p.travelers} voyageur(s)
                </p>
                <p className="text-sm font-bold">{new Intl.NumberFormat("fr-CM").format(p.premium)} {p.currency}</p>
                {p.policyNumber && (
                  <p className="text-xs font-mono text-muted-foreground">Attestation n° {p.policyNumber}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
