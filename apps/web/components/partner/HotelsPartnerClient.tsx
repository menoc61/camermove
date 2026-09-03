"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface Props { token: string }

export function HotelsPartnerClient({ token }: Props) {
  const qc = useQueryClient()
  const { data } = useQuery<{ items: Array<{ id: string; name: string; city: string; status: string; partnerStatus: string; photos: string[]; rooms: Array<{ id: string; name: string; pricePerNight: number; quantity: number }> }> }>({
    queryKey: ["partner-hotels"],
    queryFn: () => apiFetch("/api/v1/partner/hotels", { method: "GET", token }),
  })
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [price, setPrice] = useState("")
  const [roomName, setRoomName] = useState("")
  const [hotelIdForRoom, setHotelIdForRoom] = useState("")

  const createHotel = useMutation({
    mutationFn: () => apiFetch("/api/v1/partner/hotels", { method: "POST", token, body: JSON.stringify({ name, city, photos: [], amenities: [] }), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => { toast.success("Hôtel créé"); qc.invalidateQueries({ queryKey: ["partner-hotels"] }); setName(""); setCity("") },
    onError: (e) => toast.error((e as Error).message),
  })

  const createRoom = useMutation({
    mutationFn: () => {
      const pid = hotelIdForRoom || data?.items[0]?.id
      if (!pid) throw new Error("Aucun hôtel")
      return apiFetch(`/api/v1/partner/hotels/${pid}/rooms`, { method: "POST", token, body: JSON.stringify({ name: roomName || "Chambre Standard", capacity: 2, pricePerNight: Number(price) || 25000, quantity: 5 }), headers: { "Content-Type": "application/json" } })
    },
    onSuccess: () => { toast.success("Chambre créée"); qc.invalidateQueries({ queryKey: ["partner-hotels"] }) },
    onError: (e) => toast.error((e as Error).message),
  })

  const presign = useMutation({
    mutationFn: async (file: File) => {
      const res = await apiFetch<{ objectKey: string; uploadUrl: string }>("/api/v1/partner/hotels/presign", { method: "POST", token, body: JSON.stringify({ filename: file.name, mimetype: file.type, size: file.size }), headers: { "Content-Type": "application/json" } })
      const put = await fetch(res.uploadUrl, { method: "PUT", body: file })
      if (!put.ok) throw new Error("Upload failed")
      toast.success(`Photo uploadée: ${res.objectKey}`)
      return res
    },
    onError: (e) => toast.error((e as Error).message),
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Créer un hôtel</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="Nom hôtel" value={name} onChange={(e) => setName(e.target.value)} className="w-48" />
          <Input placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} className="w-40" />
          <Button onClick={() => createHotel.mutate()} disabled={createHotel.isPending || !name || !city}>Créer</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ajouter une chambre</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="ID hôtel (ou 1er)" value={hotelIdForRoom} onChange={(e) => setHotelIdForRoom(e.target.value)} className="w-48" />
          <Input placeholder="Nom chambre" value={roomName} onChange={(e) => setRoomName(e.target.value)} className="w-40" />
          <Input placeholder="Prix/nuit" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" />
          <Button onClick={() => createRoom.mutate()} disabled={createRoom.isPending}>Ajouter</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Upload photo (presigned)</CardTitle></CardHeader>
        <CardContent>
          <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) presign.mutate(f) }} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {data?.items.map((h) => (
          <Card key={h.id}>
            <CardContent className="p-4 flex justify-between">
              <div>
                <p className="font-medium">{h.name} — {h.city}</p>
                <p className="text-xs text-muted-foreground">{h.rooms.length} chambres</p>
              </div>
              <Badge variant={h.partnerStatus === "approved" ? "default" : "secondary"}>{h.partnerStatus}</Badge>
            </CardContent>
          </Card>
        ))}
        {!data?.items.length && <p className="text-sm text-muted-foreground">Aucun hôtel — créez-en un.</p>}
      </div>
    </div>
  )
}
