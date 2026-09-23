# CamerMove Mobile App — Design Spec

- Date: 2026-09-23
- Status: approved in brainstorm, pending spec review
- Scope: traveler-facing user app only (no transporter / partner / admin back-offices)
- Target: Expo SDK 57 (`apps/mobile`, EAS project `b14510d6-0b45-4794-8ed3-52a4b5d14f9c`)

## 1. Context

CamerMove is a pnpm monorepo (`apps/web`, `apps/api`, `apps/worker` + `packages/*`).
The web app (`apps/web`, Next.js + React 19) has ~48 routes across 10+ verticals.
The API (`apps/api`, Fastify 5) serves versioned `REST /api/v1` with JWT
(`Authorization: Bearer`, 15m access + 30d rotating refresh), Zod validation,
`{items, total, page, perPage, totalPages}` pagination envelopes, and
`GET .../export?dateFrom&dateTo&format=csv|json` on periodic lists.
`apps/mobile` was scaffolded with `create-expo-app` (tabs template, SDK 57,
Reanimated 4.5.1) using npm; it is not yet integrated into the monorepo.

## 2. Decisions (brainstormed + approved)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Phased scope was rejected; build the full traveler app, not an MVP slice | User explicitly wants everything the web traveler has |
| D2 | Traveler role only; transporter / partner / admin stay web-only | Keeps mobile focused; back-office needs tables/charts unsuitable for v1 mobile |
| D3 | Monorepo-integrated, not standalone (`@camermove/mobile` on pnpm, `workspace:*` deps) | Single source of truth for money math, city/agency data, auth/booking stores; matches AGENTS.md §4 |
| D4 | Email/password + Google sign-in in the same build | Google via `expo-auth-session` against existing `/auth/google*` endpoints |
| D5 | Animation-rich: branded splash → onboarding carousel → motion system | Key user requirement; Reanimated already scaffolded |
| D6 | Keep `app/` router location (template default), do not move to `src/app/` | Avoids churn; both are supported by Expo Router |

## 3. Monorepo linkage (Wave 1)

- Delete `package-lock.json` + `node_modules` in `apps/mobile`; rename package to
  `@camermove/mobile`; install with pnpm.
- Add deps: `workspace:*` on `@camermove/shared` (+ `@camermove/frontend` if its
  React Native incompatibilities — `localStorage`, `Buffer` — are abstracted first;
  otherwise port the three stores), plus `zod`, `zustand`, `@tanstack/react-query`,
  `expo-secure-store`, `expo-auth-session`, `expo-haptics`.
- Always add native-compatible packages with `npx expo install <pkg>`.
- `app.json`: slug/scheme `mobile` → `camermove`; set `ios.bundleIdentifier`
  and `android.package` to `com.camermove.app` before the first EAS build.
- `EXPO_PUBLIC_API_URL` per EAS channel (dev = machine LAN URL for physical
  devices, preview/prod = deployed API). Mobile never touches the DB directly —
  only `REST /api/v1` (AGENTS.md §1, §4).
- Extend the shared tsconfig base; add Turbo `typecheck`/`lint` tasks for mobile.

## 4. Data + auth architecture

- Port `apps/web/lib/api/resource.ts` (`API_BASE_URL`, `ApiError`, automatic
  `Idempotency-Key` on `POST/PUT/PATCH`, `buildQuery`) and all `lib/api/*.ts`
  DTOs into `apps/mobile/lib/api/`.
- Reuse as-is: `@camermove/shared` `money.ts` (commission/refund/XAF math) and
  `agencies.ts` (20 cities, 7 agency profiles, urban lines, fare bands) for offline
  pickers, directory, and fare display.
- Stores: port `useAuthStore` / `useSearchStore` / `useBookingStore` with a
  SecureStore-backed persist adapter (tokens in SecureStore, prefs in
  AsyncStorage). Preserve 401 → `refreshIfNeeded()` → re-login semantics.
- Data fetching: React Query (`staleTime` 30s, `retry: 1`, no refetch on focus);
  port `useLiveSeats` 10s polling for seat maps.
- Future (out of scope): Expo push notifications fed by `booking.created` events;
  offline-first caching; these are Wave 5+ candidates.

## 5. Navigation + screen map (traveler only)

Tabs (4): Home · Search · Tickets · Account.

| Area | Screens |
|------|---------|
| Onboarding (stack, first launch) | Branded splash → 3-slide carousel → auth gate |
| Auth (stack) | Login, register, Google button, password strength |
| Home tab | Stats, rails, search widget, agency directory entry |
| Search tab | Search form (origin/destination/date/pax, filters, sort) → results (`TripCard`) → trip detail + live seat map |
| Booking (stack) | Seat count + passenger form → recap → `POST /bookings` → confirmation with hold-countdown ring → payment (`notchpay`/`cinetpay`, redirect via web browser) |
| Tickets tab | My tickets + QR detail + public verify-by-code lookup |
| Verticals (stacks from Home) | Hotels, rentals, events (list → detail → book → confirm); parcels (quote → create → track); insurance (plans → subscribe); agencies directory + detail; intraurban lines + schedule |
| Account tab | Dashboard summary + upcoming trip hero, bookings (upcoming/history), payments, favorites, notifications, profile, contact/FAQ/legal, logout |

Explicitly excluded: `/transporter/*`, `/partner/*`, `/admin/*`, `POST /payments/:id/refund`.

## 6. Motion system

- `expo-splash-screen` branded splash (no white flash).
- Onboarding carousel: Reanimated-driven pager with spring dot indicator + skip.
- Micro-interactions: spring tab-press feedback, animated seat selection, shimmer
  skeletons, pull-to-refresh everywhere, countdown ring on booking hold, QR
  success morph, toast system mirroring web `sonner` semantics, haptics on key
  actions (seat select, payment success).
- Screen transitions via stack animation presets; tab bar hides on deep stacks.
- `prefers-reduced-motion` equivalent (`AccessibilityInfo.reduceMotionEnabled`)
  disables non-essential animation globally.
- Implementation skills to invoke during build: `expo-ui` (native components
  first), `expo-native-ui`, `expo-router`, `expo-animation`, `micro-interaction`,
  `expo-design-system`, `expo-data-fetching`.

## 7. Endpoint metadata + cross-cutting (per AGENTS.md)

- Every API call logs `requestId`, `ip` is server-side; client includes
  `Idempotency-Key` on all writes (booking + payment creation).
- Auth screens log hashed email + device info to `AuditLog` via existing API.
- No local business-logic state that would break horizontal scaling; SecureStore
  holds tokens only.

## 8. Execution waves

- Wave 1: linkage (§3) + API layer + theme/tokens + splash/onboarding shell.
- Wave 2: auth + Home/Search + trip detail + booking + payments + tickets.
- Wave 3: hotels/rentals/events/parcels/insurance/agencies/intraurban/Account.
- Wave 4: motion polish + accessibility pass + EAS dev build.

## 9. Verification (per wave, per AGENTS.md §7)

- `pnpm --filter @camermove/mobile typecheck` — 0 errors; `expo lint` clean.
- `npx expo-doctor` — no blocking issues.
- Smoke against local API (`docker compose up -d`): search → book → pay →
  ticket-verify, plus idempotency replay test.
- Final: EAS development build installs and runs on device.
- No `TODO`/`FIXME`/dead code without justification (`rg` check).
