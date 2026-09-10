"use client"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Suspense, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ShieldCheck } from "lucide-react"
import { useAuthStore } from "@camermove/frontend"
import { fetchInsurancePolicy, COVERAGE_LABELS } from "@/lib/api/insurance"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"

function InsuranceSuccessInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const token = useAuthStore((s) => s.accessToken)
  const id = sp.get("id") ?? ""

  useEffect(() => {
    if (!token) {
      router.push("/login?next=" + encodeURIComponent(id ? `/insurance/success?id=${id}` : "/insurance"))
    }
  }, [token, router, id])

  const { data: policy, isLoading, error } = useQuery({
    queryKey: ["insurance-policy", id],
    queryFn: () => fetchInsurancePolicy(token!, id),
    enabled: !!token && !!id,
  })

  if (!id) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">Référence manquante.</p>
        <Link href="/insurance" className="mt-4 inline-block text-sm font-semibold text-primary underline">Retour à l&apos;assurance</Link>
      </main>
    )
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">Redirection vers la connexion…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-4" style={{ background: "#F7F5F0", minHeight: "100vh" }}>
      <div className="text-center py-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full" style={{ background: "#2E7D5B" }}><Check className="size-6 text-white" /></div>
        <h1 className="mt-3 text-lg font-bold" style={{ color: "#14213D" }}>Assurance souscrite</h1>
        {policy?.policyNumber && <p className="text-xs font-mono" style={{ color: "#5A6474" }}>Police n° {policy.policyNumber}</p>}
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          {isLoading && <Skeleton className="h-40 w-full" />}
          {error && (
            <Alert variant="destructive"><AlertDescription>Impossible de charger la police.</AlertDescription></Alert>
          )}
          {policy && (
            policy.documentUrl ? (
              <Alert>
                <ShieldCheck />
                <AlertDescription>
                  <a href={policy.documentUrl} target="_blank" rel="noreferrer" className="underline">Télécharger l&apos;attestation officielle</a>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="rounded-lg border p-4 space-y-2 text-sm" style={{ color: "#14213D" }}>
                <p className="font-bold">Attestation d&apos;assurance voyage — n° {policy.policyNumber}</p>
                <p>Couverture : {COVERAGE_LABELS[policy.coverageType]}</p>
                <p>Destination : {policy.destination}</p>
                <p>Période : {new Date(policy.startDate).toLocaleDateString("fr-FR")} → {new Date(policy.endDate).toLocaleDateString("fr-FR")}</p>
                <p>Voyageurs : {policy.travelers}</p>
                <p className="text-base font-bold">Prime : {new Intl.NumberFormat("fr-CM").format(policy.premium)} {policy.currency}</p>
                <Button variant="outline" className="print:hidden" onClick={() => window.print()}>Imprimer l&apos;attestation</Button>
              </div>
            )
          )}
          <Link href="/dashboard" className="block text-center text-xs font-semibold underline" style={{ color: "#14213D" }}>Aller au tableau de bord →</Link>
        </CardContent>
      </Card>
    </main>
  )
}

export default function InsuranceSuccessPage() {
  return <Suspense><InsuranceSuccessInner /></Suspense>
}
