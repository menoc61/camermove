import { Suspense } from "react"
import Link from "next/link"
import { fetchAgenciesList, type AgenciesQuery } from "@/lib/api/agencies"
import { AgencyDirectory } from "@/components/agencies/AgencyDirectory"
import { AgencyDirectorySkeleton } from "@/components/agencies/AgencyDirectorySkeleton"
import { AMENITY_LABEL, type AgencyCategory } from "@camermove/shared"

export const metadata = {
  title: "Agences partenaires · CamerMove",
  description:
    "Toutes les agences de transport partenaires de CamerMove : Buca Voyages, General Express, Touristique Express, Princesse Voyages, Finexs, Musango et plus encore.",
}

async function load(params: AgenciesQuery) {
  try {
    return await fetchAgenciesList(params)
  } catch {
    return { items: [], total: 0 }
  }
}

export default async function AgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; category?: string; q?: string }>
}) {
  const sp = await searchParams
  const params: AgenciesQuery = {
    city: sp.city,
    category: (sp.category as AgencyCategory | undefined) || undefined,
    q: sp.q,
  }
  const data = await load(params)
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 pb-12 pt-24">
      <header className="flex flex-col gap-2 border-b pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Annuaire · Transporteurs partenaires
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Nos agences de transport</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Comparez les transporteurs interurbains et intra-urbains opérant au Cameroun.
          Notes vérifiées, équipements à bord, fréquence des départs, points de vente.
        </p>
      </header>

      <Suspense fallback={<AgencyDirectorySkeleton />}>
        <AgencyDirectory
          initial={data}
          initialFilters={params}
          amenityLabels={AMENITY_LABEL}
        />
      </Suspense>

      <section className="border-t pt-6 text-center text-xs text-muted-foreground">
        Vous êtes transporteur&nbsp;?
        <Link href="/become-partner" className="ml-1 font-medium text-foreground underline-offset-4 hover:underline">
          Devenir partenaire CamerMove →
        </Link>
      </section>
    </main>
  )
}