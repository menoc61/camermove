"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchInsurancePolicies, subscribeInsurance, COVERAGE_LABELS, COVERAGE_PRICES, type CoverageType } from "@/lib/api/insurance"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Stepper } from "@/components/ui/stepper"
import { ShieldCheck, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

interface Props { token: string }

export function InsurancePartnerClient({ token }: Props) {
  const qc = useQueryClient()
  const { data: policiesResp, isLoading, error } = useQuery({
    queryKey: ["partner-insurance-policies"],
    queryFn: () => fetchInsurancePolicies(token),
    enabled: !!token,
  })
  const policies = policiesResp?.items ?? []

  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [travelers, setTravelers] = useState(1)
  const [coverageType, setCoverageType] = useState<CoverageType>("standard")
  const [lastPolicy, setLastPolicy] = useState<{ policyNumber: string | null; premium: number } | null>(null)

  const subscribe = useMutation({
    mutationFn: () =>
      subscribeInsurance(token, {
        destination,
        startDate,
        endDate,
        travelersCount: travelers,
        coverageType,
      }),
    onSuccess: (policy) => {
      setLastPolicy({ policyNumber: policy.policyNumber, premium: policy.premium })
      qc.invalidateQueries({ queryKey: ["partner-insurance-policies"] })
      // reset form fields
      setDestination("")
      setStartDate("")
      setEndDate("")
      setTravelers(1)
      setCoverageType("standard")
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const total = (COVERAGE_PRICES[coverageType] ?? 0) * travelers

  return (
    <div className="space-y-6">
      {/* Subscription form */}
      <Card>
        <CardHeader><CardTitle>Souscrire une assurance voyage</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input placeholder="Destination" value={destination} onChange={(e) => setDestination(e.target.value)} required />
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-sm text-muted-foreground">Voyageurs</label>
              <Stepper value={travelers} min={1} max={20} onChange={(n) => setTravelers(n)} label="voyageurs" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Type de couverture</label>
              <div className="grid grid-cols-2 gap-2">
                {(["basic", "standard", "premium", "family"] as CoverageType[]).map((c) => (
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
            <Button disabled={!token || subscribe.isPending} onClick={() => subscribe.mutate()}>
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
              <AlertDescription>Prime : {new Intl.NumberFormat("fr-CM").format(lastPolicy.premium)} XAF.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* List of policies */}
      <div className="space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>Impossible de charger les polices — {error instanceof Error ? error.message : String(error)}</AlertDescription>
          </Alert>
        )}
        {!isLoading && !error && (
          <div className="space-y-3">
            {policies?.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex justify-between items-center p-4">
                  <div>
                    <p className="font-medium">{COVERAGE_LABELS[p.coverageType as CoverageType]} — {p.destination}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.startDate).toLocaleDateString("fr-FR")} → {new Date(p.endDate).toLocaleDateString("fr-FR")} · {p.travelers} voyageur(s)
                    </p>
                    <p className="text-sm font-bold">{new Intl.NumberFormat("fr-CM").format(p.premium)} {p.currency}</p>
                    {p.policyNumber && <p className="text-xs font-mono text-muted-foreground">Attestation n° {p.policyNumber}</p>}
                  </div>
                  <Badge variant={p.status === "active" || p.status === "confirmed" ? "default" : "outline"}>{p.status}</Badge>
                </CardContent>
              </Card>
            ))}
            {(!policies?.length) && <p className="text-sm text-muted-foreground">Aucune police — souscrivez une assurance ci‑dessus.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
