"use client"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { trackParcel } from "@/lib/api/parcels"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const STATUS_LABELS: Record<string, string> = {
  registered: "Enregistré",
  picked_up: "Pris en charge",
  in_transit: "En transit",
  arrived: "Arrivé",
  available_for_pickup: "Disponible",
  delivered: "Livré",
}

function ParcelsSuccessInner() {
  const sp = useSearchParams()
  const tracking = sp.get("tracking") ?? ""

  const { data, isLoading, error } = useQuery({
    queryKey: ["track", tracking],
    queryFn: () => trackParcel(tracking),
    enabled: !!tracking,
  })

  if (!tracking) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">Numéro de suivi manquant.</p>
        <Link href="/parcels" className="mt-4 inline-block text-sm font-semibold text-primary underline">Retour aux colis</Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-4" style={{ background: "#F7F5F0", minHeight: "100vh" }}>
      <div className="text-center py-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full" style={{ background: "#2E7D5B" }}><Check className="size-6 text-white" /></div>
        <h1 className="mt-3 text-lg font-bold" style={{ color: "#14213D" }}>Colis enregistré</h1>
        <p className="mt-1 text-base font-mono font-bold" style={{ color: "#14213D" }}>{tracking}</p>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          {isLoading && <Skeleton className="h-40 w-full" />}
          {error && (
            <Alert variant="destructive"><AlertTitle>Introuvable</AlertTitle><AlertDescription>Aucun colis ne correspond à ce numéro de suivi.</AlertDescription></Alert>
          )}
          {data && (
            <>
              <div className="space-y-2 text-sm" style={{ color: "#14213D" }}>
                <p><span className="font-semibold">Trajet :</span> {data.senderCity} → {data.recipientCity}</p>
                <p><span className="font-semibold">Destinataire :</span> {data.recipientName}</p>
                <p><span className="font-semibold">Statut :</span> {STATUS_LABELS[data.status] ?? data.status}</p>
                <p className="text-lg font-bold">Coût : {new Intl.NumberFormat("fr-CM").format(data.shippingCost)} XAF</p>
              </div>
              {(data.statusHistory ?? []).length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  {(data.statusHistory ?? []).map((log, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full mt-1 bg-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{STATUS_LABELS[log.status] ?? log.status}</p>
                        {log.note && <p className="text-xs text-muted-foreground">{log.note}</p>}
                        {log.createdAt && <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("fr-FR")}</p>}
                      </div>
                      {log.location && <p className="text-xs font-medium text-right w-24 flex-shrink-0">{log.location}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <Link href="/dashboard" className="block text-center text-xs font-semibold underline" style={{ color: "#14213D" }}>Aller au tableau de bord →</Link>
        </CardContent>
      </Card>
    </main>
  )
}

export default function ParcelsSuccessPage() {
  return <Suspense><ParcelsSuccessInner /></Suspense>
}
