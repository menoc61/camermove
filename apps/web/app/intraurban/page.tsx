"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  URBAN_LINES,
  URBAN_NETWORKS,
  findUrbanNetwork,
  cheapestUrbanFareXaf,
  priceXaf,
  type UrbanLine,
  type UrbanNetworkId,
} from "@camermove/shared"
import { fetchUrbanLines, fetchUrbanSchedule } from "../../lib/api/intraurban"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  ArrowRight,
  Bus,
  Clock,
  MapPin,
  Search,
  Ticket,
  TramFront,
  Zap,
  Repeat,
  Route,
  Wallet,
} from "lucide-react"

export default function IntraurbanPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [origin, setOrigin] = useState("")
  const [dest, setDest] = useState("")
  const [networkId, setNetworkId] = useState<UrbanNetworkId | "all">("all")

  const { data: lines } = useQuery({ queryKey: ["urban-lines"], queryFn: fetchUrbanLines })
  const { data: trips, isLoading } = useQuery({
    queryKey: ["urban-schedule", origin, dest, date],
    queryFn: () => fetchUrbanSchedule({ origin: origin || undefined, dest: dest || undefined, date }),
  })

  const filteredLines = useMemo(() => {
    if (networkId === "all") return URBAN_LINES
    return URBAN_LINES.filter((l) => l.networkId === networkId)
  }, [networkId])

  const cheapest = cheapestUrbanFareXaf()

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 pb-12 pt-24">
      {/* Hero */}
      <header className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Activité principale · Mobilité urbaine
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Le bus, le BRT et la Tap&amp;Go.
          <br />
          <span className="text-muted-foreground">Dans toute la ville, à partir de {priceXaf(cheapest)}.</span>
        </h1>
        <p className="max-w-3xl text-base text-muted-foreground">
          CamerMove est la <strong className="text-foreground">plateforme officielle du transport intra-urbain</strong> à Yaoundé
          et Douala&nbsp;: Trans-Yaoundé (STECY, ex-Le Bus), BRT Douala (PMUD), itinéraires en temps réel,
          correspondance gratuite et rechargement de votre carte <em>Tap&amp;Go</em>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1"><Route className="size-3" /> {URBAN_LINES.length} lignes</Badge>
          <Badge variant="secondary" className="gap-1"><MapPin className="size-3" /> {URBAN_LINES.reduce((a, l) => a + l.stops.length, 0)} arrêts</Badge>
          <Badge variant="outline">Tap&amp;Go</Badge>
          <Badge variant="outline">Mobile Money</Badge>
          <Badge variant="outline">Sans réservation</Badge>
        </div>
      </header>

      {/* Networks overview */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {URBAN_NETWORKS.map((n) => {
          const lines = URBAN_LINES.filter((l) => l.networkId === n.id)
          return (
            <Card
              key={n.id}
              className="overflow-hidden border-2"
              style={{ borderColor: n.id === "stecy-yaounde" ? "#0E5C4060" : "#0E5C4060" }}
            >
              <div className="flex items-center justify-between bg-gradient-to-br from-emerald-700 to-emerald-900 px-4 py-3 text-white">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-80">Réseau</p>
                  <h3 className="text-lg font-bold">{n.brand}</h3>
                  <p className="text-xs opacity-80">{n.operatorName}</p>
                </div>
                <TramFront className="size-8 opacity-30" />
              </div>
              <CardContent className="space-y-3 p-4">
                <p className="text-sm text-muted-foreground">{n.tagline}</p>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <Badge variant="secondary">{lines.length} lignes</Badge>
                  <Badge variant="secondary">{lines.reduce((a, l) => a + l.stops.length, 0)} arrêts</Badge>
                  {n.hasETicket && <Badge>Tap&amp;Go</Badge>}
                  {n.paymentMethods.map((m) => (
                    <Badge key={m} variant="outline">{m}</Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {lines.map((l) => (
                    <Link
                      key={l.id}
                      href={`/intraurban/line/${l.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium hover:bg-muted"
                      style={{ borderColor: `${l.color}30` }}
                    >
                      <span className="block size-2 rounded-full" style={{ background: l.color }} />
                      {l.code} · {l.name}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      {/* Quick search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4" /> Rechercher un trajet urbain
          </CardTitle>
          <CardDescription>
            Choisissez arrêt de départ, arrivée et date. Filtre contient (pas exact).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input placeholder="Départ (ex: Bastos)" value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-44" />
          <Input placeholder="Arrivée (ex: Mvan)" value={dest} onChange={(e) => setDest(e.target.value)} className="w-44" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </CardContent>
      </Card>

      {/* Lines explorer */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bus className="size-5" /> Toutes les lignes
          </h2>
          <Tabs value={networkId} onValueChange={(v) => setNetworkId(v as UrbanNetworkId | "all")}>
            <TabsList>
              <TabsTrigger value="all">Toutes</TabsTrigger>
              <TabsTrigger value="stecy-yaounde">Trans-Yaoundé</TabsTrigger>
              <TabsTrigger value="pmud-douala">BRT Douala</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredLines.map((l) => (
            <LineCard key={l.id} line={l} />
          ))}
        </div>
      </section>

      {/* Popular lines from API */}
      {lines && lines.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Zap className="size-5 text-amber-500" /> Départs à venir
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {lines.map((l) => (
              <Card
                key={`${l.origin}-${l.dest}`}
                role="button"
                tabIndex={0}
                className="cursor-pointer transition-colors hover:border-emerald-500/50"
                onClick={() => { setOrigin(l.origin); setDest(l.dest) }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setOrigin(l.origin)
                    setDest(l.dest)
                  }
                }}
              >
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <Bus className="size-4 text-emerald-600" />
                    <span className="text-sm font-medium">{l.origin} → {l.dest}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{l.price} XAF</p>
                    <p className="text-[10px] text-muted-foreground">{l.tripCountToday} départs auj.</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Next departures from API */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Clock className="size-5" /> Prochains départs {dest || origin ? `· ${origin || "*"} → ${dest || "*"}` : ""}
        </h2>
        {isLoading ? (
          <><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></>
        ) : trips && trips.length > 0 ? (
          trips.slice(0, 20).map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="flex items-center gap-1 text-sm font-medium"><MapPin className="size-3" /> {t.line}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.departureAt).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })} · {t.seatsAvailable}/{t.totalSeats} places
                  </p>
                  <p className="text-xs text-muted-foreground">Valable jusqu'à {new Date(t.validUntil).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{t.price} XAF</p>
                  <Link href={`/book/${t.id}`}>
                    <Button size="sm" className="mt-1 rounded-full">
                      <Ticket className="mr-1 size-3" /> Réserver
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Aucun départ pour cette recherche — essayez une autre combinaison.</CardContent></Card>
        )}
      </section>

      {/* Tap & Go ecosystem */}
      <section className="rounded-3xl border-2 border-emerald-200 bg-emerald-50/40 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Wallet className="size-5 text-emerald-700" /> Tap&amp;Go · votre carte rechargeable
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Rechargez votre carte <strong>Tap&amp;Go</strong> directement depuis l'application, en Mobile Money.
          Bénéficiez du tarif unitaire, des carnets 10 trajets (-12&nbsp;%) et des abonnements mensuels.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FareCard label="Ticket unitaire" price="250 XAF" desc="Valable 1 trajet, correspondance 45 min" />
          <FareCard label="Carnet 10" price="2 200 XAF" desc="Économie 12 %" highlight />
          <FareCard label="Abonnement mensuel" price="9 000 XAF" desc="Voyages illimités, 1 mois" />
        </div>
        <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Repeat className="size-3" /> Correspondance gratuite dans la fenêtre de 45 minutes.
        </p>
      </section>
    </main>
  )
}

function LineCard({ line }: { line: UrbanLine }) {
  const network = findUrbanNetwork(line.networkId)
  return (
    <Link href={`/intraurban/line/${line.id}`}>
      <Card className="h-full overflow-hidden transition-all hover:shadow-md" style={{ borderColor: `${line.color}30` }}>
        <div className="flex items-center justify-between px-4 py-2 text-white" style={{ background: line.color }}>
          <span className="font-mono text-sm font-bold">{line.code}</span>
          <span className="text-[10px] uppercase tracking-[0.22em] opacity-80">{network?.brand}</span>
        </div>
        <CardContent className="space-y-2 p-4">
          <p className="font-semibold leading-tight">{line.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {line.stops.length} arrêts · {line.durationMinutes} min · Pic {line.peakHeadwayMin} min
          </p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="size-3" />
            {line.serviceWindow.startHour.toString().padStart(2, "0")}h00 – {line.serviceWindow.endHour.toString().padStart(2, "0")}h00
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-[11px]">
            <span>dès {line.fareBands[0] ? priceXaf(line.fareBands[0].priceXaf) : ""}</span>
            <ArrowRight className="size-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function FareCard({ label, price, desc, highlight }: { label: string; price: string; desc: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl border bg-white p-4 dark:bg-card",
      highlight && "border-emerald-500 ring-2 ring-emerald-200",
    )}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-emerald-700">{price}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  )
}

