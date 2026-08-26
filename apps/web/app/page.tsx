import { SiteNav } from "../components/landing/SiteNav"
import { Hero } from "../components/landing/Hero"
import { Steps } from "../components/landing/Steps"
import { PriceSimulator } from "../components/landing/PriceSimulator"
import { NextDepartures } from "../components/landing/NextDepartures"
import { PartnerCta } from "../components/landing/PartnerCta"
import { SiteFooter } from "../components/landing/SiteFooter"
import { fetchSearch, type SearchResultItem } from "../lib/api/search"

export default async function Home() {
  let trips: SearchResultItem[] = []
  let minPrice: number | undefined
  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const date = tomorrow.toISOString().slice(0, 10)
    const res = await fetchSearch({
      origin: "Yaoundé",
      destination: "Douala",
      date,
      pax: 1,
      sortBy: "departure_asc",
    })
    trips = res.items.slice(0, 3)
    minPrice = res.items.length > 0 ? Math.min(...res.items.map((t) => t.price)) : undefined
  } catch {
    // API indisponible : la page reste utilisable sans la section départs
  }

  return (
    <>
      <SiteNav />
      <main>
        <Hero minPrice={minPrice} />
        <Steps />

        <section id="tarifs" className="border-t border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tighter text-slate-900 md:text-4xl">
                Combien coûte votre trajet&nbsp;?
              </h2>
              <p className="mt-3 max-w-[55ch] text-sm leading-relaxed text-slate-600 md:text-base">
                Choisissez une date et un nombre de passagers : nous interrogeons les prix
                réels des transporteurs partenaires en direct. Aucune estimation au hasard.
              </p>
            </div>
            <PriceSimulator />
          </div>
        </section>

        <NextDepartures trips={trips} />
        <PartnerCta />
      </main>
      <SiteFooter />
    </>
  )
}
