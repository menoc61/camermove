"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TriangleAlert } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

interface Props { token: string }

export function ParcelsPartnerClient({ token }: Props) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery<{ items: Array<{ id: string; senderName: string; senderCity: string; recipientName: string; recipientCity: string; status: string }> }>({
    queryKey: ["partner-parcels"],
    queryFn: () => apiFetch("/api/v1/parcels", { method: "GET", token }),
    enabled: !!token,
  })

  const [senderName, setSenderName] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [senderCity, setSenderCity] = useState("")
  const [recipientCity, setRecipientCity] = useState("")
  const [weight, setWeight] = useState("")

  const createParcel = useMutation({
    mutationFn: () => {
      const body = {
        senderName,
        senderPhone: "",
        recipientName,
        recipientPhone: "",
        senderCity,
        recipientCity,
        parcelType: "standard",
        weightKg: weight ? Number(weight) : null,
      }
      return apiFetch("/api/v1/parcels", { method: "POST", token, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })
    },
    onSuccess: () => {
      toast.success("Colis créé")
      qc.invalidateQueries({ queryKey: ["partner-parcels"] })
      setSenderName("")
      setRecipientName("")
      setSenderCity("")
      setRecipientCity("")
      setWeight("")
    },
    onError: (e) => toast.error((e as Error).message),
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Créer un colis</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="Expéditeur" value={senderName} onChange={(e) => setSenderName(e.target.value)} className="w-48" />
          <Input placeholder="Ville expéditeur" value={senderCity} onChange={(e) => setSenderCity(e.target.value)} className="w-40" />
          <Input placeholder="Destinataire" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="w-48" />
          <Input placeholder="Ville destinataire" value={recipientCity} onChange={(e) => setRecipientCity(e.target.value)} className="w-40" />
          <Input placeholder="Poids (kg)" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-24" />
          <Button onClick={() => createParcel.mutate()} disabled={createParcel.isPending || !senderName || !recipientName}>Créer</Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
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
              <AlertDescription>Impossible de charger les colis — {error instanceof Error ? error.message : String(error)}</AlertDescription>
            </Alert>
          )}
          {!isLoading && !error && (
            <div className="space-y-3">
              {data?.items.map(p => (
                <Card key={p.id}>
                  <CardContent className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{p.senderName} → {p.recipientName}</p>
                      <p className="text-xs text-muted-foreground">{p.senderCity} → {p.recipientCity}</p>
                    </div>
                    <Badge variant={p.status === "delivered" ? "default" : "secondary"}>{p.status}</Badge>
                  </CardContent>
                </Card>
              ))}
              {(!data?.items?.length) && <p className="text-sm text-muted-foreground">Aucun colis — créez‑en un.</p>}
            </div>
          )}
        </div>
    </div>
  )
}
