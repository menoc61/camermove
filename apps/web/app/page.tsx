import Link from "next/link"
import { prisma } from "@camermove/db"
import { Hero } from "@/components/landing/Hero"
import { StatsBand } from "@/components/landing/StatsBand"
import { Steps } from "@/components/landing/Steps"
import { PriceSimulator } from "@/components/landing/PriceSimulator"
import { NextDepartures } from "@/components/landing/NextDepartures"
import { PartnerCta } from "@/components/landing/PartnerCta"
import { SiteFooter } from "@/components/landing/SiteFooter"
import { MotionSection } from "@/components/landing/MotionSection"
import { AgencyMapDynamic } from "@/components/landing/AgencyMapDynamic"
import { GsapBatchReveal } from "@/components/landing/GsapBatchReveal"
import { ServicesBento } from "@/components/landing/ServicesBento"
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
        where: {
          status: "active",
          seatAvailability: { seatsAvailable: { gte: 1 } },
        },
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
      <main>
        <Hero
          minPrice={minPrice != null ? minPrice : undefined}
          nextDepartureAt={trips[0]?.departureAt}
        />

        <StatsBand
          minPrice={minPrice}
          hotelsCount={hotelsCount}
          rentalsCount={rentalsCount}
        />

        <Steps />

        <ServicesBento hotelsCount={hotelsCount} rentalsCount={rentalsCount} />

        <MotionSection>
          <section className="border-t border-line bg-paper text-ink">
            <div className="mx-auto max-w-[1560px] px-6 py-20 sm:px-8 md:px-12 md:py-28">
              <div className="grid grid-cols-12 gap-x-6 gap-y-10">
                <div className="col-span-12 md:col-span-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
                    06 — Simulateur
                  </p>
                  <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.025em] text-balance">
                    Vérifiez le prix de votre trajet en direct.
                  </h2>
                  <p className="mt-4 text-[15px] leading-[1.55] text-ink-1">
                    Entrez votre ville de départ et la destination. CamerMove
                    interroge les transporteurs partenaires en temps réel.
                  </p>
                </div>
                <div className="col-span-12 md:col-span-8">
                  <div className="border border-line bg-surface-1 p-6 sm:p-8">
                    <PriceSimulator />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </MotionSection>

        <MotionSection direction="scale">
          <section
            id="agences"
            aria-label="Agences partenaires"
            className="border-t border-line bg-paper text-ink"
          >
            <div className="mx-auto max-w-[1560px] px-6 py-20 sm:px-8 md:px-12 md:py-28">
              <div className="mb-10 flex flex-col gap-6 border-b border-line pb-8 md:mb-12 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
                    07 — Réseau
                  </p>
                  <h2 className="mt-3 text-[clamp(1.8rem,3.2vw,2.8rem)] font-medium leading-[1.02] tracking-[-0.025em] text-balance">
                    Nos agences partenaires au Cameroun
                  </h2>
                </div>
                <p className="max-w-[40ch] text-[14px] leading-[1.55] text-ink-1">
                  {agencies.length} transporteurs approuvés · points de
                  départ vérifiés.
                </p>
              </div>
              <div className="border border-line">
                <AgencyMapDynamic agencies={agencies} />
              </div>
              <ul className="sr-only">
                {agencies.map((a) => (
                  <li key={a.id}>
                    <a href={`/results?origin=${encodeURIComponent(a.city ?? "")}&pax=1`}>
                      {a.companyName}, {a.city ?? "Cameroun"}
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
