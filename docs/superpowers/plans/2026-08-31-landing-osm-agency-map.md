# Landing Page + OSM CityAutocomplete + AgencyMap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the landing page from a Yaoundé-Douala-only hero into a route-agnostic, OSM-powered experience with city autocomplete, price simulator v2, and an interactive agency map — all 100% open source.

**Architecture:** New Nominatim-backed Places API proxy (server-side, Redis-cached) + new Agencies endpoint that joins Transporter/Route/Trip. Frontend gets a reusable `CityAutocomplete` (Base UI Popover + debounced fetch), a Leaflet `AgencyMap` (SSR-disabled via `next/dynamic`), and a rewritten `PriceSimulator` with origin/destination/date/pax fields. Token sweep replaces hardcoded slate/white with semantic CSS variables. Encoding bugs (mojibake) fixed in `Hero.tsx` and `NextDepartures.tsx`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, `@base-ui/react` (Popover, Input, Select), Leaflet + react-leaflet, OSM Nominatim, Zod, Prisma 6, Redis (ioredis), pnpm workspaces.

## Global Constraints

- `pnpm -r typecheck` must pass after every task
- OSM policy: `User-Agent: CamerMove/1.0 (contact@camermove.cm)`, debounce 300ms, Redis cache 24h TTL
- No Google/Mapbox — all tiles from `tile.openstreetmap.org`
- Leaflet map wrapped in `next/dynamic` with `{ ssr: false }` and `Skeleton` fallback
- `priceXaf` helper lives in `packages/shared` (DRY across NextDepartures, PriceSimulator, TripCard, recap)
- All components use semantic tokens (`text-foreground`, `bg-card`, `border`, `text-muted-foreground`) — no `text-slate-*`
- Transporter has no lat/lng columns — MVP uses city-center fallback from Nominatim; no Prisma migration this phase

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `apps/api/src/places/schema.ts` | `PlacesAutocompleteQuery` Zod schema |
| `apps/api/src/places/service.ts` | Nominatim proxy, Redis cache, response mapper |
| `apps/api/src/places/routes.ts` | `GET /api/v1/places/autocomplete` |
| `apps/api/src/agencies/schema.ts` | `AgencyQuery` Zod schema |
| `apps/api/src/agencies/service.ts` | Transporter+Route+Trip join, city-center geocode fallback |
| `apps/api/src/agencies/routes.ts` | `GET /api/v1/agencies` |
| `apps/web/lib/api/places.ts` | `fetchPlaces(q)` client helper |
| `apps/web/lib/api/agencies.ts` | `fetchAgencies(city)` client helper |
| `apps/web/components/search/CityAutocomplete.tsx` | Input + Popover + debounced fetch |
| `apps/web/components/landing/AgencyMap.tsx` | Leaflet map, markers, popups (SSR disabled) |

### Modified files

| File | Change |
|------|--------|
| `apps/api/src/app.ts:50-63` | Register `placesRoutes` and `agenciesRoutes` |
| `apps/web/app/page.tsx:8-22` | Add agencies fetch + render `AgencyMap` section |
| `apps/web/app/layout.tsx:7` | Add Leaflet CSS import |
| `apps/web/components/landing/Hero.tsx:7-10,17-26,28,34` | Fix mojibake, replace `slate` tokens |
| `apps/web/components/landing/NextDepartures.tsx:10-12,19-31,43,50-58` | Fix mojibake, dedup `priceXaf` → shared |
| `apps/web/components/landing/PriceSimulator.tsx:24-56,58-123` | Origin/destination autocomplete, swap, breakdown |
| `apps/web/components/landing/SiteNav.tsx` | Add `#agences` nav anchor |
| `packages/shared/src/money.ts:15` | Add `priceXaf(n: number): string` export |
| `packages/shared/src/index.ts:1` | Export new helper |
| `apps/web/lib/api/search.ts:11-21` | Add `vehicleType?: string` to `SearchParams` |

---

## Tasks

### Task 1: `priceXaf` helper in shared package

