# CamerMove Permission Matrix

Source of truth: `Role` enum in `packages/db/prisma/schema.prisma` (`traveler`, `transporter_staff`, `admin`, `super_admin`) enforced by `requireAuth(role?)` in `apps/api/src/auth/plugins.ts` with rank `traveler(0) < transporter_staff(1) < admin(2) < super_admin(3)`.

- **traveler** — app user subscribing to one or more services. Sees only own rows (`userId` owner-scoping).
- **transporter_staff** — partner console (transporters AND hotel/rental/parcel/event operators). Sees rows of the affiliated service (`transporterId` / `ownerId` / `organizerId` scoping). There is NO separate `partner` or `transporter` role — UI/docs must never test `role === "transporter"` or `"partner"`.
- **admin** — sub-role of `super_admin`. Sees all rows, all services.
- **super_admin** — alone on `GET/PUT /api/v1/admin/settings`.

Slices append their rows here. Slice 1 (interurban) below.

## Slice 1 — interurban transport

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `GET /api/v1/trips`, `GET /trips/:id`, `GET /search`, `GET /search/advanced` | allow | allow | allow | allow |
| `POST /trips/bulk` (`{ids[], action}`) | deny | 403 | 403 | allow |
| `POST /trips/:id/status` (pause/close/reopen) | deny | 403 unless owner-staff | own transporter only | any |
| `POST /bookings`, `GET /bookings/:id`, `POST /bookings/:id/cancel`, `POST /bookings/bulk/cancel`, `GET /bookings/export`, `GET /me/bookings` | deny | own only | own only | any |
| `POST /payments`, `GET /payments`, `GET /payments/:id`, `GET /payments/export` | deny | own only | own only | any |
| `POST /payments/:id/refund` | deny | deny | deny | allow |
| `POST /webhooks/notchpay`, `POST /webhooks/cinetpay` | HMAC/token (no JWT) | HMAC/token | HMAC/token | HMAC/token |
| `GET /tickets/lookup`, `GET /tickets/me`, `GET /me/tickets/:id`, `POST /tickets/verify`, `GET /tickets/verify` | lookup allow; verify deny unauth | allow | allow | allow |
| `GET /transporter/profile`, `PUT /transporter/profile`, vehicles/routes/trips/bookings CRUD + exports + `GET /transporter/trips/:id`, `GET /transporter/commissions`, `GET /transporter/stats` | deny | 403 | own `transporterId` | instructs to use admin panel (`__admin__` guard) |
| `GET /intraurban/lines`, `/schedule`, `/search` | allow | allow | allow | allow |
| `GET /reviews/trip/:tripId`, `GET /reviews/transporter/:transporterId`, `GET /reviews/:id`, `POST /reviews` | lists + single allow | allow (POST: confirmed-booking proof) | allow | allow |
| `PUT /reviews/:id` | deny | owner only (re-runs verified-stay gate) | owner only | owner only (no admin override — rating is personal) |
| `DELETE /reviews/:id` | deny | owner only | owner only | owner or admin |
| `GET /me/dashboard`, `GET /me/profile`, `PATCH /me/profile`, notifications + export + read | deny | allow | allow | allow |
| `GET /partner/events`, `GET /partner/parcels` | deny | 403 (unified slice 1, like hotels/rentals) | own scope | all |

## Slice 2 — parcels

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `GET /parcels/quote`, `GET /parcels/track/:n` | allow (sanitized, phones masked) | allow | allow | allow |
| `POST /parcels`, `GET /parcels`, `GET /parcels/:id`, `GET /parcels/export` | deny | own only | own only | any |
| `PATCH /parcels/:id` (recipient/description while `registered`) | deny | owner only | owner only | any scope, `registered` only (even admin) |
| `POST /parcels/:id/cancel` | deny | owner, `registered` + unpaid only | owner only | any |
| `POST /parcels/:id/pay` | deny | owner only | owner only | owner only |
| `GET /partner/parcels` | deny | 403 | own operators | all |
| `GET /admin/parcels`, `GET /admin/parcels/export`, `PATCH /admin/parcels/:id/status` (FSM) | deny | deny | deny | allow |

No DELETE on parcels by design (cancel covers withdrawal; delivered rows immutable).

