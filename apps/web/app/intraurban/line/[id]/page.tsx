import Link from "next/link"
import { notFound } from "next/navigation"
import { findUrbanLine, findUrbanNetwork, URBAN_LINES, CITIES } from "@camermove/shared"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  Clock,
  MapPin,
  Repeat,
  ShieldCheck,
  TramFront,
  Wallet,
  Wifi,
} from "lucide-react"

export async function generateStaticParams() {
  return URBAN_LINES.map((l) => ({ id: l.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const line = findUrbanLine(id)
  if (!line) return { title: "Ligne introuvable · CamerMove" }
  return {
    title: `Ligne ${line.code} — ${line.name} · CamerMove`,
    description: `Horaires, arrêts, tarifs de la ligne ${line.code} (${line.name}).`,
  }
}

export default async function LinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const line = findUrbanLine(id)
  if (!line) notFound()
  const network = findUrbanNetwork(line.networkId)
  const city = CITIES[network!.city]

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 pb-12 pt-24">
      {/* Hero band */}
      <header
        className="overflow-hidden rounded-3xl px-6 py-6 text-white shadow-xl"
        style={{ background: `linear-gradient(135deg, ${line.color} 0%, ${shade(line.color, -30)} 100%)` }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-80">{network?.brand} · {city.label}</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <span className="font-mono text-3xl font-bold leading-none">{line.code}</span>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{line.name}</h1>
          </div>
          <TramFront className="size-12 opacity-20" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="bg-white/20 text-white">{line.stops.length} arrêts</Badge>
          <Badge variant="secondary" className="bg-white/20 text-white">{line.durationMinutes} min</Badge>
          <Badge variant="secondary" className="bg-white/20 text-white">
            Pic {line.peakHeadwayMin} min · Creuse {line.offPeakHeadwayMin} min
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white">
            {line.serviceWindow.startHour.toString().padStart(2, "0")}h – {line.serviceWindow.endHour.toString().padStart(2, "0")}h
          </Badge>
        </div>
      </header>

      {/* Line map visualization */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <MapPin className="size-5" /> Plan de la ligne
        </h2>
        <Card>
          <CardContent className="p-4">
            <ol className="relative space-y-3">
              <div
                className="absolute left-[14px] top-2 bottom-2 w-0.5"
                style={{ background: line.color }}
                aria-hidden
              />
              {line.stops.map((stop, idx) => (
                <li key={stop.id} className="relative pl-10">
                  <span
                    className="absolute left-2 top-1 grid size-6 place-items-center rounded-full text-[10px] font-bold text-white shadow"
                    style={{ background: stop.sheltered ? line.color : shade(line.color, 30) }}
                    aria-hidden
                  >
                    {idx + 1}
                  </span>
                  <div className="rounded-lg border bg-muted/30 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{stop.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Terminus +{stop.offsetMinutes} min
                          {stop.sheltered && " · 🏠 Abri"}
                          {stop.transfer && stop.transfer.length > 0 && (
                            <span> · 🔁 Correspondance {stop.transfer.join(", ")}</span>
                          )}
                        </p>
                      </div>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {Math.floor(stop.offsetMinutes / 60).toString().padStart(2, "0")}h{(stop.offsetMinutes % 60).toString().padStart(2, "0")}
                      </Badge>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* Fare bands */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Wallet className="size-5" /> Tarifs
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {line.fareBands.map((f, i) => (
            <Card key={i} className={i === 1 ? "border-emerald-500 ring-2 ring-emerald-200" : ""}>
              <CardContent className="space-y-2 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{f.label}</p>
                <p className="text-3xl font-bold text-emerald-700">
                  {f.priceXaf.toLocaleString("fr-FR")}<span className="ml-1 text-sm font-medium">XAF</span>
                </p>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <Repeat className="size-3" /> Correspondance gratuite dans la fenêtre de 45 minutes.
        </p>
      </section>

      {/* Schedule overview */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Clock className="size-5" /> Cadencement
        </h2>
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            <Stat label="Premier départ" value={`${line.serviceWindow.startHour.toString().padStart(2, "0")}h00`} />
            <Stat label="Dernier départ" value={`${line.serviceWindow.endHour.toString().padStart(2, "0")}h00`} />
            <Stat label="Fréquence pic" value={`${line.peakHeadwayMin} min`} />
            <Stat label="Fréquence creuse" value={`${line.offPeakHeadwayMin} min`} />
          </CardContent>
        </Card>
      </section>

      {/* Amenities */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5" /> À bord du {line.code}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Amenity emoji="📶" label="Wi-Fi gratuit" />
          <Amenity emoji="❄️" label="Climatisation" />
          <Amenity emoji="🎥" label="Vidéosurveillance" />
          <Amenity emoji="📍" label="Suivi GPS" />
          <Amenity emoji="🔌" label="Ports USB" />
          <Amenity emoji="🎫" label="Tap & Go" />
          <Amenity emoji="♿" label="Accès PMR" />
          <Amenity emoji="🛡️" label="Sécurité 24/7" />
        </div>
      </section>

      {/* CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/intraurban">
          <Button variant="outline" className="rounded-full">← Toutes les lignes</Button>
        </Link>
        <Link href="/results?origin=Yaound%C3%A9&destination=Mvan&pax=1">
          <Button className="rounded-full">Réserver un trajet <ArrowRight className="ml-1 size-4" /></Button>
        </Link>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  )
}

function Amenity({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
      <span className="text-lg">{emoji}</span>
      <span>{label}</span>
    </div>
  )
}

function shade(hex: string, percent: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i)
  if (!m) return hex
  const num = parseInt(m[1]!, 16)
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + Math.round((percent / 100) * 255)))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round((percent / 100) * 255)))
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round((percent / 100) * 255)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}