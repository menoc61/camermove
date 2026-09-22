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

## Later slices (rows by those slices)

- Slice 2 parcels (admin list, statuses) · Slice 3 hotels · Slice 4 rentals · Slice 5 events · Slice 6 insurance · Slice 7 cross-cutting (favorites, agencies, places, contact/newsletter admin, notifications bulk) · Slice 8 consoles polish · Slice 9 arch upgrades.
