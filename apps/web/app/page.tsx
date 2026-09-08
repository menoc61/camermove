import Link from "next/link"
import { Bed, Bus, Car, Package, Shield, Ticket } from "lucide-react"
import { prisma } from "@camermove/db"
import { SiteNav } from "@/components/landing/SiteNav"
import { Hero } from "@/components/landing/Hero"
import { Steps } from "@/components/landing/Steps"
import { PriceSimulator } from "@/components/landing/PriceSimulator"
import { NextDepartures } from "@/components/landing/NextDepartures"
import { PartnerCta } from "@/components/landing/PartnerCta"
import { SiteFooter } from "@/components/landing/SiteFooter"
import { MotionSection } from "@/components/landing/MotionSection"
import { AgencyMapDynamic } from "@/components/landing/AgencyMapDynamic"
import { GsapBatchReveal } from "@/components/landing/GsapBatchReveal"
import type { SearchResultItem } from "@/lib/api/search"
import type { Agency } from "@/lib/api/agencies"

export default async function HomePage() {
  let minPrice: number | undefined
  let trips: SearchResultItem[] = []
  let agencies: Agency[] = []
  let hotelsCount = 0
  let rentalsCount = 0

  try {
    const [minTrip, upcomingTrips, agencyRows] = await Promise.all([
      prisma.trip.findFirst({
        where: { status: "active", seatAvailability: { seatsAvailable: { gte: 1 } } },
        orderBy: { price: "asc" },
        select: { price: true },
      }),
      prisma.trip.findMany({
        where: {
          status: "active",
          departureAt: { gte: new Date() },
          seatAvailability: { seatsAvailable: { gte: 1 } },
        },
        orderBy: { departureAt: "asc" },
        take: 6,
        include: {
          transport: { select: { companyName: true } },
          seatAvailability: true,
        },
      }),
      prisma.transporter.findMany({
        where: { status: "approved" },
        select: { id: true, companyName: true, city: true },
        take: 20,
      }),
    ])
    minPrice = minTrip?.price
    trips = upcomingTrips.map((t) => ({
      id: t.id,
      departureAt: t.departureAt.toISOString(),
      price: t.price,
      totalSeats: t.totalSeats,
      seatsAvailable: t.seatAvailability?.seatsAvailable ?? 0,
      transporterId: t.transportId,
      companyName: t.transport.companyName,
      vehicleTypeInfo: t.vehicleTypeInfo,
    }))
    agencies = agencyRows.map((r) => ({
      id: r.id,
      companyName: r.companyName,
      city: r.city,
      lat: null,
      lon: null,
      departurePointInfo: null,
    }))
  } catch {
    // DB unavailable — render without data
  }
  try {
    const [hc, rc] = await Promise.all([
      prisma.hotel.count({ where: { status: "active" } }),
      prisma.rentalVehicle.count({ where: { status: "available" } }),
    ])
    hotelsCount = hc
    rentalsCount = rc
  } catch {
    // best-effort
  }

  return (
    <>
      <SiteNav />
      <main>
        <Hero minPrice={minPrice != null ? minPrice : undefined} />
        {/* Services grid — transport dominant with warm styling */}
        <section className="relative overflow-hidden py-12 sm:py-16">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-[hsl(var(--brand)/0.02)] to-background" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 text-center">
              <span className="text-sm font-semibold uppercase tracking-widest text-[hsl(var(--brand))]">
                Nos services
              </span>
              <p className="mt-2 text-muted-foreground">
                Le transport interurbain est notre service principal
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-5">
              {/* Transport - Hero card (spans 2 cols, 2 rows) */}
              <Link
                href="/results?origin=Yaound%C3%A9&destination=Douala&pax=1"
                className="hover-lift group relative col-span-1 row-span-1 flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(var(--brand))] to-[hsl(var(--brand-dark))] p-6 text-white shadow-warm md:col-span-2 md:row-span-2 md:p-8"
              >
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
                <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-white/5" />
                <div className="relative">
                  <div className="inline-flex rounded-xl bg-white/20 p-2.5">
                    <Bus className="size-6 text-white" />
                  </div>
                  <h3 className="mt-4 text-2xl font-bold md:text-3xl">Transport interurbain</h3>
                  <p className="mt-2 max-w-[30ch] text-sm text-white/80 md:text-base">
                    Comparez et réservez vos billets de bus entre villes. Départs quotidiens Yaoundé ⇄ Douala.
                  </p>
                </div>
                <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white group-hover:gap-2 transition-all">
                  Réserver un bus <span>→</span>
                </span>
              </Link>

              {/* Hotels */}
              <Link href="/hotels" className="hover-lift group flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
                <div className="inline-flex w-fit rounded-xl bg-[hsl(var(--brand)/0.08)] p-2.5">
                  <Bed className="size-5 text-[hsl(var(--brand))]" />
                </div>
                <div className="mt-3">
                  <h3 className="font-semibold text-foreground">Hôtels & apparts</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{hotelsCount} hébergements</p>
                </div>
              </Link>

              {/* Rentals */}
              <Link href="/rentals" className="hover-lift group flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
                <div className="inline-flex w-fit rounded-xl bg-[hsl(var(--accent)/0.08)] p-2.5">
                  <Car className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-3">
                  <h3 className="font-semibold text-foreground">Location véhicules</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{rentalsCount} véhicules</p>
                </div>
              </Link>

              {/* Parcels */}
              <Link href="/parcels" className="hover-lift group flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
                <div className="inline-flex w-fit rounded-xl bg-[hsl(var(--brand-light)/0.1)] p-2.5">
                  <Package className="size-5 text-[hsl(var(--brand-dark))]" />
                </div>
                <div className="mt-3">
                  <h3 className="font-semibold text-foreground">Transport colis</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Envoi sécurisé</p>
                </div>
              </Link>

              {/* Insurance */}
              <Link href="/insurance" className="hover-lift group flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
                <div className="inline-flex w-fit rounded-xl bg-[hsl(var(--accent)/0.08)] p-2.5">
                  <Shield className="size-5 text-[hsl(var(--accent))]" />
                </div>
                <div className="mt-3">
                  <h3 className="font-semibold text-foreground">Assurance voyage</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Souscription en ligne</p>
                </div>
              </Link>

              {/* Events */}
              <Link href="/events" className="hover-lift group flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5 shadow-sm md:col-span-2">
                <div className="inline-flex w-fit rounded-xl bg-[hsl(var(--brand)/0.08)] p-2.5">
                  <Ticket className="size-5 text-[hsl(var(--brand))]" />
                </div>
                <div className="mt-3">
                  <h3 className="font-semibold text-foreground">Billetterie événements</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Découvrez et réservez vos places</p>
                </div>
              </Link>
            </div>
          </div>
        </section>
        <Steps />

        <MotionSection>
          <section className="bg-background">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tighter text-foreground md:text-4xl">
                  Vérifiez le prix de votre trajet
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                  Entrez votre ville de départ et destination pour voir les prix en temps réel.
                </p>
              </div>
              <div className="mx-auto mt-10 max-w-2xl">
                <PriceSimulator />
              </div>
            </div>
          </section>
        </MotionSection>

        <MotionSection direction="scale">
          <section id="agences" className="bg-background">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tighter text-foreground md:text-4xl">
                    Nos agences partenaires
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Retrouvez les points de départ de nos transporteurs partenaires au Cameroun.
                  </p>
                </div>
              </div>
              <div className="mt-10">
                <AgencyMapDynamic agencies={agencies} />
              </div>
              <ul className="sr-only">
                {agencies.map((a) => (
                  <li key={a.id}>
                    <a href={`/results?origin=${encodeURIComponent(a.city ?? "")}&pax=1`}>
                      {a.companyName} — {a.city ?? "Cameroun"}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </MotionSection>

        <NextDepartures trips={trips} />

        <div className="gsap-reveal">
          <PartnerCta />
        </div>
      </main>
      <div className="gsap-reveal">
        <SiteFooter />
      </div>
      <GsapBatchReveal />
    </>
  )
}


