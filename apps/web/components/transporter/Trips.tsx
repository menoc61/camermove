"use client"
import { useEffect, useState } from "react"
import { listTrips, createTrip, deleteTrip, listRoutes, setTripStatus } from "@/lib/api/transporter"
import { DataTable, type Column } from "@/components/dashboard-v2/panels/DataTable"
import { Button } from "@/components/ui/button"

type TripRow = {
  id: string
  departureAt: string
  price: number
  totalSeats: number
  status: string
  route: { originCity: string; destinationCity: string }
}

export function TripsClient({ token }: { token: string }) {
  const [items, setItems] = useState<TripRow[]>([])
  const [routes, setRoutes] = useState<{ id: string; originCity: string; destinationCity: string }[]>([])
  const [error, setError] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ routeId:"", departureAt:"", price:2500, totalSeats:50 })
  const refresh = () => { setLoading(true); return listTrips(token).then((r)=>setItems(r.items as never)).catch((e)=>setError(e.message)).finally(()=>setLoading(false)) }
  useEffect(()=>{ refresh(); listRoutes(token).then(setRoutes as never).catch(()=>{}) },[token])
  async function onCreate(e: React.FormEvent){ e.preventDefault(); try{ await createTrip(token, { routeId: form.routeId, departureAt: new Date(form.departureAt).toISOString(), price: Number(form.price), totalSeats: Number(form.totalSeats) }); refresh() }catch(err){ setError((err as Error).message)}}
  async function onBulk(){
    if(!form.routeId || !form.departureAt) { setError("Route et date requis pour lot"); return }
    const base = new Date(form.departureAt)
    const trips = Array.from({length:3}).map((_,i)=>({ routeId: form.routeId, departureAt: new Date(base.getTime()+i*24*3600*1000).toISOString(), price: Number(form.price), totalSeats: Number(form.totalSeats)}))
    try{ for (const t of trips) { await createTrip(token, t) } refresh() }catch(err){ setError((err as Error).message)}
  }
  async function onStatus(id: string, action: "pause" | "close" | "reopen") {
    try { await setTripStatus(token, id, action); refresh() } catch (err) { setError((err as Error).message) }
  }
  async function onDelete(id: string) {
    if (!window.confirm("Supprimer ce trajet ?")) return
    try { await deleteTrip(token, id); refresh() } catch (err) { setError((err as Error).message) }
  }

  const columns: Column[] = [
    {
      key: "route",
      label: "Trajet",
      render: (_v, row) => {
        const r = row.route as TripRow["route"]
        return <span className="font-medium">{r?.originCity} → {r?.destinationCity}</span>
      },
      sortValue: (row) => {
        const r = row.route as TripRow["route"]
        return `${r?.originCity ?? ""} ${r?.destinationCity ?? ""}`
      },
    },
    {
      key: "departureAt",
      label: "Départ",
      render: (v) => (v ? new Date(String(v)).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"),
      sortValue: (row) => String(row.departureAt ?? ""),
    },
    { key: "price", label: "Prix (XAF)", sortValue: (row) => Number(row.price ?? 0) },
    { key: "totalSeats", label: "Places", sortValue: (row) => Number(row.totalSeats ?? 0) },
    { key: "status", label: "Statut" },
    {
      key: "actions-col",
      label: "Actions",
      sortable: false,
      render: (_v, row) => (
        <div className="flex items-center gap-2">
          <select
            aria-label="Changer le statut"
            defaultValue=""
            onChange={(e) => { if (e.target.value) { void onStatus(String(row.id), e.target.value as "pause" | "close" | "reopen"); e.target.value = "" } }}
            className="rounded-lg border px-2 py-1 text-xs"
          >
            <option value="">Statut…</option>
            <option value="pause">Suspendre</option>
            <option value="close">Clore</option>
            <option value="reopen">Rouvrir</option>
          </select>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void onDelete(String(row.id))}>Supprimer</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Trajets</h1>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <form onSubmit={onCreate} className="grid gap-2 rounded-2xl border p-4 md:grid-cols-5">
        <select value={form.routeId} onChange={(e)=>setForm({...form, routeId:e.target.value})} required className="rounded-lg border px-3 py-2 text-sm">
          <option value="">Choisir route</option>
          {routes.map((r)=><option key={r.id} value={r.id}>{r.originCity} → {r.destinationCity}</option>)}
        </select>
        <input type="datetime-local" value={form.departureAt} onChange={(e)=>setForm({...form, departureAt:e.target.value})} required className="rounded-lg border px-3 py-2 text-sm" />
        <input type="number" value={form.price} onChange={(e)=>setForm({...form, price:Number(e.target.value)})} placeholder="Prix XAF" className="rounded-lg border px-3 py-2 text-sm" />
        <input type="number" value={form.totalSeats} onChange={(e)=>setForm({...form, totalSeats:Number(e.target.value)})} placeholder="Places" className="rounded-lg border px-3 py-2 text-sm" />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Créer</button>
      </form>
      <button onClick={onBulk} className="rounded-lg border px-4 py-2 text-sm font-medium">Créer lot 3 jours (bulk)</button>
      <DataTable
        columns={columns}
        data={items as unknown as Record<string, unknown>[]}
        isLoading={loading}
        emptyMessage="Aucun trajet."
      />
    </div>
  )
}