**Files:**
- Modify: `packages/shared/src/money.ts:15-20`
- Modify: `packages/shared/src/index.ts:1`
- Test: `packages/shared/src/money.test.ts`

**Interfaces:**
- Consumes: nothing (leaf utility)
- Produces: `priceXaf(n: number): string` — formats integer XAF with thousands separator + " XAF" suffix

- [ ] **Step 1: Add `priceXaf` to `money.ts`**

Append to `packages/shared/src/money.ts`:

```ts
export function priceXaf(n: number): string {
  return `${new Intl.NumberFormat("fr-CM").format(n)} XAF`
}
```

- [ ] **Step 2: Verify export in `index.ts`**

`packages/shared/src/index.ts` already has `export * from "./money.js"` — no change needed.

- [ ] **Step 3: Add unit test**

Append to `packages/shared/src/money.test.ts`:

```ts
import { priceXaf } from "./money"

describe("priceXaf", () => {
  it("formats with thousands separator", () => {
    expect(priceXaf(5500)).toBe("5 500 XAF")
  })
  it("formats large numbers", () => {
    expect(priceXaf(125000)).toBe("125 000 XAF")
  })
  it("formats zero", () => {
    expect(priceXaf(0)).toBe("0 XAF")
  })
})
```

- [ ] **Step 4: Run test**

Run: `cd packages/shared && pnpm vitest run --reporter=verbose`
Expected: all tests PASS

- [ ] **Step 5: Typecheck shared**

Run: `cd packages/shared && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/money.ts packages/shared/src/money.test.ts
git commit -m "feat(shared): add priceXaf() formatter"
```

---

### Task 2: Places API — Zod schema + Nominatim proxy service

**Files:**
- Create: `apps/api/src/places/schema.ts`
- Create: `apps/api/src/places/service.ts`

**Interfaces:**
- Consumes: nothing (new module)
- Produces: `PlacesAutocompleteQuery` (Zod), `searchPlaces(query)` → `{ places: Place[] }`, `Place` type with `displayName, city, lat, lon, osmId`

- [ ] **Step 1: Create Zod schema**

Create `apps/api/src/places/schema.ts`:

```ts
import { z } from "zod"

export const PlacesAutocompleteQuery = z.object({
  q: z.string().min(1).max(100),
  countrycodes: z.string().default("cm"),
  limit: z.coerce.number().int().min(1).max(10).default(5),
})

export type PlacesAutocompleteQuery = z.infer<typeof PlacesAutocompleteQuery>
```

- [ ] **Step 2: Create Nominatim service**

Create `apps/api/src/places/service.ts`:

```ts
import { getRedis } from "@camermove/db"
import { cacheKey } from "@camermove/db"

interface Place {
  displayName: string
  city?: string
  lat: number
  lon: number
  osmId: string
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address?: { city?: string; town?: string; village?: string }
}

export async function searchPlaces(query: {
  q: string
  countrycodes: string
  limit: number
}): Promise<{ places: Place[] }> {
  const key = cacheKey("places", [query.q, query.countrycodes, String(query.limit)])
  const redis = getRedis()

  if (redis) {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached)
  }

  const params = new URLSearchParams({
    format: "json",
    q: query.q,
    countrycodes: query.countrycodes,
    limit: String(query.limit),
    addressdetails: "1",
    "accept-language": "fr",
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "CamerMove/1.0 (contact@camermove.cm)" },
  })

  if (!res.ok) {
    throw new Error(`Nominatim error: ${res.status}`)
  }

  const data: NominatimResult[] = await res.json()

  const places: Place[] = data.map((r) => ({
    displayName: r.display_name.split(",").slice(0, 2).join(",").trim(),
    city: r.address?.city ?? r.address?.town ?? r.address?.village,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    osmId: String(r.place_id),
  }))

  const result = { places }
  if (redis) {
    await redis.set(key, JSON.stringify(result), "EX", 86400)
  }
  return result
}
```

- [ ] **Step 3: Typecheck API**