## Slice 3 — hotels

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `GET /hotels`, `GET /hotels/:id` | allow | allow | allow | allow |
| `POST /hotels/bookings`, `GET /hotels/bookings/me`, `GET /hotels/bookings/export`, `GET /hotels/bookings/:id` | deny | own only | own only | any |
| `POST /hotels/bookings/:id/cancel`, `POST /hotels/bookings/:id/pay` | deny | owner only | owner only | owner only (cancel: any — kernel rule) |
| `GET /partner/hotels`, `POST /partner/hotels`, `PUT /partner/hotels/:id`, `POST /partner/hotels/:id/rooms` | deny | 403 | own `ownerId` | any |
| `DELETE /partner/hotels/:id`, `DELETE /partner/hotels/:id/rooms/:roomId` | deny | 403 | owner, no `pending_payment`/`confirmed` bookings (409) | any scope, same 409 guard |
| `GET /admin/hotels`, `GET /admin/hotels/export`, `PUT /admin/hotels/:id`, `DELETE /admin/hotels/:id` | deny | deny | deny | allow (delete: same 409 guard) |

No `POST /admin/hotels` by design (partner-only creation; admin moderates via `partnerStatus`).

## Slice 4 — rentals

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `GET /rentals`, `GET /rentals/:id` | allow | allow | allow | allow |
| `POST /rentals/bookings`, `GET /rentals/bookings/me`, `GET /rentals/bookings/export`, `GET /rentals/bookings/:id` | deny | own only | own only | any |
| `POST /rentals/bookings/:id/cancel`, `POST /rentals/bookings/:id/pay` | deny | owner only | owner only | owner only (cancel: any — kernel rule) |
| `GET /partner/rentals`, `POST /partner/rentals`, `PUT /partner/rentals/:id` | deny | 403 | own `ownerId` | any |
| `DELETE /partner/rentals/:id` | deny | 403 | owner, no `pending_payment`/`confirmed` bookings (409) | any scope, same 409 guard |
| `GET /admin/rentals`, `GET /admin/rentals/export`, `PUT /admin/rentals/:id`, `DELETE /admin/rentals/:id` | deny | deny | deny | allow (delete: same 409 guard) |

No `POST /admin/rentals` by design (partner-only creation; admin moderates via `partnerStatus`).

## Slice 5 — events

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `GET /events`, `GET /events/:id` | allow (approved + on_sale/limited only) | allow | allow | allow |
| `POST /events/bookings`, `GET /events/bookings/me`, `GET /events/bookings/export`, `GET /events/bookings/:id` | deny | own only | own only | any |
| `POST /events/bookings/:id/cancel`, `POST /events/bookings/:id/pay` | deny | owner only | owner only | traveler/staff: owner only; admin: any (kernel) |
| `POST /tickets/verify`, `GET /tickets/verify` | deny (auth required) | allow (sanitized view) | allow | allow |
| `GET /partner/events` | deny | 403 | own `organizerId` + KPIs | all |
| `POST /partner/events`, `PUT /partner/events/:id`, `POST /partner/events/:id/categories` | deny | 403 | owner (create: any staff; sets `organizerId`) | any |
| `DELETE /partner/events/:id` | deny | 403 | owner, no `pending_payment`/`confirmed` bookings (409) | any scope, same 409 guard |
| `GET /admin/events`, `GET /admin/events/export`, `GET /admin/event-bookings`, `GET /admin/event-bookings/export` | deny | deny | deny | allow |

No booking PUT/DELETE by design (cancel + pay cover the lifecycle; tickets immutable once issued).

## Slice 6 — insurance

| Endpoint | public | traveler | transporter_staff | admin / super_admin |
|---|---|---|---|---|
| `GET /insurance/policies`, `GET /insurance/policies/:id`, `GET /insurance/policies/export` | deny | own only | own only | any (export multiplex) |
| `POST /insurance/policies` | deny | allow (own booking) | allow (own booking) | allow |
| `POST /insurance/policies/:id/pay`, `POST /insurance/policies/:id/cancel` | deny | owner only | owner only | owner only |
| `GET /admin/insurance/policies`, `GET /admin/insurance/policies/export`, `GET /admin/insurance/policies/:id` | deny | deny | deny | allow |

No PUT/DELETE by design (pay + cancel cover the lifecycle; policies immutable once issued). No partner CRUD (traveler product, no operator side).

## Later slices (rows by those slices)

- Slice 7 cross-cutting (favorites, agencies, places, contact/newsletter admin, notifications bulk) · Slice 8 consoles polish · Slice 9 arch upgrades.
