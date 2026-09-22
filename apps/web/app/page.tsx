import Link from "next/link"
import { Suspense } from "react"
import { Hero } from "@/components/landing/Hero"
import { Intro } from "@/components/landing/Intro"
import { StatsBand } from "@/components/landing/StatsBand"
import { Steps } from "@/components/landing/Steps"
import { PriceSimulator } from "@/components/landing/PriceSimulator"
import { PartnerCta } from "@/components/landing/PartnerCta"
import { SiteFooter } from "@/components/landing/SiteFooter"
import { MotionSection } from "@/components/landing/MotionSection"
import { AgencyMapDynamic } from "@/components/landing/AgencyMapDynamic"
import { GsapBatchReveal } from "@/components/landing/GsapBatchReveal"
import { Method } from "@/components/landing/Method"
import { TransportRail } from "@/components/landing/rails/TransportRail"
import { HotelsRail } from "@/components/landing/rails/HotelsRail"
import { RentalsRail } from "@/components/landing/rails/RentalsRail"
import { ParcelsRail } from "@/components/landing/rails/ParcelsRail"
import { InsuranceRail } from "@/components/landing/rails/InsuranceRail"
import { EventsRail } from "@/components/landing/rails/EventsRail"
import { fetchLandingStats, type LandingAgency } from "@/lib/api/landing"
import { FAQ_TEASER } from "@/lib/data/faq"
import { UrbanBands } from "@/components/landing/UrbanBands"

function RailSkeleton() {
  return (
    <section aria-hidden className="border-t border-line bg-paper">
      <div className="mx-auto max-w-[1560px] px-6 py-16 sm:px-8 md:px-12">
        <div className="h-4 w-40 animate-pulse bg-line" />
        <div className="mt-4 h-8 w-2/3 animate-pulse bg-line" />
        <div className="mt-8 flex gap-4 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 w-[78vw] shrink-0 animate-pulse bg-surface-1 sm:w-[380px]" />
          ))}
        </div>
      </div>
    </section>
  )
}

export default async function HomePage() {
  let minPrice: number | undefined
  let nextDepartureAt: string | undefined
  let hotelsCount: number | undefined
  let rentalsCount: number | undefined
  let agencies: LandingAgency[] = []

  try {
    const stats = await fetchLandingStats()
    minPrice = stats.minPrice ?? undefined
    nextDepartureAt = stats.nextDepartureAt ?? undefined
    hotelsCount = stats.hotelsCount
    rentalsCount = stats.rentalsCount
    agencies = stats.agencies ?? []
  } catch {
    // API unavailable — render without data
  }

  return (
    <>
      <Intro />
      <main>
        <Hero minPrice={minPrice} nextDepartureAt={nextDepartureAt} />

        <StatsBand
          minPrice={minPrice}
          hotelsCount={hotelsCount}
          rentalsCount={rentalsCount}
        />

        {/* Per user directive: intra-urban is the hero activity — show this
            rail BEFORE the interurban rails so it leads the page. */}
        <UrbanBands />

        <Suspense fallback={<RailSkeleton />}>
          <TransportRail />
        </Suspense>

        <Suspense fallback={<RailSkeleton />}>
          <HotelsRail />
        </Suspense>

        <Suspense fallback={<RailSkeleton />}>
          <RentalsRail />
        </Suspense>

        <Suspense fallback={<RailSkeleton />}>
          <ParcelsRail />
        </Suspense>

        <Suspense fallback={<RailSkeleton />}>
          <InsuranceRail />
        </Suspense>

        <Suspense fallback={<RailSkeleton />}>
          <EventsRail />
        </Suspense>

        <Method />

        <Steps />

        <MotionSection>
          <section className="border-t border-line bg-paper text-ink">
            <div className="mx-auto max-w-[1560px] px-6 py-20 sm:px-8 md:px-12 md:py-28">
              <div className="grid grid-cols-12 gap-x-6 gap-y-10">
                <div className="col-span-12 md:col-span-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
                    10 — Simulateur
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
                    11 — Réseau
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

        <div className="gsap-reveal">
          <PartnerCta />
        </div>

        {/* FAQ teaser — single source of truth lives in lib/data/faq.ts,
            shared with /faq. Keeps the home page self-explanatory without
            duplicating the long copy. */}
        <MotionSection>
          <section
            id="faq"
            aria-label="Questions fréquentes"
            className="border-t border-line bg-surface-1 text-ink"
          >
            <div className="mx-auto max-w-[1560px] px-6 py-20 sm:px-8 md:px-12 md:py-28">
              <div className="grid grid-cols-12 gap-x-6 gap-y-10">
                <div className="col-span-12 md:col-span-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-ink-2">
                    12 — Questions fréquentes
                  </p>
                  <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.025em] text-balance">
                    Tout ce que vous devez savoir, en un coup d'œil.
                  </h2>
                  <p className="mt-4 max-w-[40ch] text-[15px] leading-[1.55] text-ink-1">
                    Trajets, paiement, billets, annulation — les réponses aux
                    questions que nos voyageurs posent le plus souvent.
                  </p>
                  <Link
                    href="/faq"
                    className="mt-6 inline-flex h-11 items-center rounded-full border border-line bg-paper px-5 text-sm font-semibold hover:bg-surface-2"
                  >
                    Voir toutes les questions →
                  </Link>
                </div>
                <div className="col-span-12 md:col-span-8">
                  <div className="divide-y divide-line rounded-2xl border border-line bg-paper">
                    {FAQ_TEASER.map((f) => (
                      <details key={f.q} className="group p-5 open:bg-surface-1">
                        <summary className="cursor-pointer list-none text-[15px] font-medium flex justify-between gap-4">
                          <span>{f.q}</span>
                          <span className="text-ink-2 transition-transform group-open:rotate-45">+</span>
                        </summary>
                        <p className="mt-3 text-[14px] leading-[1.6] text-ink-1">{f.a}</p>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </MotionSection>
      </main>
      <div className="gsap-reveal">
        <SiteFooter />
      </div>
      <GsapBatchReveal />
    </>
  )
}