Run: `cd apps/api && pnpm tsc --noEmit`
Expected: 0 errors (these files aren't imported yet — no errors expected)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/places/
git commit -m "feat(api): add places schema + Nominatim proxy service"
```

---

### Task 3: Places API — routes + wire into app

**Files:**
- Create: `apps/api/src/places/routes.ts`
- Modify: `apps/api/src/app.ts:50-63` (add register line)

**Interfaces:**
- Consumes: `PlacesAutocompleteQuery` from Task 2, `searchPlaces` from Task 2
- Produces: `GET /api/v1/places/autocomplete` endpoint

- [ ] **Step 1: Create routes**

Create `apps/api/src/places/routes.ts`:

```ts
import type { FastifyInstance } from "fastify"
import { PlacesAutocompleteQuery } from "./schema"
import { searchPlaces } from "./service"

export async function placesRoutes(app: FastifyInstance) {
  app.get("/places/autocomplete", async (req) => {
    const query = PlacesAutocompleteQuery.parse(req.query)
    return searchPlaces(query)
  })
}
```

- [ ] **Step 2: Wire into app.ts**

In `apps/api/src/app.ts`, add import after line 17:

```ts
import { placesRoutes } from "./places/routes"
```

Add register after line 63 (after `partnerApplicationRoutes`):

```ts
await app.register(placesRoutes, { prefix: "/api/v1" })
```

- [ ] **Step 3: Typecheck API**

Run: `cd apps/api && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/places/routes.ts apps/api/src/app.ts
git commit -m "feat(api): register /places/autocomplete route"
```

---

### Task 4: Agencies API — schema + service + routes

**Files:**
- Create: `apps/api/src/agencies/schema.ts`
- Create: `apps/api/src/agencies/service.ts`
- Create: `apps/api/src/agencies/routes.ts`
- Modify: `apps/api/src/app.ts:50-63` (add register line)

**Interfaces:**
- Consumes: nothing (new module, reads `Transporter`/`Route`/`Trip` via Prisma)
- Produces: `GET /api/v1/agencies?city=Yaoundé` → `{ agencies: Agency[] }`

- [ ] **Step 1: Create schema**

Create `apps/api/src/agencies/schema.ts`:

```ts
import { z } from "zod"

export const AgencyQuery = z.object({
  city: z.string().min(1).max(100),
})

export type AgencyQuery = z.infer<typeof AgencyQuery>
```

- [ ] **Step 2: Create service**

Create `apps/api/src/agencies/service.ts`:

```ts
import { prisma } from "@camermove/db"
import { getRedis, cacheKey } from "@camermove/db"

interface Agency {
  id: string
  companyName: string
  city: string | null
  lat: number | null
  lon: number | null
  departurePointInfo: string | null
}

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  "yaoundé": { lat: 3.848, lon: 11.498 },
  "douala": { lat: 4.051, lon: 9.767 },
  "bafoussam": { lat: 5.476, lon: 10.418 },
  "bamenda": { lat: 5.963, lon: 10.159 },
  "garoua": { lat: 9.301, lon: 13.397 },
  "maroua": { lat: 10.591, lon: 14.315 },
  "bertoua": { lat: 4.577, lon: 13.684 },
  "ebolowa": { lat: 2.900, lon: 11.150 },
  "kribi": { lat: 2.933, lon: 9.983 },
  "limbe": { lat: 4.023, lon: 9.206 },
}

function cityFallback(city: string): { lat: number; lon: number } | null {
  return CITY_COORDS[city.toLowerCase()] ?? null
}

export async function listAgencies(query: { city: string }): Promise<{ agencies: Agency[] }> {
  const key = cacheKey("agencies", [query.city])
  const redis = getRedis()

  if (redis) {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached)
  }

  const rows = await prisma.transporter.findMany({
    where: {
      status: "active",
      trips: {
        some: {
          route: {
            originCity: { equals: query.city, mode: "insensitive" as const },
          },
        },
      },
    },
    include: {
      trips: {
        where: {
          route: {
            originCity: { equals: query.city, mode: "insensitive" as const },
          },
          status: "active",
        },
        select: {
          departurePointInfo: true,
          route: { select: { originCity: true } },
        },
        take: 1,
      },
    },
  })

  const fallback = cityFallback(query.city)

  const agencies: Agency[] = rows.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    city: r.city,
    lat: fallback?.lat ?? null,
    lon: fallback?.lon ?? null,
    departurePointInfo: r.trips[0]?.departurePointInfo ?? null,
  }))

  const result = { agencies }
  if (redis) {
    await redis.set(key, JSON.stringify(result), "EX", 300)
  }
  return result
}
```

- [ ] **Step 3: Create routes**

Create `apps/api/src/agencies/routes.ts`:

```ts
import type { FastifyInstance } from "fastify"
import { AgencyQuery } from "./schema"
import { listAgencies } from "./service"

