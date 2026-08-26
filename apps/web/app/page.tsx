import { SiteNav } from "../components/landing/SiteNav"
import { Hero } from "../components/landing/Hero"
import { Steps } from "../components/landing/Steps"
import { NextDepartures } from "../components/landing/NextDepartures"
import { PartnerCta } from "../components/landing/PartnerCta"
import { SiteFooter } from "../components/landing/SiteFooter"
import { fetchSearch, type SearchResultItem } from "../lib/api/search"

export default async function Home() {
  let trips: SearchResultItem[] = []
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
  } catch {
    // API indisponible : la page reste utilisable sans la section départs
  }

  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Steps />
        <NextDepartures trips={trips} />
        <PartnerCta />
      </main>
      <SiteFooter />
    </>
  )
}
