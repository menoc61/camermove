"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { fetchAgenciesList, type AgenciesQuery, type AgencyListItem } from "@/lib/api/agencies"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CITIES, type AgencyCategory, type VehicleAmenity } from "@camermove/shared"
import { Search, Star, MapPin, Bus, X } from "lucide-react"
import { DynamicIcon } from "@/components/ui/dynamic-icon"
import { cn, shade } from "@/lib/utils"

const CATEGORY_LABEL: Record<AgencyCategory, string> = {
  interurban: "Interurbain",
  urban: "Intra-urbain",
  mixed: "Mixte",
  parcel: "Colis",
  rental: "Location",
  vip: "VIP",
}

type AmenityMap = Record<VehicleAmenity, { label: string; icon: string }>

interface Props {
  initial: { items: AgencyListItem[]; total: number }
  initialFilters: AgenciesQuery
  amenityLabels: AmenityMap
}

export function AgencyDirectory({ initial, initialFilters, amenityLabels }: Props) {
  const [filters, setFilters] = useState<AgenciesQuery>(initialFilters)

  const query = useQuery({
    queryKey: ["agencies", filters],
    queryFn: () => fetchAgenciesList(filters),
    initialData: filters === initialFilters ? initial : undefined,
    placeholderData: (prev) => prev,
  })

  const items = query.data?.items ?? []

  return (
    <div className="space-y-5">
      <FilterBar filters={filters} onChange={setFilters} />

      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">{query.data?.total ?? 0}</span> agence
          {(query.data?.total ?? 0) > 1 ? "s" : ""} correspondant
          {(query.data?.total ?? 0) > 1 ? "es" : ""}
          {filters.city ? ` à ${filters.city}` : ""}
          {filters.q ? ` · "${filters.q}"` : ""}
        </p>
        {(filters.city || filters.q || filters.category) && (
          <button
            type="button"
            onClick={() => setFilters({})}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <X className="size-3" /> Réinitialiser
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Aucune agence ne correspond à ces critères.
            </CardContent>
          </Card>
        ) : (
          items.map((agency) => <AgencyCard key={agency.id} agency={agency} amenityLabels={amenityLabels} />)
        )}
      </div>
    </div>
  )
}

function FilterBar({
  filters,
  onChange,
}: {
  filters: AgenciesQuery
  onChange: (f: AgenciesQuery) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une agence…"
          className="pl-9"
          value={filters.q ?? ""}
          onChange={(e) => onChange({ ...filters, q: e.target.value || undefined })}
        />
      </div>
      <Select
        value={filters.city ?? "__all__"}
        onValueChange={(v) => onChange({ ...filters, city: v && v !== "__all__" ? v : undefined })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Toutes les villes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Toutes les villes</SelectItem>
          {Object.values(CITIES).map((c) => (
            <SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.category ?? "__all__"}
        onValueChange={(v) => onChange({ ...filters, category: v === "__all__" ? undefined : (v as AgencyCategory) })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Toutes catégories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Toutes catégories</SelectItem>
          {(Object.keys(CATEGORY_LABEL) as AgencyCategory[]).map((k) => (
            <SelectItem key={k} value={k}>{CATEGORY_LABEL[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function AgencyCard({ agency, amenityLabels }: { agency: AgencyListItem; amenityLabels: AmenityMap }) {
  return (
    <Link href={`/agencies/${agency.id}`} className="block group">
      <Card
        className="overflow-hidden border-2 transition-all hover:shadow-lg"
        style={{ borderColor: agency.brand.primary + "30" }}
      >
        {/* Brand band */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 text-white"
          style={{ background: `linear-gradient(135deg, ${agency.brand.primary} 0%, ${shade(agency.brand.primary, -20)} 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/15 backdrop-blur-sm">
              <DynamicIcon name={agency.brand.icon} className="size-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                {CATEGORY_LABEL[agency.category]}
              </p>
              <h3 className="font-semibold leading-tight">{agency.companyName}</h3>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-medium">
            <Star className="size-3 fill-amber-300 text-amber-300" />
            {agency.ratingAvg != null ? agency.ratingAvg.toFixed(1) : "—"}
            <span className="opacity-70">({agency.ratingCount})</span>
          </div>
        </div>

        <CardContent className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground line-clamp-2">{agency.tagline}</p>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <Badge variant="secondary" className="gap-1">
              <MapPin className="size-3" /> {agency.city ?? "Cameroun"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Bus className="size-3" /> {agency.fleetCount} bus
            </Badge>
            {agency.activeDeparturesToday > 0 && (
              <Badge variant="default" className="gap-1">
                {agency.activeDeparturesToday} départs auj.
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {agency.routes.slice(0, 4).map((r, i) => (
              <span
                key={i}
                className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px]"
              >
                {r.origin} → {r.destination}
              </span>
            ))}
            {agency.routes.length > 4 && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                +{agency.routes.length - 4}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 text-muted-foreground">
            {agency.amenities.slice(0, 5).map((a) => (
              <span key={a} title={amenityLabels[a]?.label} className="inline-flex">
                <DynamicIcon name={amenityLabels[a]?.icon} className="size-4" />
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
            <span>Depuis {agency.yearFounded}</span>
            <span className="font-semibold text-foreground">
              dès {Math.min(...agency.routes.map((r) => r.priceFromXaf)).toLocaleString("fr-FR")} XAF
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