export async function agenciesRoutes(app: FastifyInstance) {
  app.get("/agencies", async (req) => {
    const query = AgencyQuery.parse(req.query)
    return listAgencies(query)
  })
}
```

- [ ] **Step 4: Wire into app.ts**

In `apps/api/src/app.ts`, add import after line 17:

```ts
import { agenciesRoutes } from "./agencies/routes"
```

Add register after `placesRoutes`:

```ts
await app.register(agenciesRoutes, { prefix: "/api/v1" })
```

- [ ] **Step 5: Typecheck API**

Run: `cd apps/api && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/agencies/ apps/api/src/app.ts
git commit -m "feat(api): add agencies endpoint with city-center geocode fallback"
```

---

### Task 5: Client API helpers — `fetchPlaces` + `fetchAgencies`

**Files:**
- Create: `apps/web/lib/api/places.ts`
- Create: `apps/web/lib/api/agencies.ts`

**Interfaces:**
- Consumes: API endpoints from Tasks 3 and 4
- Produces: `fetchPlaces(q)` → `Place[]`, `fetchAgencies(city)` → `Agency[]` (for client components)

- [ ] **Step 1: Create places client**

Create `apps/web/lib/api/places.ts`:

```ts
export interface Place {
  displayName: string
  city?: string
  lat: number
  lon: number
  osmId: string
}

export async function fetchPlaces(q: string): Promise<Place[]> {
  if (!q || q.length < 2) return []
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(
    `${base}/api/v1/places/autocomplete?q=${encodeURIComponent(q)}&countrycodes=cm&limit=5`,
    { cache: "no-store" }
  )
  if (!res.ok) throw new Error("places failed")
  const data = await res.json()
  return data.places
}
```

- [ ] **Step 2: Create agencies client**

Create `apps/web/lib/api/agencies.ts`:

```ts
export interface Agency {
  id: string
  companyName: string
  city: string | null
  lat: number | null
  lon: number | null
  departurePointInfo: string | null
}

export async function fetchAgencies(city: string): Promise<Agency[]> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  const res = await fetch(
    `${base}/api/v1/agencies?city=${encodeURIComponent(city)}`,
    { cache: "no-store" }
  )
  if (!res.ok) throw new Error("agencies failed")
  const data = await res.json()
  return data.agencies
}
```

- [ ] **Step 3: Typecheck web**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/api/places.ts apps/web/lib/api/agencies.ts
git commit -m "feat(web): add fetchPlaces and fetchAgencies client helpers"
```

---

### Task 6: `CityAutocomplete` component

**Files:**
- Create: `apps/web/components/search/CityAutocomplete.tsx`

**Interfaces:**
- Consumes: `fetchPlaces(q)` from Task 5
- Produces: `<CityAutocomplete value={city} onChange={setCity} placeholder="Départ" />`

- [ ] **Step 1: Create component**

Create `apps/web/components/search/CityAutocomplete.tsx`:

