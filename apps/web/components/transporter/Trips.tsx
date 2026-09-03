// @ts-nocheck
"use client"
import { useEffect, useState } from "react"
import { listTrips, createTrip, deleteTrip, bulkCreateTrips, listRoutes } from "@/lib/api/transporter"

export function TripsClient({ token }: { token: string }) {
  const [items, setItems] = useState<{ id: string; departureAt: string; price: number; totalSeats: number; status: string; route: { originCity: string; destinationCity: string } }[]>([])
  const [routes, setRoutes] = useState<{ id: string; originCity: string; destinationCity: string }[]>([])
  const [error, setError] = useState<string|null>(null)
  const [form, setForm] = useState({ routeId:"", departureAt:"", price:2500, totalSeats:50 })
  const refresh = () => listTrips(token).then((r)=>setItems(r.items as never)).catch((e)=>setError(e.message))
  useEffect(()=>{ refresh(); listRoutes(token).then(setRoutes as never).catch(()=>{}) },[token])
  async function onCreate(e: React.FormEvent){ e.preventDefault(); try{ await createTrip(token, { routeId: form.routeId, departureAt: new Date(form.departureAt).toISOString(), price: Number(form.price), totalSeats: Number(form.totalSeats) }); refresh() }catch(err){ setError((err as Error).message)}}
  async function onBulk(){ 
    if(!form.routeId || !form.departureAt) { setError("Route et date requis pour lot"); return }
    const base = new Date(form.departureAt)
    const trips = Array.from({length:3}).map((_,i)=>({ routeId: form.routeId, departureAt: new Date(base.getTime()+i*24*3600*1000).toISOString(), price: Number(form.price), totalSeats: Number(form.totalSeats)}))
    try{ await bulkCreateTrips(token, trips); refresh() }catch(err){ setError((err as Error).message)}
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Trajets</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
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
      <ul className="divide-y rounded-2xl border">
        {items.map((t)=>(
          <li key={t.id} className="flex items-center justify-between p-4">
            <div><div className="font-medium">{t.route?.originCity} → {t.route?.destinationCity} — {new Date(t.departureAt).toLocaleString("fr-CM")} </div><div className="text-xs text-muted-foreground">{t.price.toLocaleString()} XAF · {t.totalSeats} places · {t.status}</div></div>
            <button onClick={async()=>{try{await deleteTrip(token,t.id); refresh()}catch(err){setError((err as Error).message)}}} className="text-sm text-destructive">Supprimer</button>
          </li>
        ))}
        {items.length===0 && <li className="p-6 text-sm text-muted-foreground">Aucun trajet.</li>}
      </ul>
    </div>
  )
}
