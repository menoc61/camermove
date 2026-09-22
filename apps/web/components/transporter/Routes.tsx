"use client"
import { useEffect, useState } from "react"
import { listRoutes, createRoute, deleteRoute } from "@/lib/api/transporter"
import { DataTable, type Column } from "@/components/dashboard-v2/panels/DataTable"
import { Button } from "@/components/ui/button"

type RouteRow = { id: string; originCity: string; destinationCity: string; active: boolean }

export function RoutesClient({ token }: { token: string }) {
  const [items, setItems] = useState<RouteRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ originCity: "", destinationCity: "" })
  const refresh = () => { setLoading(true); return listRoutes(token).then(setItems as never).catch((e) => setError(e.message)).finally(() => setLoading(false)) }
  useEffect(() => { refresh() }, [token])
  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    try { await createRoute(token, form); setForm({ originCity: "", destinationCity: "" }); refresh() } catch (err) { setError((err as Error).message) }
  }
  async function onDelete(id: string) {
    if (!window.confirm("Supprimer cet itinéraire ?")) return
    try { await deleteRoute(token, id); refresh() } catch (err) { setError((err as Error).message) }
  }

  const columns: Column[] = [
    {
      key: "route",
      label: "Itinéraire",
      render: (_v, row) => <span className="font-medium">{String(row.originCity)} → {String(row.destinationCity)}</span>,
      sortValue: (row) => `${String(row.originCity ?? "")} ${String(row.destinationCity ?? "")}`,
    },
    {
      key: "active",
      label: "Statut",
      render: (v) => (v ? "Actif" : "Inactif"),
      sortValue: (row) => (row.active ? 1 : 0),
    },
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
      <h1 className="text-2xl font-bold">Itinéraires</h1>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <form onSubmit={onCreate} className="flex flex-wrap gap-2 rounded-2xl border p-4">
        <input placeholder="Ville départ (ex: Yaoundé)" value={form.originCity} onChange={(e)=>setForm({...form, originCity:e.target.value})} required className="rounded-lg border px-3 py-2 text-sm" />
        <input placeholder="Ville arrivée (ex: Douala)" value={form.destinationCity} onChange={(e)=>setForm({...form, destinationCity:e.target.value})} required className="rounded-lg border px-3 py-2 text-sm" />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Créer</button>
      </form>
      <DataTable
        columns={columns}
        data={items as unknown as Record<string, unknown>[]}
        isLoading={loading}
        emptyMessage="Aucune route."
      />
    </div>
  )
}