```tsx
"use client"

import { useState, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Place } from "@/lib/api/places"

interface CityAutocompleteProps {
  value: string
  onChange: (city: string) => void
  placeholder?: string
  className?: string
  id?: string
  "aria-label"?: string
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = "Ville",
  className,
  id,
  "aria-label": ariaLabel,
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [places, setPlaces] = useState<Place[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = id ? `${id}-listbox` : undefined

  const fetchPlaces = useCallback(async (q: string) => {
    if (q.length < 2) {
      setPlaces([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
      const res = await fetch(
        `${base}/api/v1/places/autocomplete?q=${encodeURIComponent(q)}&countrycodes=cm&limit=5`,
        { cache: "no-store" }
      )
      if (res.ok) {
        const data = await res.json()
        setPlaces(data.places)
        setOpen(data.places.length > 0)
      }
    } catch {
      setPlaces([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPlaces(val), 300)
  }

  function selectPlace(place: Place) {
    onChange(place.displayName)
    setOpen(false)
    setPlaces([])
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => places.length > 0 && setOpen(true)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        className={cn("w-full", className)}
        autoComplete="off"
      />
      {open && places.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel ?? "Villes"}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-popover p-1 text-sm shadow-lg"
        >
          {places.map((place) => (
            <li
              key={place.osmId}
              role="option"
              aria-selected={place.displayName === value}
              className="cursor-pointer rounded-lg px-3 py-2 hover:bg-accent hover:text-accent-foreground"
              onMouseDown={() => selectPlace(place)}
            >
              <span className="font-medium">{place.displayName}</span>
              {place.city && place.city !== place.displayName && (
                <span className="ml-1 text-muted-foreground">· {place.city}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck web**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/search/CityAutocomplete.tsx
git commit -m "feat(web): add CityAutocomplete with OSM Nominatim debounced search"
```

---

### Task 7: `AgencyMap` component

**Files:**
- Create: `apps/web/components/landing/AgencyMap.tsx`

**Interfaces:**
- Consumes: `Agency[]` from `fetchAgencies`
- Produces: `<AgencyMap city="Yaoundé" lat={3.848} lon={11.498} agencies={agencies} />` (SSR-disabled)

- [ ] **Step 1: Create component**

Create `apps/web/components/landing/AgencyMap.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import type { Agency } from "@/lib/api/agencies"

const DEFAULT_CENTER: [number, number] = [3.848, 11.498] // Yaoundé

const markerIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:12px;height:12px;background:#0e9f8f;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 12)
  }, [map, center])
  return null
}

interface AgencyMapProps {
  city?: string
  lat?: number
  lon?: number
  agencies: Agency[]
}

export function AgencyMapInner({ city, lat, lon, agencies }: AgencyMapProps) {
  const center: [number, number] =
    lat != null && lon != null ? [lat, lon] : DEFAULT_CENTER

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-xl border md:h-[420px]">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater center={center} />
        {agencies.map((a) =>
          a.lat != null && a.lon != null ? (
            <Marker key={a.id} position={[a.lat, a.lon]} icon={markerIcon}>
              <Popup>
                <div className="min-w-[180px] text-sm">
                  <p className="font-semibold">{a.companyName}</p>
                  {a.departurePointInfo && (
                    <p className="text-muted-foreground">{a.departurePointInfo}</p>
                  )}
                  {a.city && <p className="text-muted-foreground">{a.city}</p>}
                  <Link
                    href={`/results?origin=${encodeURIComponent(city ?? "")}&destination=&pax=1`}
                    className="mt-1 inline-block font-medium text-primary hover:underline"
                  >
                    Voir les départs →
                  </Link>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>
    </div>
  )
}

export function AgencyMap(props: AgencyMapProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <Skeleton className="h-[360px] w-full rounded-xl md:h-[420px]" />
  }

  return <AgencyMapInner {...props} />
}
```

- [ ] **Step 2: Typecheck web**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/landing/AgencyMap.tsx
git commit -m "feat(web): add AgencyMap with Leaflet + OSM tiles, SSR-disabled"
```

---

### Task 8: Fix mojibake + token sweep in Hero and NextDepartures

**Files:**
- Modify: `apps/web/components/landing/Hero.tsx:1-71`
- Modify: `apps/web/components/landing/NextDepartures.tsx:1-67`

**Interfaces:**
- Consumes: `priceXaf` from `@camermove/shared`
- Produces: cleaned Hero + NextDepartures with correct encoding and semantic tokens

- [ ] **Step 1: Fix Hero.tsx encoding + tokens**

Replace `apps/web/components/landing/Hero.tsx` content with:

```tsx
import Image from "next/image"
import { QrCode, ShieldCheck, Wallet } from "lucide-react"
import { SearchBar } from "../search/search-bar"
import { Badge } from "@/components/ui/badge"

