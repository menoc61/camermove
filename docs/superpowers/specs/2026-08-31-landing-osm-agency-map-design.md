# Design Spec: Landing Page + Price Simulator v2 + OSM Agency Map

**Date:** 2026-08-31
**Author:** agent (brainstorming)
**Status:** Approved — pending `writing-plans`
**Scope:** Landing page open to any city, OSM-based agency map, price simulator with full breakdown. 100% open-source (Nominatim + Leaflet + OSM tiles).

---

## 1. Design Read

Reading this as: *interurban transport marketplace landing for Cameroonian travelers (Yaoundé ⇄ Douala, any city), trust-first / commerce-critical language, leaning toward shadcn/ui + Tailwind v4 + Noto Sans/Inter with restrained motion.*

Dials: `DESIGN_VARIANCE: 4 / MOTION_INTENSITY: 3 / VISUAL_DENSITY: 4` — calm, credible, not agency-experimental. One accent locked: teal `#0e9f8f` + amber `#f4b607` secondary CTA only. No beige/cream default palette.

---

## 2. Architecture

### 2.1 New backend: Places autocomplete

**Route:** `GET /api/v1/places/autocomplete` — server-side proxy to Nominatim (OSM).

- **Zod schema** (`apps/api/src/places/schema.ts`):
  ```ts
  export const PlacesAutocompleteQuery = z.object({
    q: z.string().min(1).max(100),
    countrycodes: z.string().default("cm"),
    limit: z.coerce.number().int().min(1).max(10).default(5),
  })
  ```
- **Service** (`apps/api/src/places/service.ts`):
  - Fetch `https://nominatim.openstreetmap.org/search?format=json&q={q}&countrycodes={countrycodes}&limit={limit}&addressdetails=1&accept-language=fr`
  - `User-Agent: CamerMove/1.0 (contact@camermove.cm)` — required by Nominatim policy.
  - Redis cache via existing `getRedis()` + `cacheKey("places", q)` TTL 24h, memory fallback if Redis unavailable.
  - Rate-limit via existing `RATE_LIMIT_IP_*` / `RATE_LIMIT_APP_*` Redis limiter → 429 `Retry-After`.
  - **Returns:** `{ places: { displayName: string; city?: string; lat: number; lon: number; osmId: string }[] }`
- **Routes** (`apps/api/src/places/routes.ts`):
  ```ts
  app.get("/places/autocomplete", async (req) => {
    const query = PlacesAutocompleteQuery.parse(req.query)
    return searchPlaces(query)
  })
  ```
- **Wire:** `app.ts` `import { placesRoutes } from "./places/routes"` + `app.register(placesRoutes, { prefix: "/api/v1" })`.

**No new DB table** — pure proxy + cache.

### 2.2 New backend: Agency locations

**Route:** `GET /api/v1/agencies?city=Yaoundé` — returns agencies in a city.

- **Zod schema** (`apps/api/src/agencies/schema.ts`):
  ```ts
  export const AgencyQuery = z.object({ city: z.string().min(1).max(100) })
  ```
- **Service** (`apps/api/src/agencies/service.ts`):
  - Join `Transporter` + `Route` + `Trip` to find agencies in a city.
  - For each matching transporter, return `{ id, companyName, city, lat: transporter.lat ?? null, lon: transporter.lng ?? null, departurePointInfo: trip.departurePointInfo ?? null }`.
  - If transporter has no `lat/lon`, reverse-geocode city center via Nominatim (cache 24h), return city-center coords as fallback (honest approximate pin).
  - **Future migration** (Phase B): `Transporter.lat/lng/address` columns — NOT included here.
- **Routes** (`apps/api/src/agencies/routes.ts`):
  ```ts
  app.get("/agencies", async (req) => {
    const query = AgencyQuery.parse(req.query)
    return listAgencies(query)
  })
  ```
- **Wire:** same as places.

### 2.3 Search API — already supports any city

`findSearchableTrips` `repository.ts:22` uses `mode: "insensitive"` `equals` on `originCity`/`destinationCity` — already supports any city. No change needed.

