"use client"
import { useEffect, useState } from "react"
import { listVehicles, createVehicle, deleteVehicle } from "@/lib/api/transporter"

export function VehiclesClient({ token }: { token: string }) {
  const [items, setItems] = useState<{ id: string; type: string; capacity: number; plateNumber: string | null; status: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ type: "", capacity: 30, plateNumber: "" })

  const refresh = () => listVehicles(token).then(setItems as never).catch((e) => setError(e.message))
  useEffect(() => { refresh() }, [token])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    try { await createVehicle(token, { type: form.type, capacity: Number(form.capacity), plateNumber: form.plateNumber || undefined }); setForm({ type: "", capacity: 30, plateNumber: "" }); refresh() } catch (err) { setError((err as Error).message) }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Véhicules</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={onCreate} className="flex flex-wrap gap-2 rounded-2xl border p-4">
        <input placeholder="Type (ex: Bus 50 places)" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})} required className="rounded-lg border px-3 py-2 text-sm" />
        <input type="number" placeholder="Capacité" value={form.capacity} onChange={(e) => setForm({...form, capacity: Number(e.target.value)})} required className="w-24 rounded-lg border px-3 py-2 text-sm" />
        <input placeholder="Plaque (optionnel)" value={form.plateNumber} onChange={(e) => setForm({...form, plateNumber: e.target.value})} className="rounded-lg border px-3 py-2 text-sm" />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Ajouter</button>
      </form>
      <ul className="divide-y rounded-2xl border">
        {items.map((v) => (
          <li key={v.id} className="flex items-center justify-between p-4">
            <div><div className="font-medium">{v.type} — {v.capacity} places</div><div className="text-xs text-muted-foreground">{v.plateNumber ?? "—"} · {v.status}</div></div>
            <button onClick={async () => { try { await deleteVehicle(token, v.id); refresh() } catch (err) { setError((err as Error).message) }}} className="text-sm text-destructive">Supprimer</button>
          </li>
        ))}
        {items.length === 0 && <li className="p-6 text-sm text-muted-foreground">Aucun véhicule.</li>}
      </ul>
    </div>
  )
}