const trust = [
  { icon: ShieldCheck, label: "Paiement Mobile Money sécurisé" },
  { icon: QrCode, label: "E-billet QR immédiat" },
  { icon: Wallet, label: "Meilleurs prix du jour" },
]

export function Hero({ minPrice }: { minPrice?: number }) {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-20 pt-10 sm:px-6 md:pt-16 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-dark">
            Yaoundé ⇄ Douala · quotidien
          </p>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.05] tracking-tighter text-foreground md:text-6xl">
            Le bus Yaoundé–Douala, réservé en deux minutes.
          </h1>
          <p className="mt-5 max-w-[65ch] text-base leading-relaxed text-muted-foreground md:text-lg">
            Comparez les départs du jour, payez par Mobile Money et recevez votre e-billet
            QR immédiatement.
          </p>

          <div className="relative z-10 mt-8 max-w-xl rounded-2xl border bg-card p-4 shadow-lg shadow-slate-900/5 sm:p-5">
            <SearchBar />
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4 text-primary-dark" strokeWidth={1.75} aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative hidden lg:col-span-6 lg:block">
          <div className="relative ml-auto aspect-[4/5] w-[78%] overflow-hidden rounded-3xl shadow-xl shadow-slate-900/10">
            <Image
              src="https://picsum.photos/seed/camermove-highway/900/1100"
              alt="Route interurbaine au Cameroun"
              fill
              priority
              sizes="(min-width: 1024px) 42vw, 0vw"
              className="object-cover"
            />
            {minPrice != null && (
              <Badge className="absolute left-4 top-4 bg-secondary font-bold text-secondary-foreground">
                À partir de {new Intl.NumberFormat("fr-CM").format(minPrice)} XAF
              </Badge>
            )}
          </div>
          <div className="absolute -bottom-6 left-0 aspect-[16/10] w-[46%] rotate-[-4deg] overflow-hidden rounded-2xl border-4 border-white shadow-lg shadow-slate-900/15">
            <Image
              src="https://picsum.photos/seed/camermove-douala/720/450"
              alt="Départ de bus à Douala"
              fill
              loading="lazy"
              sizes="(min-width: 1024px) 24vw, 0vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Fix NextDepartures.tsx encoding + tokens + dedup priceXaf**

Replace `apps/web/components/landing/NextDepartures.tsx` content with:

```tsx
import Link from "next/link"
import { priceXaf } from "@camermove/shared"
import type { SearchResultItem } from "../../lib/api/search"

function timeFr(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" })
}
function dateFr(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Douala" })
}

export function NextDepartures({ trips }: { trips: SearchResultItem[] }) {
  return (
    <section id="departures" className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-3xl font-bold tracking-tighter text-foreground md:text-4xl">
            Prochains départs Yaoundé → Douala
          </h2>
          <Link
            href="/results?origin=Yaound%C3%A9&destination=Douala&pax=1"
            className="text-sm font-semibold text-primary-dark underline-offset-4 hover:underline"
          >
            Voir tous les trajets →
          </Link>
        </div>

        {trips.length === 0 ? (
          <p className="mt-8 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Aucun départ disponible pour le moment — revenez bientôt.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t) => (
              <Link
                key={t.id}
                href={`/trips/${t.id}`}
                className="group rounded-lg border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-slate-900/5 active:translate-y-0 active:scale-[0.99]"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {timeFr(t.departureAt)}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary-dark">
                    {priceXaf(t.price)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{dateFr(t.departureAt)}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <span className="truncate text-muted-foreground">
                    {t.companyName}
                    {t.vehicleTypeInfo ? ` · ${t.vehicleTypeInfo}` : ""}
                  </span>
                  <span className="ml-2 shrink-0 font-medium text-primary-dark group-hover:underline">
                    Réserver
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Typecheck web**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/landing/Hero.tsx apps/web/components/landing/NextDepartures.tsx
git commit -m "fix(web): fix mojibake encoding + semantic tokens in Hero + NextDepartures"
```

