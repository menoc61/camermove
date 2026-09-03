"use client"
import { useEffect, useState } from "react"
import { listRoutes, createRoute, deleteRoute } from "@/lib/api/transporter"

export function RoutesClient({ token }: { token: string }) {
  const [items, setItems] = useState<{ id: string; originCity: string; destinationCity: string; active: boolean }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ originCity: "", destinationCity: "" })
  const refresh = () => listRoutes(token).then(setItems as never).catch((e) => setError(e.message))
  useEffect(() => { refresh() }, [token])
  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    try { await createRoute(token, form); setForm({ originCity: "", destinationCity: "" }); refresh() } catch (err) { setError((err as Error).message) }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Itinéraires</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={onCreate} className="flex flex-wrap gap-2 rounded-2xl border p-4">
        <input placeholder="Ville départ (ex: Yaoundé)" value={form.originCity} onChange={(e)=>setForm({...form, originCity:e.target.value})} required className="rounded-lg border px-3 py-2 text-sm" />
        <input placeholder="Ville arrivée (ex: Douala)" value={form.destinationCity} onChange={(e)=>setForm({...form, destinationCity:e.target.value})} required className="rounded-lg border px-3 py-2 text-sm" />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Créer</button>
      </form>
      <ul className="divide-y rounded-2xl border">
        {items.map((r)=>(
          <li key={r.id} className="flex items-center justify-between p-4">
            <div><div className="font-medium">{r.originCity} → {r.destinationCity}</div><div className="text-xs text-muted-foreground">{r.active ? "Actif" : "Inactif"}</div></div>
            <button onClick={async()=>{try{await deleteRoute(token,r.id); refresh()}catch(err){setError((err as Error).message)}}} className="text-sm text-destructive">Supprimer</button>
          </li>
        ))}
        {items.length===0 && <li className="p-6 text-sm text-muted-foreground">Aucune route.</li>}
      </ul>
    </div>
  )
}
