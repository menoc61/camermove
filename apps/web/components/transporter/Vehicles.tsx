"use client"
import { useEffect, useState } from "react"
import { listVehicles, createVehicle, deleteVehicle } from "@/lib/api/transporter"
import { DataTable, type Column } from "@/components/dashboard-v2/panels/DataTable"
import { Button } from "@/components/ui/button"

type VehicleRow = { id: string; type: string; capacity: number; plateNumber: string | null; status: string }

export function VehiclesClient({ token }: { token: string }) {
  const [items, setItems] = useState<VehicleRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ type: "", capacity: 30, plateNumber: "" })

  const refresh = () => { setLoading(true); return listVehicles(token).then(setItems as never).catch((e) => setError(e.message)).finally(() => setLoading(false)) }
  useEffect(() => { refresh() }, [token])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    try { await createVehicle(token, { type: form.type, capacity: Number(form.capacity), plateNumber: form.plateNumber || undefined }); setForm({ type: "", capacity: 30, plateNumber: "" }); refresh() } catch (err) { setError((err as Error).message) }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Supprimer ce véhicule ?")) return
    try { await deleteVehicle(token, id); refresh() } catch (err) { setError((err as Error).message) }
  }

  const columns: Column[] = [
    { key: "type", label: "Type" },
    { key: "capacity", label: "Capacité", sortValue: (row) => Number(row.capacity ?? 0) },
    { key: "plateNumber", label: "Plaque", render: (v) => String(v ?? "—") },
    { key: "status", label: "Statut" },
    {
      key: "actions-col",
      label: "Actions",
      sortable: false,
      render: (_v, row) => (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void onDelete(String(row.id))}>Supprimer</Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Véhicules</h1>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <form onSubmit={onCreate} className="flex flex-wrap gap-2 rounded-2xl border p-4">
        <input placeholder="Type (ex: Bus 50 places)" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})} required className="rounded-lg border px-3 py-2 text-sm" />
        <input type="number" placeholder="Capacité" value={form.capacity} onChange={(e) => setForm({...form, capacity: Number(e.target.value)})} required className="w-24 rounded-lg border px-3 py-2 text-sm" />
        <input placeholder="Plaque (optionnel)" value={form.plateNumber} onChange={(e) => setForm({...form, plateNumber: e.target.value})} className="rounded-lg border px-3 py-2 text-sm" />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Ajouter</button>
      </form>
      <DataTable
        columns={columns}
        data={items as unknown as Record<string, unknown>[]}
        isLoading={loading}
        emptyMessage="Aucun véhicule."
      />
    </div>
  )
}