---

### Task 9: Rewrite PriceSimulator with CityAutocomplete + swap + breakdown

**Files:**
- Modify: `apps/web/components/landing/PriceSimulator.tsx:1-124`
- Modify: `apps/web/lib/api/search.ts:11-21` (add vehicleType)

**Interfaces:**
- Consumes: `CityAutocomplete` from Task 6, `fetchSearch` from existing search API
- Produces: rewritten PriceSimulator with origin/destination/swap/date/pax/breakdown

- [ ] **Step 1: Add vehicleType to SearchParams**

In `apps/web/lib/api/search.ts`, add to `SearchParams` interface (after line 20):

```ts
  vehicleType?: string
```

- [ ] **Step 2: Rewrite PriceSimulator**

Replace `apps/web/components/landing/PriceSimulator.tsx` content with:

```tsx
"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowUpDown, Loader2, Search } from "lucide-react"
import { fetchSearch } from "../../lib/api/search"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { CityAutocomplete } from "@/components/search/CityAutocomplete"
import { priceXaf } from "@camermove/shared"

function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function PriceSimulator() {
  const [origin, setOrigin] = useState("")
  const [destination, setDestination] = useState("")
  const [date, setDate] = useState(todayPlus(1))
  const [pax, setPax] = useState("1")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ min: number; max: number; avg: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function swap() {
    setOrigin(destination)
    setDestination(origin)
  }

  async function check() {
    if (!origin || !destination) {
      setError("Veuillez remplir la ville de départ et la destination.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchSearch({
        origin,
        destination,
        date,
        pax: Number(pax),
        sortBy: "price_asc",
      })
      if (res.items.length === 0) {
        setResult(null)
        setError(`Aucun départ pour ${origin} → ${destination} — prochaine ouverture bientôt.`)
      } else {
        const prices = res.items.map((t) => t.price)
        const min = prices[0]!
        const max = prices[prices.length - 1]!
        const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        setResult({ min, max, avg, total: res.pagination.total })
      }
    } catch {
      setError("Impossible de vérifier les prix — réessayez.")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const resultsHref = `/results?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(date)}&pax=${pax}`

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <Field>
            <FieldLabel htmlFor="sim-origin">Départ</FieldLabel>
            <CityAutocomplete
              id="sim-origin"
              value={origin}
              onChange={setOrigin}
              placeholder="Ville de départ"
              aria-label="Ville de départ"
            />
          </Field>
          <div className="flex items-end pb-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={swap}
              aria-label="Inverser départ et destination"
              className="rounded-full"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
          <Field>
            <FieldLabel htmlFor="sim-dest">Destination</FieldLabel>
            <CityAutocomplete
              id="sim-dest"
              value={destination}
              onChange={setDestination}
              placeholder="Ville d'arrivée"
              aria-label="Ville d'arrivée"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <Field>
            <FieldLabel htmlFor="sim-date">Date de départ</FieldLabel>
            <Input
              id="sim-date"
              type="date"
              value={date}
              min={todayPlus(0)}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sim-pax">Passagers</FieldLabel>
            <Select value={pax} onValueChange={(v) => setPax(v ?? "1")}>
              <SelectTrigger id="sim-pax" className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4", "5", "6"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Button
          onClick={check}
          disabled={loading || !origin || !destination}
          className="rounded-full font-bold"
        >
          {loading ? (
            <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : (
            <Search data-icon="inline-start" aria-hidden />
          )}
          {loading ? "Vérification…" : "Vérifier le prix"}
        </Button>

        <div aria-live="polite" className="min-h-10 text-sm">
          {error && <p className="text-destructive">{error}</p>}
          {result && !loading && (
            <p className="text-foreground">
              Dès{" "}
              <span className="text-xl font-bold tracking-tight">
                {priceXaf(result.min)}
              </span>{" "}
              par place · {result.total} départ{result.total > 1 ? "s" : ""}.{" "}
              {pax !== "1" && (
                <>Total dès {priceXaf(result.min * Number(pax))} pour {pax} passagers. </>
              )}
              {origin && (
                <Link
                  href={resultsHref}
                  className="font-semibold text-primary-dark underline-offset-4 hover:underline"
                >
                  Choisir mon départ →
                </Link>
              )}
            </p>
          )}
        </div>
      </FieldGroup>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck web**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/landing/PriceSimulator.tsx apps/web/lib/api/search.ts
git commit -m "feat(web): rewrite PriceSimulator with CityAutocomplete, swap, breakdown"
```

