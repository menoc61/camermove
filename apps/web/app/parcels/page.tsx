"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { fetchParcels, createParcel, trackParcel, useParcels, type ParcelSearchQuery } from "@/lib/api/parcels"
import { Stepper } from "@/components/ui/stepper"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { X, Truck, Package, Tag, Calendar, Mail, } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useSearchParams } from "next/navigation"

type TabName = "send" | "my-parcels" | "track"

interface SendFormValues {
  senderName: string
  senderPhone: string
  recipientName: string
  recipientPhone: string
  senderCity: string
  recipientCity: string
  parcelType: string
  weightKg?: number
  dimensionsCm?: number
  description?: string
  declaredValue?: number
}

function statusBadgeClass(status: string) {
  return {
    registered: "bg-stone-900",
    picked_up: "bg-primary",
    in_transit: "bg-primary-600",
    arrived: "bg-green-600",
    available_for_pickup: "bg-yellow-600",
    delivered: "bg-green-500",
  }[status] || "bg-stone-500"
}

function statusBadgeText(status: string) {
  return {
    registered: "Enregistré",
    picked_up: "Pris en charge",
    in_transit: "En transit",
    arrived: "Arrivé",
    available_for_pickup: "Disponible",
    delivered: "Livré",
  }[status] || status
}