`SearchQuery` `schema.ts:15-16` requires `origin`/`destination` — `PriceSimulator` sends them as user types. No change needed.

---

## 3. Frontend components

### 3.1 `CityAutocomplete` (new, client)

`apps/web/components/search/CityAutocomplete.tsx` — reusable city search input with OSM autocomplete.

- **Props:** `value: string`, `onChange: (city: string) => void`, `placeholder?: string`, `popoverProps?: Partial<PopoverProps>`.
- **Implementation:**
  - `Input` + `Popover` from `@base-ui/react/popover`.
  - `useQuery` with `debounce 300ms`, `minChars 2`.
  - Query `fetchPlaces(q)` → renders `Popover` with `Select`-like items (`displayName`, `city`).
  - On select: calls `onChange(displayName)`.
  - Keyboard nav via Popover (ArrowUp/Down, Enter, Escape).
  - `Popover` anchored to `Input`, `modal: false`, `sameWidth: true`.
- **Empty state:** "Aucune ville trouvée au Cameroun" — suggest broadening countrycodes.
- **A11y:** `aria-label="Ville de départ"`, `aria-describedby` for loading state.

### 3.2 `AgencyMap` (new, client, SSR-disabled)

`apps/web/components/landing/AgencyMap.tsx` — Leaflet map showing agencies in a city.

- **Props:** `city?: string`, `lat?: number`, `lon?: number`, `agencies: Agency[]`.
- **Implementation:**
  - `dynamic(() => import('./AgencyMap'), { ssr: false })` in `page.tsx`.
  - Fallback: `Skeleton className="h-[360px] md:h-[420px] w-full rounded-xl"`.
  - `useMap` / `MapContainer` from `react-leaflet`.
  - `L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '© OpenStreetMap contributors' })`.
  - `LeafletIcon` using OSM default marker (or custom teal `divIcon`).
  - One `L.marker` per agency at `lat/lon` (city-center fallback if null). Popup: `companyName · departurePointInfo · city` + `Voir les départs` link to `/results?origin=city`.
  - `LocateControl` (browser geolocation) — optional; if granted, reverse-geocode via Nominatim `reverse?lat=&lon=` to city, recenter + filter agencies.
  - `ZoomControl`, `AttributionControl`.
  - Keyboard panning via Leaflet defaults.
  - Screen-reader fallback: `<ul>` of agencies below map (`<li>` with `Link` to results).
  - `useReducedMotion` — disable marker bounce animation.
- **Styles:** Leaflet CSS imported via `app/layout.tsx` or `globals.css`. Add `@import "leaflet/dist/leaflet.css"` or use CDN-free import.

### 3.3 `PriceSimulator` (modified)

`apps/web/components/landing/PriceSimulator.tsx` — now route-agnostic.

- **Fields (new):**
  - `Origin` → `CityAutocomplete` (default empty; geolocated if permission granted).
  - `Swap` button (`ArrowRight` rotate 90°, `size="icon"`, `variant="ghost"`).
  - `Destination` → `CityAutocomplete`.
  - `Date` (`Input type=date`, `min=today`).
  - `Pax` (`Select 1–9`, consistent with `search-bar.tsx:88`).
- **All fields URL-synced** via `useSearchParams` — so `Choisir mon départ →` builds `/results?origin=&destination=&date=&pax=1`.
- **Behavior:**
  - `Vérifier le prix` → `fetchSearch({ origin, destination, date, pax, sortBy:"price_asc", perPage:20 })`.
  - Compute `min`, `max`, `avg`, `totalMin = pax * min`.
  - Show `Skeleton` while loading, `Loader2 animate-spin` on button.
  - `aria-live="polite"` result line: `Dès 5 500 XAF par place · 12 départs · Total dès 11 000 XAF pour 2 passagers. Choisir mon départ →`.
  - Empty: `Aucun départ pour [origin] → [destination] — prochaine ouverture bientôt`.
  - Error: `Impossible de vérifier les prix — réessayez` (`buttonVariants variant="link"` retry).
