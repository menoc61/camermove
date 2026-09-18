import Link from "next/link"
import {
  URBAN_LINES,
  URBAN_NETWORKS,
  findUrbanNetwork,
  cheapestUrbanFareXaf,
} from "@camermove/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, TramFront, Wallet, MapPin, Clock } from "lucide-react"

/**
 * UrbanBands — landing-page hero band dedicated to intra-urban transport.
 *
 * Per user directive: "the main app activity should be on the intra urban
 * transport so add all functionality around that ecosystem". This band
 * appears immediately after the stats strip so the visitor sees transit
 * before they see inter-city.
 *
 * SSOT: pulls lines, networks and the cheapest fare from the same registry
 * used by /intraurban and the seed — no duplication.
 */
export function UrbanBands() {
  const cheapest = cheapestUrbanFareXaf()

  return (
    <section
      aria-label="Réseau intra-urbain"
      className="relative overflow-hidden border-y border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:border-emerald-900 dark:from-emerald-950/40 dark:via-background dark:to-amber-950/30"
    >
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" aria-hidden>
        <svg viewBox="0 0 800 400" className="size-full">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0 L0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="800" height="400" fill="url(#grid)" className="text-emerald-900" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-[1560px] px-6 py-16 sm:px-8 md:px-12 md:py-24">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10">
          {/* Intro */}
          <div className="col-span-12 lg:col-span-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Activité principale · Mobilité urbaine
            </p>
            <h2 className="mt-3 text-[clamp(2rem,4vw,3.4rem)] font-medium leading-[1.02] tracking-[-0.025em] text-balance text-foreground">
              Le bus, le BRT et la carte <span className="text-emerald-700">Tap&amp;Go</span>.
              <br />
              Dès <span className="num-tabular">{cheapest.toLocaleString("fr-FR")} XAF</span>.
            </h2>
            <p className="mt-5 max-w-[40ch] text-[15px] leading-[1.55] text-muted-foreground">
              CamerMove opère le guichet unique du transport intra-urbain au Cameroun&nbsp;: lignes Trans-Yaoundé,
              BRT Douala (PMUD), Tap&amp;Go, Mobile Money et correspondances gratuites.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/intraurban">
                <Button className="rounded-full bg-emerald-700 px-6 hover:bg-emerald-800">
                  Explorer le réseau <ArrowRight className="ml-1 size-4" />
                </Button>
              </Link>
              <Link href="/results?origin=Yaound%C3%A9&destination=Mvan&pax=1">
                <Button variant="outline" className="rounded-full">Rechercher un trajet</Button>
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <Badge emoji="🚏" label={`${URBAN_LINES.length} lignes`} />
              <Badge emoji="🛑" label={`${URBAN_LINES.reduce((a, l) => a + l.stops.length, 0)} arrêts`} />
              <Badge emoji="🎫" label="Tap & Go" />
              <Badge emoji="📱" label="Mobile Money" />
            </div>
          </div>

          {/* Lines visualization */}
          <div className="col-span-12 lg:col-span-7">
            <div className="space-y-4">
              {URBAN_NETWORKS.map((net) => {
                const lines = URBAN_LINES.filter((l) => l.networkId === net.id)
                return (
                  <Card
                    key={net.id}
                    className="overflow-hidden border-2"
                    style={{ borderColor: "#0E5C4030" }}
                  >
                    <div className="flex items-center justify-between bg-gradient-to-br from-emerald-700 to-emerald-900 px-4 py-2.5 text-white">
                      <div className="flex items-center gap-2">
                        <TramFront className="size-5" />
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-80">
                            {net.operatorName.split(" — ")[0]}
                          </p>
                          <h3 className="text-sm font-bold leading-tight">{net.brand}</h3>
                        </div>
                      </div>
                      <p className="text-[10px] uppercase tracking-wider opacity-80">{net.tagline}</p>
                    </div>
                    <CardContent className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
                      {lines.map((l) => (
                        <Link
                          key={l.id}
                          href={`/intraurban/line/${l.id}`}
                          className="group flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2 transition-colors hover:bg-muted"
                        >
                          <span
                            className="grid size-9 place-items-center rounded-lg font-mono text-sm font-bold text-white"
                            style={{ background: l.color }}
                          >
                            {l.code}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold leading-tight truncate">{l.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              <Clock className="inline size-3" /> {l.peakHeadwayMin}min · {l.stops.length} arrêts
                            </p>
                          </div>
                          <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      ))}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-white/80 p-4 text-xs dark:bg-card">
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-emerald-700" />
                <span>
                  <strong>Tap&amp;Go</strong> · ticket unitaire <strong>{cheapest.toLocaleString("fr-FR")} XAF</strong> · carnet 10 trajets <strong>2 200 XAF</strong>
                </span>
              </div>
              <Link href="/intraurban" className="font-medium text-emerald-700 hover:underline">
                Recharger ma carte →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Badge({ emoji, label }: { emoji: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/70 px-2.5 py-1 text-[11px] font-medium dark:border-emerald-900 dark:bg-card">
      <span aria-hidden>{emoji}</span> {label}
    </span>
  )
}