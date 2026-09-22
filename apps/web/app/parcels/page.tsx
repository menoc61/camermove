"use client"
import { useState } from "react"
import Link from "next/link"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { fetchParcels, createParcel, fetchParcel, createParcelPayment, trackParcel } from "@/lib/api/parcels"
import { PaymentStep } from "@/components/booking/PaymentStep"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Truck, Package, TriangleAlert } from "lucide-react"
import { priceXaf } from "@camermove/shared"

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
  dimensionsCm?: string
  description?: string
}

function statusBadgeClass(status: string) {
  return {
    registered: "bg-stone-500",
    picked_up: "bg-primary",
    in_transit: "bg-primary",
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
  const token = useAuthStore((s) => s.accessToken)
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
  const [createdParcel, setCreatedParcel] = useState<{ id: string; trackingNumber: string } | null>(null)
  const [trackInput, setTrackInput] = useState("")
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)

  const { data: myParcelsData, isLoading, error } = useQuery({
    queryKey: ["my-parcels", token],
    queryFn: () => fetchParcels(token!, { perPage: 24 }),
    enabled: !!token,
  })

  const { data: trackData, isLoading: isTrackLoading, error: trackError } = useQuery({
    queryKey: ["track", trackingNumber],
    queryFn: () => trackParcel(trackingNumber!),
    enabled: !!trackingNumber,
  })

  const create = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("UNAUTHENTICATED")
      return createParcel(token, sendForm, crypto.randomUUID())
    },
    onSuccess: (parcel) => {
      setCreatedParcel(parcel)
      setPaid(false)
    },
  })

  const { data: createdDetail } = useQuery({
    queryKey: ["parcel-detail", createdParcel?.id],
    queryFn: () => fetchParcel(createdParcel!.id, token!),
    enabled: !!createdParcel && !!token,
  })

  const myParcels = myParcelsData?.items

  return (
    <main className="mx-auto max-w-6xl px-6 pb-6 pt-24 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Transport de colis</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabName)}>
        <TabsList className="w-full max-w-xl overflow-x-auto">
          <TabsTrigger value="send" className="flex-1 whitespace-nowrap min-h-[44px]">Envoyer un colis</TabsTrigger>
          <TabsTrigger value="my-parcels" className="flex-1 whitespace-nowrap min-h-[44px]">Mes colis</TabsTrigger>
          <TabsTrigger value="track" className="flex-1 whitespace-nowrap min-h-[44px]">Suivi public</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "send" && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Envoyer un colis</h2>
          {!token && (
            <Alert>
              <TriangleAlert />
              <AlertDescription>
                <Link href="/login?next=/parcels" className="underline">Connectez-vous</Link> pour envoyer un colis.
              </AlertDescription>
            </Alert>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); create.mutate() }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Expéditeur</label>
                <Input placeholder="Nom expéditeur" value={sendForm.senderName} onChange={(e) => setSendForm({ ...sendForm, senderName: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Téléphone expéditeur</label>
                <Input type="tel" placeholder="+237 6XX XXX XXX" value={sendForm.senderPhone} onChange={(e) => setSendForm({ ...sendForm, senderPhone: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Destinataire</label>
                <Input placeholder="Nom destinataire" value={sendForm.recipientName} onChange={(e) => setSendForm({ ...sendForm, recipientName: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Téléphone destinataire</label>
                <Input type="tel" placeholder="+237 6XX XXX XXX" value={sendForm.recipientPhone} onChange={(e) => setSendForm({ ...sendForm, recipientPhone: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Ville expéditeur</label>
                <Input placeholder="Yaoundé" value={sendForm.senderCity} onChange={(e) => setSendForm({ ...sendForm, senderCity: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Ville destinataire</label>
                <Input placeholder="Douala" value={sendForm.recipientCity} onChange={(e) => setSendForm({ ...sendForm, recipientCity: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Type de colis</label>
              <Select value={sendForm.parcelType} onValueChange={(v) => setSendForm({ ...sendForm, parcelType: v ?? "colis" })}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="colis">Colis standard</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="colis_fragile">Colis fragile</SelectItem>
                  <SelectItem value="colis_urgent">Colis urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Poids (kg)</label>
                <Input type="number" step="0.1" placeholder="0.5" value={sendForm.weightKg ?? ""} onChange={(e) => setSendForm({ ...sendForm, weightKg: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Dimensions (cm)</label>
                <Input placeholder="40x30x20" value={sendForm.dimensionsCm ?? ""} onChange={(e) => setSendForm({ ...sendForm, dimensionsCm: e.target.value || undefined })} />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Description</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Contenu, fragile, etc."
                value={sendForm.description || ""}
                onChange={(e) => setSendForm({ ...sendForm, description: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!token || create.isPending}>
              {create.isPending ? "Création..." : "Créer le colis"}
            </Button>
            {create.isError && (
              <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de créer le colis — vérifiez les champs et réessayez.</AlertDescription></Alert>
            )}
            {createdParcel && !paid && token && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Colis créé — n° de suivi <span className="font-mono">{createdParcel.trackingNumber}</span></p>
                <p className="text-sm text-muted-foreground">Procédez au paiement des frais d&apos;expédition.</p>
                <PaymentStep
                  amount={createdDetail?.shippingCost ?? 0}
                  createPayment={(provider) => createParcelPayment(createdParcel.id, token, provider)}
                  onPaymentCreated={() => setPaid(true)}
                />
              </div>
            )}
            {createdParcel && paid && (
              <Alert>
                <Package />
                <AlertTitle>Colis enregistré — n° de suivi {createdParcel.trackingNumber}</AlertTitle>
                <AlertDescription>
                  <Link href={`/parcels/success?tracking=${createdParcel.trackingNumber}`} className="underline">Voir le reçu et le suivi</Link>
                </AlertDescription>
              </Alert>
            )}
          </form>
        </div>
      )}

      {tab === "my-parcels" && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Mes colis</h2>
          {!token && (
            <Alert>
              <TriangleAlert />
              <AlertDescription>
                <Link href="/login?next=/parcels" className="underline">Connectez-vous</Link> pour voir vos colis.
              </AlertDescription>
            </Alert>
          )}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          )}
          {error && (
            <Alert variant="destructive"><TriangleAlert /><AlertTitle>Erreur</AlertTitle><AlertDescription>Impossible de charger vos colis.</AlertDescription></Alert>
          )}
          {myParcels && myParcels.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myParcels.map((p) => (
                <Link key={p.id} href={`/parcels/track/${p.trackingNumber}`} className="group">
                  <Card className="overflow-hidden hover:border-primary/30 transition-colors h-full">
                    <div className="h-2 bg-muted relative overflow-hidden">
                      <div className={`absolute inset-0 ${statusBadgeClass(p.status)}`} />
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <h3 className="font-semibold line-clamp-1">{p.recipientName}</h3>
                      <p className="text-xs text-muted-foreground">{p.senderCity} → {p.recipientCity}</p>
                      <p className="text-sm font-bold">{priceXaf(p.shippingCost)}</p>
                      <p className="text-xs text-muted-foreground">{statusBadgeText(p.status)} · {p.trackingNumber}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          {token && myParcels && myParcels.length === 0 && (
            <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="rounded-full bg-muted p-3"><Truck className="size-6 text-muted-foreground" /></div>
              <p className="text-sm text-muted-foreground">Aucun colis trouvé. Envoyez un nouveau colis ci-dessus.</p>
            </CardContent></Card>
          )}
        </div>
      )}

      {tab === "track" && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Suivi public</h2>
          <form
            onSubmit={(e) => { e.preventDefault(); setTrackingNumber(trackInput.trim() || null) }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Numéro de suivi (ex : CM-P-XXXXXX)" value={trackInput} onChange={(e) => setTrackInput(e.target.value)} className="pl-9" />
            </div>
            <Button type="submit">Suivre</Button>
          </form>

          {isTrackLoading && <Skeleton className="h-40 rounded-xl" />}
          {trackError && (
            <Alert variant="destructive"><TriangleAlert /><AlertTitle>Introuvable</AlertTitle><AlertDescription>Aucun colis ne correspond à ce numéro de suivi.</AlertDescription></Alert>
          )}
          {trackData && (
            <div className="space-y-4">
              <div className="space-y-2">
                {(trackData.statusHistory ?? []).map((log, i) => (
                  <div key={i} className={`flex items-start gap-3 ${i === (trackData.statusHistory?.length ?? 0) - 1 ? "border-t pt-2" : ""}`}>
                    <div className={`w-3 h-3 rounded-full mt-1 ${statusBadgeClass(log.status)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{statusBadgeText(log.status)}</p>
                      <p className="text-xs text-muted-foreground">{log.note || ""}</p>
                      <p className="text-xs text-muted-foreground">{log.createdAt ? new Date(log.createdAt).toLocaleString("fr-FR") : ""}</p>
                    </div>
                    <div className="w-24 flex-shrink-0">
                      <p className="text-xs font-medium text-right">{log.location || ""}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium">Destinataire</p>
                  <p className="text-lg font-bold">{trackData.recipientName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Trajet</p>
                  <p className="text-lg font-bold">{trackData.senderCity} → {trackData.recipientCity}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Statut</p>
                  <p className="text-lg font-bold">{statusBadgeText(trackData.status)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium">Coût d&apos;expédition</p>
                <p className="text-2xl font-bold">{priceXaf(trackData.shippingCost)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