- **Removed:** fixed `Yaoundé → Douala` hardcode.

### 3.4 `Hero` (modified)

`apps/web/components/landing/Hero.tsx` — token + encoding fixes.

- Fix mojibake: `â‡„` → `⇄`, `â‡ˆ` → `→`, `Ã©` → `é`, `–` → `–` (proper en-dash).
- Replace `text-slate-900` / `text-slate-600` / `text-slate-500` → `text-foreground` / `text-muted-foreground` / `text-muted-foreground`.
- Replace `bg-white` / `border-slate-200` → `bg-card` / `border`.
- Change `picsum.photos/seed/camermove-route/900/1100` → `picsum.photos/seed/camermove-highway/900/1100` (descriptive seed; swap later). Add `loading="lazy"` to secondary image.
- Hero `h1` stays `text-4xl md:text-6xl` (≤2 lines). Subtext trimmed to ≤20 words.
- Trust chips stay (ShieldCheck, QrCode, Wallet).
- SearchBar card `rounded-2xl border bg-card shadow-lg`.

### 3.5 `NextDepartures` (modified)

`apps/web/components/landing/NextDepartures.tsx` — token fixes.

- Replace `text-slate-900` / `text-slate-500` / `text-slate-600` → `text-foreground` / `text-muted-foreground`.
- `bg-white` / `border-dashed border-slate-300` → `bg-card` / `border border-dashed`.
- Remove duplicated `priceXaf` — use `Intl.NumberFormat("fr-CM").format(n) + " XAF"` inline or a shared helper in `packages/shared`.

### 3.6 `page.tsx` (modified)

`apps/web/app/page.tsx` — add `AgencyMap`.

- Keep RSC fetch for `minPrice` + `NextDepartures`.
- Fetch agencies for default city (Yaoundé) → `fetchAgencies("Yaoundé")`.
- Render: `SiteNav` → `Hero` → `Steps` → `PriceSimulator` → `AgencyMap` (`id="agences"`) → `NextDepartures` → `PartnerCta` → `SiteFooter`.
- `AgencyMap` wrapped in `Suspense` with `Skeleton h-[400px] w-full rounded-xl` fallback.

### 3.7 `SiteNav` (modified)

`apps/web/components/landing/SiteNav.tsx` — add `#agences` anchor.

- Nav items: `Comment ça marche (#etapes)`, `Prochains départs (#departures)`, `Agences (#agences)`, `Devenir partenaire (/transporter/apply)`.

### 3.8 `globals.css` (modified)

- Add `@import "leaflet/dist/leaflet.css"` (or inline Leaflet CSS).
- Ensure Leaflet tiles render correctly on dark mode — add `filter` override or use OSM tiles only in light mode section.

---

## 4. New API files

| File | Description |
|------|-------------|
| `apps/api/src/places/schema.ts` | `PlacesAutocompleteQuery` Zod |
| `apps/api/src/places/service.ts` | Nominatim proxy + Redis cache |
| `apps/api/src/places/routes.ts` | `GET /places/autocomplete` |
| `apps/api/src/agencies/schema.ts` | `AgencyQuery` Zod |
| `apps/api/src/agencies/service.ts` | Agency join + geocode fallback |
| `apps/api/src/agencies/routes.ts` | `GET /agencies` |
| `apps/api/src/index.ts` (modify) | Export new modules |
| `apps/web/lib/api/places.ts` (new) | `fetchPlaces(q)` client helper |
| `apps/web/lib/api/agencies.ts` (new) | `fetchAgencies(city)` client helper |
| `apps/web/components/search/CityAutocomplete.tsx` (new) | City search with OSM autocomplete |
| `apps/web/components/landing/AgencyMap.tsx` (new) | Leaflet agency map (SSR disabled) |

---

## 5. Modified files