export default function ParcelsPage() {
  const [tab, setTab] = useState<TabName>("send")
  const [sendForm, setSendForm] = useState<SendFormValues>({
    senderName: "",
    senderPhone: "",
    recipientName: "",
    recipientPhone: "",
    senderCity: "",
    recipientCity: "",
    parcelType: "colis",
  })
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null)
  const { data: myParcels, isLoading, error } = useParcels(
    // token would come from auth state in real app
    undefined,
    undefined
  )
  const { data: trackData, isLoading: isTrackLoading, error: trackError } = useQuery({
    queryKey: ["track", trackingNumber],
    queryFn: trackingNumber ? () => trackParcel(trackingNumber) : undefined,
    enabled: !!trackingNumber,
  })

  // Tab: Envoyer un colis
  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: SendFormValues = {
      senderName: sendForm.senderName,
      senderPhone: sendForm.senderPhone,
      recipientName: sendForm.recipientName,
      recipientPhone: sendForm.recipientPhone,
      senderCity: sendForm.senderCity,
      recipientCity: sendForm.recipientCity,
      parcelType: sendForm.parcelType,
      weightKg: sendForm.weightKg,
      dimensionsCm: sendForm.dimensionsCm,
      description: sendForm.description,
      declaredValue: sendForm.declaredValue,
    }
    try {
      const res = await createParcel(undefined, body)
      setTrackingNumber(res.trackingNumber || res.id || "CM-XXXX")
      // navigate to track page
    } catch (err) {
      console.error(err)
    }
  }

  // Tab: Mes colis
  useEffect(() => {
    // In real app, token would be fetched from auth
    // fetchParcels(token, { recipientCity: ... })
  }, [])

  // Tab: Suivi public
  useEffect(() => {
    // nothing — trackParcel is called directly per trackingNumber
  }, [trackingNumber])

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Tab Navigation */}
      <Tabs defaultValue="send" onValueChange={setTab}>
        <TabsList className="border-b bg-muted/50">
          <TabsTrigger value="send" className="flex-1 py-3 px-2 text-sm font-medium">
            Envoyer un colis
          </TabsTrigger>
          <TabsTrigger value="my-parcels" className="flex-1 py-3 px-2 text-sm font-medium">
            Mes colis
          </TabsTrigger>
          <TabsTrigger value="track" className="flex-1 py-3 px-2 text-sm font-medium">
            Suivi public
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab Content */}
      {tab === "send" && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Envoyer un colis</h2>
          <form onSubmit={handleSendSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Expéditeur</label>
                <Input
                  placeholder="Nom expéditeur"
                  value={sendForm.senderName}
                  onChange={(e) => setSendForm({ ...sendForm, senderName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Téléphone expéditeur</label>
                <Input
                  type="tel"
                  placeholder="+237 6XX XXX XXX"
                  value={sendForm.senderPhone}
                  onChange={(e) => setSendForm({ ...sendForm, senderPhone: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Destinataire</label>
                <Input
                  placeholder="Nom destinataire"
                  value={sendForm.recipientName}
                  onChange={(e) => setSendForm({ ...sendForm, recipientName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Téléphone destinataire</label>
                <Input
                  type="tel"
                  placeholder="+237 6XX XXX XXX"
                  value={sendForm.recipientPhone}
                  onChange={(e) => setSendForm({ ...sendForm, recipientPhone: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Ville expéditeur</label>
                <Input
                  placeholder="Yaoundé"
                  value={sendForm.senderCity}
                  onChange={(e) => setSendForm({ ...sendForm, senderCity: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Ville destinataire</label>
                <Input
                  placeholder="Douala"
                  value={sendForm.recipientCity}
                  onChange={(e) => setSendForm({ ...sendForm, recipientCity: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Type de colis</label>
              <Select value={sendForm.parcelType} onValueChange={(v) => setSendForm({ ...sendForm, parcelType: v as string })}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="colis">Colis standard</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="colis_fragile">Colis fragile</SelectItem>
                  <SelectItem value="colis_urgent">Colis urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Poids (kg)</label>
              <Input
                type="number"
                placeholder="0.5"
                value={sendForm.weightKg || ""}
                onChange={(e) => setSendForm({ ...sendForm, weightKg: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Dimensions (cm)</label>
              <Input
                type="number"
                placeholder="Lxlh"
                value={sendForm.dimensionsCm || ""}
                onChange={(e) => setSendForm({ ...sendForm, dimensionsCm: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Description</label>
              <Input
                placeholder="Contenu, fragile, etc."
                value={sendForm.description || ""}
                onChange={(e) => setSendForm({ ...sendForm, description: e.target.value })}
                multiline
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Valeur déclarée</label>
              <Input
                type="number"
                placeholder="0"
                value={sendForm.declaredValue || ""}
                onChange={(e) => setSendForm({ ...sendForm, declaredValue: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <Button type="submit" className="w-full">
              Créer le colis
            </Button>
          </form>
        </div>
      )}

      {tab === "my-parcels" && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Mes colis</h2>
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
          )}
          {error && (
            <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger vos colis.</AlertDescription></Alert>
          )}
          {myParcels && myParcels.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myParcels.map((p) => (
                <Link
                  key={p.id}
                  href={`/parcels/track/${p.trackingNumber}`}
                  className="group"
                >
                  <Card className="overflow-hidden hover:border-primary/30 transition-colors h-full">
                    <div className="h-40 bg-muted relative overflow-hidden">
                      <div className="absolute top-2 left-2 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                        {statusBadgeText(p.status)}
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <h3 className="font-semibold line-clamp-1">{p.recipientName}</h3>
                      <p className="text-xs text-muted-foreground">{p.senderCity} → {p.recipientCity}</p>
                      <p className="text-sm font-bold">{p.shippingCost} XAF</p>
                      <p className="text-xs text-muted-foreground">
                        {statusBadgeText(p.status)} · {p.trackingNumber}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          {myParcels && myParcels.length === 0 && (
            <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="rounded-full bg-muted p-3"><Truck className="size-6 text-muted-foreground" /></div>
              <p className="text-sm text-muted-foreground">Aucun colis trouvé. Envoyer un nouveau colis ci-dessus.</p>
            </CardContent></Card>
          )}
        </div>
      )}

      {tab === "track" && trackingNumber && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Suivi {trackingNumber}</h2>
          {isTrackLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          )}
          {trackError && (
            <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger le suivi.</AlertDescription></Alert>
          )}
          {trackData && (
            <div className="space-y-4">
              {/* Timeline */}
              <div className="space-y-2">
                {trackData.statusHistory.map((log, i) => (
                  <div
                    key={log.id || i}
                    className={`flex items-start gap-3 ${i === trackData.statusHistory.length - 1 ? "border-t pt-2" : ""}`}
                  >
                    <div
                      className={`
                        w-3 h-3 rounded-full ${statusBadgeClass(log.status)}
                      `}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{statusBadgeText(log.status)}</p>
                      <p className="text-xs text-muted-foreground">{log.note || ""}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                    <div className="w-16 flex-shrink-0">
                      <p className="text-xs font-medium text-right">{log.location || ""}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Parcel details - sanitized: NO full phones, NO userId */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium">Destinataire</p>
                  <p className="text-lg font-bold">{trackData.recipientName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Ville</p>
                  <p className="text-lg font-bold">
                    {trackData.senderCity} → {trackData.recipientCity}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Type</p>
                  <p className="text-lg font-bold">{trackData.parcelType}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium">Coût d'expédition</p>
                <p className="text-2xl font-bold">{trackData.shippingCost} XAF</p>
              </div>

              <div>
                <p className="text-sm font-medium">Poids</p>
                <p className="text-lg font-bold">
                  {trackData.weightKg ?? "Non spécifié"} kg
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">Dimensions</p>
                <p className="text-lg font-bold">
                  {trackData.dimensionsCm ?? "Non spécifié"} cm
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">Description</p>
                <p className="text-lg font-bold">{trackData.description || "Non spécifiée"}</p>
              </div>
            </div>
          )}
          {(!trackData || trackData.status === "registered") && (
            <p className="text-sm text-muted-foreground">
              Aucun événement de suivi enregistré pour le moment.
            </p>
          )}
        </div>
      )}

      {tab === "track" && !trackingNumber && (
        <p className="text-sm text-muted-foreground">
          Entrez un numéro de suivi ci-dessus pour commencer.
        </p>
      )}
    </main>
  )
}