---

### Task 10: Wire AgencyMap into landing page + layout CSS + nav

**Files:**
- Modify: `apps/web/app/page.tsx:8-22`
- Modify: `apps/web/components/landing/SiteNav.tsx` (add `#agences`)
- Modify: `apps/web/app/globals.css` (add Leaflet CSS import)

**Interfaces:**
- Consumes: `AgencyMap` from Task 7, `fetchAgencies` from Task 5
- Produces: complete landing page with map section

- [ ] **Step 1: Add Leaflet CSS to globals.css**

In `apps/web/app/globals.css`, add after the last `@import` (or at the very top):

```css
@import "leaflet/dist/leaflet.css";
```

- [ ] **Step 2: Update page.tsx**

Replace `apps/web/app/page.tsx` with:

```tsx
import { Suspense } from "react"
import { prisma } from "@camermove/db"
import { priceXaf } from "@camermove/shared"
import { SiteNav } from "@/components/landing/SiteNav"
import { Hero } from "@/components/landing/Hero"
import { Steps } from "@/components/landing/Steps"
import { PriceSimulator } from "@/components/landing/PriceSimulator"
import { NextDepartures } from "@/components/landing/NextDepartures"
import { PartnerCta } from "@/components/landing/PartnerCta"
import { SiteFooter } from "@/components/landing/SiteFooter"
import { Skeleton } from "@/components/ui/skeleton"
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
        where: { status: "active" },
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
              <Suspense fallback={<Skeleton className="h-[360px] w-full rounded-xl md:h-[420px]" />}>
                {/* AgencyMap is client — rendered below via AgencyMapSection */}
                <AgencyMapSection agencies={agencies} />
              </Suspense>
            </div>
            {/* Screen-reader fallback */}
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

        <NextDepartures trips={trips} />
        <PartnerCta />
      </main>
      <SiteFooter />
    </>
  )
}

// Thin client wrapper so AgencyMap can be dynamically imported
import dynamic from "next/dynamic"
const AgencyMapInner = dynamic(
  () => import("@/components/landing/AgencyMap").then((m) => m.AgencyMapInner),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[360px] w-full rounded-xl md:h-[420px]" />,
  }
)

function AgencyMapSection({ agencies }: { agencies: Agency[] }) {
  return <AgencyMapInner agencies={agencies} />
}
```

- [ ] **Step 3: Add `#agences` to SiteNav**

In `apps/web/components/landing/SiteNav.tsx`, add to the nav items array:

```tsx
  { label: "Agences", href: "#agences" },
```

- [ ] **Step 4: Typecheck web**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/components/landing/SiteNav.tsx apps/web/app/globals.css
git commit -m "feat(web): wire AgencyMap into landing page + Leaflet CSS + nav anchor"
```

---

### Task 11: Full typecheck + verification

**Files:** none (verification only)

- [ ] **Step 1: Full monorepo typecheck**

Run: `pnpm -r typecheck`
Expected: 0 errors across all packages

- [ ] **Step 2: Run shared tests**

Run: `cd packages/shared && pnpm vitest run`
Expected: all tests pass including new `priceXaf` tests

- [ ] **Step 3: Dead code scan**

Run: `rg -n "TODO|FIXME|dead|unused" --type ts apps/web/components/landing/ apps/api/src/places/ apps/api/src/agencies/`
Expected: no matches (or justified only)

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: verification fixes from full typecheck"
```

---

*Plan written per writing-plans skill. Ready for execution.*
