import Link from "next/link"
import { notFound } from "next/navigation"
import { fetchAgency } from "@/lib/api/agencies"
import { AMENITY_LABEL, type AgencyRoute } from "@camermove/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, MapPin, Phone, Star, Bus, Users, Building2 } from "lucide-react"
import { DynamicIcon } from "@/components/ui/dynamic-icon"
import { cn, shade } from "@/lib/utils"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const a = await fetchAgency(slug)
  if (!a) return { title: "Agence introuvable · CamerMove" }
  return { title: `${a.companyName} · CamerMove`, description: a.tagline }
}

export default async function AgencyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const a = await fetchAgency(slug)
  if (!a) notFound()

  const brand = a.brand.primary

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 pb-12 pt-24">
      {/* Brand hero */}
      <header
        className="overflow-hidden rounded-3xl px-6 py-6 text-white shadow-xl"
        style={{ background: `linear-gradient(135deg, ${brand} 0%, ${shade(brand, -25)} 100%)` }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <DynamicIcon name={a.brand.icon} className="size-8 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                {a.category} · Depuis {a.yearFounded}
              </p>
              <h1 className="text-3xl font-bold leading-tight">{a.companyName}</h1>
              <p className="text-sm text-white/85">{a.tagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
              <Star className="size-4 fill-amber-300 text-amber-300" />
              {a.ratingAvg != null ? a.ratingAvg.toFixed(1) : "—"} · {a.ratingCount} avis
            </div>
            {a.phone && (
              <a href={`tel:${a.phone}`}>
                <Button size="sm" variant="secondary" className="rounded-full gap-1.5">
                  <Phone className="size-3.5" /> {a.phone}
                </Button>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Description */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 p-5">
            <h2 className="text-lg font-semibold">À propos</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{a.description}</p>
            <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-4">
              <Stat icon={<Bus className="size-4" />} label="Flotte" value={`${a.fleetCount} bus`} />
              <Stat icon={<Users className="size-4" />} label="Passagers / jour" value={`${a.activeDeparturesToday}`} />
              <Stat icon={<MapPin className="size-4" />} label="Agences" value={`${a.branchCities.length + 1}`} />
              <Stat icon={<Building2 className="size-4" />} label="Siège" value={a.city ?? "Cameroun"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="text-lg font-semibold">Équipements</h2>
            <div className="flex flex-wrap gap-1.5">
              {a.amenities.map((am) => (
                <Badge key={am} variant="secondary" className="gap-1 text-[11px]">
                  <DynamicIcon name={AMENITY_LABEL[am]?.icon} className="size-3" />
                  {AMENITY_LABEL[am]?.label}
                </Badge>
              ))}
            </div>
            <Separator />
            <h3 className="text-sm font-semibold">Classes servies</h3>
            <div className="flex flex-wrap gap-1.5">
              {a.serviceClasses.map((sc) => (
                <Badge key={sc} variant="default" className="text-[11px]">{sc}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Routes */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Trajets opérés</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {a.routesDetailed.map((r, i) => (
            <Link
              key={i}
              href={`/results?origin=${encodeURIComponent(r.origin)}&destination=${encodeURIComponent(r.destination)}&pax=1`}
            >
              <Card
                className="h-full transition-all hover:shadow-md"
                style={{ borderColor: `${brand}30` }}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {r.origin} <ArrowRight className="size-3 text-muted-foreground" /> {r.destination}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {r.classType} · {Math.floor(r.durationMinutes / 60)}h{(r.durationMinutes % 60).toString().padStart(2, "0")} · {r.dailyDepartures} dép./j
                    </p>
                  </div>
                  <p className="text-base font-bold" style={{ color: brand }}>
                    {r.basePriceXaf.toLocaleString("fr-FR")}<span className="ml-0.5 text-xs font-medium">XAF</span>
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Star className="size-5 fill-amber-400 text-amber-400" />
          Avis voyageurs ({a.reviews.ratingCount})
        </h2>
        {a.reviews.items.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Aucun avis publié pour le moment.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {a.reviews.items.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {r.author.firstName ?? "?"} {r.author.lastName?.[0] ?? ""}.
                    </span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={cn(
                            "size-3.5",
                            n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-xs leading-relaxed text-muted-foreground">{r.comment}</p>}
                  {r.punctuality != null && (
                    <div className="flex flex-wrap gap-2 pt-1 text-[10px] text-muted-foreground">
                      <SubScoreChip label="Ponctualité" value={r.punctuality} />
                      {r.comfort != null && <SubScoreChip label="Confort" value={r.comfort} />}
                      {r.cleanliness != null && <SubScoreChip label="Propreté" value={r.cleanliness} />}
                      {r.service != null && <SubScoreChip label="Service" value={r.service} />}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="text-center">
        <Link href="/agencies" className="text-xs text-muted-foreground hover:text-foreground">
          ← Retour à l'annuaire
        </Link>
      </div>
    </main>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  )
}

function SubScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md bg-muted px-2 py-0.5">
      {label} <strong>{value}/5</strong>
    </span>
  )
}

function Separator() {
  return <div className="my-3 h-px bg-border" />
}

