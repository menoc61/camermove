"use client"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { fetchUrbanLines, fetchUrbanSchedule } from "../../lib/api/intraurban"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Bus, Clock, MapPin } from "lucide-react"

export default function IntraurbanPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [origin, setOrigin] = useState("")
  const [dest, setDest] = useState("")

  const { data: lines } = useQuery({ queryKey: ["urban-lines"], queryFn: fetchUrbanLines })
  const { data: trips, isLoading } = useQuery({
    queryKey: ["urban-schedule", origin, dest, date],
    queryFn: () => fetchUrbanSchedule({ origin: origin || undefined, dest: dest || undefined, date }),
  })

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 pb-6 pt-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bus intraurbain — Yaoundé</h1>
        <p className="text-sm text-muted-foreground">Lignes urbaines · départ toutes les 30 min · 05:30–22:00 · ticket valable 2h · 400–500 XAF</p>
        <div className="mt-2 flex gap-2">
          <Badge variant="secondary">Hold 5 min</Badge>
          <Badge variant="outline">Flat fare</Badge>
          <Badge variant="outline">Sans réservation de siège</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rechercher un trajet urbain</CardTitle>
          <CardDescription>Choisissez arrêt de départ, arrivée et date (filtre contient, pas exact).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input placeholder="Départ (ex: Bastos)" value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-40" />
          <Input placeholder="Arrivée (ex: Mvan)" value={dest} onChange={(e) => setDest(e.target.value)} className="w-40" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </CardContent>
      </Card>

      {lines && lines.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {lines.map((l) => (
            <Card
              key={`${l.origin}-${l.dest}`}
              role="button"
              tabIndex={0}
              className="cursor-pointer hover:border-primary/50 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => { setOrigin(l.origin); setDest(l.dest) }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setOrigin(l.origin)
                  setDest(l.dest)
                }
              }}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <Bus className="size-4 text-primary" />
                  <span className="text-sm font-medium">{l.origin} → {l.dest}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{l.price} XAF</p>
                  <p className="text-xs text-muted-foreground">{l.tripCountToday} départs auj.</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Clock className="size-4" /> Prochains départs {dest || origin ? `· ${origin || "*"} → ${dest || "*"}` : ""}</h2>
        {isLoading ? (
          <><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></>
        ) : trips && trips.length > 0 ? (
          trips.slice(0, 20).map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="flex items-center gap-1 text-sm font-medium"><MapPin className="size-3" /> {t.line}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.departureAt).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })} · {t.seatsAvailable}/{t.totalSeats} places</p>
                  <p className="text-xs text-muted-foreground">Valable jusqu&apos;à {new Date(t.validUntil).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{t.price} XAF</p>
                  <Link href={`/book/${t.id}`}><Button size="sm" className="mt-1 rounded-full">Réserver</Button></Link>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Aucun départ pour cette recherche — essayez une autre combinaison.</CardContent></Card>
        )}
      </div>
    </main>
  )
}
