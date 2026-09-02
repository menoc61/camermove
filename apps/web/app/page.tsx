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

  return (
    <>
      <SiteNav />
      <main>
        <Hero minPrice={minPrice != null ? minPrice : undefined} />
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