| File | Change |
|------|--------|
| `apps/web/components/landing/Hero.tsx` | Token + encoding fixes |
| `apps/web/components/landing/NextDepartures.tsx` | Token fixes, dedup `priceXaf` |
| `apps/web/components/landing/PriceSimulator.tsx` | Origin/destination autocomplete, swap, breakdown |
| `apps/web/components/landing/SiteNav.tsx` | Add `#agences` |
| `apps/web/components/landing/AgencyMap.tsx` | New (this file) |
| `apps/web/components/search/CityAutocomplete.tsx` | New (this file) |
| `apps/web/app/page.tsx` | Add `AgencyMap`, fetch agencies |
| `apps/web/app/layout.tsx` | Add Leaflet CSS import |
| `apps/web/globals.css` | Add Leaflet CSS |
| `apps/api/src/app.ts` | Register places + agencies routes |
| `apps/api/src/index.ts` | Export new modules |
| `packages/shared/src/index.ts` (if exists) | Add `priceXaf` helper |

---

## 6. Task breakdown (atomic commits)

1. **API: places + agencies routes** — Zod schemas, Nominatim proxy, Redis cache, `app.ts` registration. `pnpm -r typecheck`.
2. **API: agency service** — Transporter/Route/Trip join + geocode fallback. `pnpm -r typecheck`.
3. **Web: lib/api helpers** — `fetchPlaces`, `fetchAgencies`. `pnpm -r typecheck`.
4. **Web: CityAutocomplete** — Input + Popover + useQuery + debounce. `pnpm -r typecheck`.
5. **Web: AgencyMap** — Leaflet, markers, popups, LocateControl, SSR-disabled. `pnpm -r typecheck`.
6. **Web: PriceSimulator v2** — Origin/destination autocomplete, swap, breakdown, URL-sync. `pnpm -r typecheck`.
7. **Web: Hero + NextDepartures token/encoding fixes** — semantic tokens, mojibake, picsum seeds. `pnpm -r typecheck`.
8. **Web: page.tsx + SiteNav + layout.css** — AgencyMap section, nav anchor, Leaflet CSS. `pnpm -r typecheck`.
9. **Shared: priceXaf helper** — dedup across `NextDepartures`, `PriceSimulator`, `TripCard`, `recap`. `pnpm -r typecheck`.
10. **Verification** — `pnpm -r typecheck`, `pnpm -r test`, `pnpm smoke:search`, manual dark/light, `rg` dead code, manual Leaflet map + OSM autocomplete.

---

## 7. Verification (per AGENTS.md §7)

- `pnpm -r typecheck` — 0 errors.
- `pnpm -r test` — 31/31 + new unit tests for places cache + agency geocode fallback.
- `pnpm smoke:search` — search returns filtered/sorted/paginated + simulator shows live min.
- `curl /api/v1/places/autocomplete?q=yaoun` — 200, cached second hit.
- Manual: landing dark/light, map keyboard nav, `prefers-reduced-motion` disables marker bounce, `rg` dead code clean.
- OSM policy: `User-Agent` + debounce 300ms + Redis cache; attribution visible on map.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Nominatim 1 req/s rate-limit | Redis 24h cache + debounce 300ms + server-side queue; fallback Photon if 429 |
| No precise agency coords (MVP) | City-center pin + popup disclaimer "Emplacement approximatif" |
| OSM tiles prod usage | Document `NEXT_PUBLIC_TILE_URL` env switch to `tile.openstreetmap.fr` or self-host; attribution visible |
| Leaflet SSR | `dynamic` import + `ssr: false`; `Skeleton` fallback |
| Geolocation permission | Optional; graceful fallback to Yaoundé center if denied |
| Bundle size | Leaflet ~45kB; `dynamic` import → lazy loaded; no Google/Mapbox |

---

## 9. Open questions (resolved)

- **countrycodes=cm default** ✅ Confirmed — geocode Cameroon only by default; allow broadening if no result.
- **Imagery** ✅ Picsum seeds for now; label `<!-- TODO: hero photo 900x1100 -->` for later swap.
- **Font pairing** ✅ Keep `Noto Sans` + `Inter` as in `layout.tsx:7`.
- **priceXaf dedup** ✅ Add to `packages/shared`.

---

*Spec written per brainstorming skill. Awaiting spec self-review and user approval before `writing-plans`.*
