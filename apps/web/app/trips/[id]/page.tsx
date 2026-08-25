"use client"
import { useParams } from "next/navigation"
export default function TripDetailPage() {
  const { id } = useParams()
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Trajet {String(id)}</h1>
      <p className="text-sm text-slate-500">Détails du trajet — réservation à venir (Lot 2).</p>
    </main>
  )
}
