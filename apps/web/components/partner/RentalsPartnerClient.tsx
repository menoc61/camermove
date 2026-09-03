"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export function RentalsPartnerClient({ token }: { token: string }) {
  const qc = useQueryClient()
  const { data } = useQuery<{ items: Array<{ id: string; make: string; model: string; category: string; pickupCity: string; status: string; partnerStatus: string; pricePerUnit: number }> }>({
    queryKey: ["partner-rentals"],
    queryFn: () => apiFetch("/api/v1/partner/rentals", { method: "GET", token }),
  })
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [category, setCategory] = useState("suv")
  const [pickupCity, setPickupCity] = useState("")
  const [price, setPrice] = useState("")

  const create = useMutation({
    mutationFn: () => apiFetch("/api/v1/partner/rentals", { method: "POST", token, body: JSON.stringify({ make, model, category, capacity: 5, pricePerUnit: Number(price) || 50000, pickupCity: pickupCity || "Douala", photos: [], amenities: [] }), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => { toast.success("Véhicule créé"); qc.invalidateQueries({ queryKey: ["partner-rentals"] }); setMake(""); setModel("") },
    onError: (e) => toast.error((e as Error).message),
  })

  const presign = useMutation({
    mutationFn: async (file: File) => {
      const res = await apiFetch<{ objectKey: string; uploadUrl: string }>("/api/v1/partner/rentals/presign", { method: "POST", token, body: JSON.stringify({ filename: file.name, mimetype: file.type }), headers: { "Content-Type": "application/json" } })
      const put = await fetch(res.uploadUrl, { method: "PUT", body: file })
      if (!put.ok) throw new Error("Upload failed")
      toast.success(`Photo: ${res.objectKey}`)
      return res
    },
    onError: (e) => toast.error((e as Error).message),
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Créer un véhicule</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="Marque" value={make} onChange={(e) => setMake(e.target.value)} className="w-32" />
          <Input placeholder="Modèle" value={model} onChange={(e) => setModel(e.target.value)} className="w-32" />
          <Select value={category} onValueChange={(v) => setCategory(v as string)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="suv">SUV</SelectItem><SelectItem value="sedan">Berline</SelectItem><SelectItem value="van">Van</SelectItem><SelectItem value="minibus">Minibus</SelectItem></SelectContent>
          </Select>
          <Input placeholder="Ville" value={pickupCity} onChange={(e) => setPickupCity(e.target.value)} className="w-32" />
          <Input placeholder="Prix/unité" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" />
          <Button onClick={() => create.mutate()} disabled={create.isPending || !make || !model}>Créer</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Upload photo presigned</CardTitle></CardHeader>
        <CardContent><Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) presign.mutate(f) }} /></CardContent>
      </Card>
      <div className="space-y-3">
        {data?.items.map((v) => (
          <Card key={v.id}><CardContent className="p-4 flex justify-between"><div><p className="font-medium">{v.make} {v.model} · {v.category}</p><p className="text-xs text-muted-foreground">{v.pickupCity} · {v.pricePerUnit} XAF</p></div><Badge variant={v.partnerStatus === "approved" ? "default" : "secondary"}>{v.partnerStatus}</Badge></CardContent></Card>
        ))}
        {!data?.items.length && <p className="text-sm text-muted-foreground">Aucun véhicule.</p>}
      </div>
    </div>
  )
}
