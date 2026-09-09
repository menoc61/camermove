# CamerMove — Database

> Postgres 16 via Prisma 6. Source of truth: `packages/db/prisma/schema.prisma`. Migrations live in `packages/db/prisma/migrations/`.

## Stack

- **PostgreSQL 16** — single source of truth for transactional state
- **Prisma 6** — type-safe ORM, single repository layer
- **Redis 7** — cache (60s TTL on search), rate limit, idempotency keys, seat hold
- **Triggers** — `trg_seat_check`, `trg_booking_status` (see `packages/db/prisma/views/triggers.sql`) enforce seat invariants transactionally
- **Views** — `packages/db/prisma/views/booking_stats.sql` exposes aggregated booking metrics

## Schema overview (32 models)

```
User ─┬─ Booking ─┬─ Passenger[]
      │           ├─ Payment ─── Commission
      │           ├─ Ticket
      │           └─ Notification
      ├─ Hotel ── HotelRoom ── HotelBooking ── Payment
      ├─ RentalVehicle ── RentalBooking ── Payment
      ├─ ParcelOperator ── Parcel ── ParcelStatusLog
      │                 └─ Payment
      ├─ InsurancePolicy ── Payment
      ├─ Event ── TicketCategory ── EventBooking ── Payment
      ├─ PartnerApplication
      ├─ AuditLog
      └─ Notification

Transporter ── Route ── RouteStop ── Trip ── SeatAvailability
            └─ Vehicle

AppSettings (singleton id="global")
```

Full reference: `packages/db/prisma/schema.prisma`.

## Indexes (per AGENTS.md §1)

| Model | Index | Use |
|-------|-------|-----|
| Trip | `[departureAt]`, `[price]`, `[status]`, `[routeId,departureAt]` | Search filters |
| Booking | `[userId,status]`, `[tripId]`, `[status,holdExpiresAt]` | Dashboard + expire-holds job |
| Route | `[originCity,destinationCity]`, `[transporterId]` | Search |
| Hotel | `[city,status]`, `[partnerStatus]` | Search filters |
| RentalVehicle | `[pickupCity,status]`, `[category,status]` | Search filters |
| Parcel | `[userId,status]`, `[trackingNumber]`, `[recipientCity,status]` | Dashboard + tracking |
| InsurancePolicy | `[userId,status]`, `[startDate]` | Dashboard + reminders |
| Event | `[city,status]`, `[eventType]`, `[startDate]` | Search filters |
| EventBooking | `[userId,status]`, `[eventId,status]`, `[ticketNumber]` | QR check-in |
| ParcelStatusLog | `[parcelId,createdAt]` | Status timeline |

## Seed

The seed lives at `scripts/seed-rich.ts` and is idempotent. Run with:

```bash
pnpm seed                # from repo root
```

It seeds the six services end-to-end so every screen has data:

| Domain | Volume | Notes |
|--------|--------|-------|
| Users | 4 demo accounts + traveler with bookings | All roles covered |
| Transporters | 4 (approved, pending, reviewing) | Cameroon-realistic names |
| Vehicles | 8 (autocar, minibus) | per transporter |
| Routes | 8 (Yaoundé ⇄ Douala + 3 secondary axes) | both directions |
| Trips | 14 days × 3 departures × 8 routes = ~336 | varies price by hour & day |
| Bookings | 12 (mix of confirmed / pending / cancelled / expired) | with passengers, ticket, commission |
| Partner applications | 3 (received / reviewing / rejected) | demo statuses |
| Corridor stops | 11 (Yaoundé ⇄ Douala axis including Mimboman) | route polylines for maps |
| Hotels | 6 (5★ to 3★) with 1–3 room types each | 16 rooms total |
| Hotel bookings | 1 sample per approved hotel | for traveler account |
| Rental vehicles | 8 (sedan, SUV, luxury, minibus, pickup, city) | 6 cities |
| Rental bookings | 3 sample | for traveler account |
| Parcel operators | 2 (ColiExpress, CitySend) | 5 cities each |
| Parcels | 8 (mix of delivered / in_transit / picked_up / registered) | with full status history |
| Insurance policies | 5 (2 confirmed, 3 pending) | 2 providers, 5 destinations |
| Events | 5 (festival, concert, sport, exhibition, conference) | with ticket categories |
| Event bookings | 1 sample per event | for traveler account |
| Payments | One per confirmed booking across all services | notchpay, mobile_money |
| Tickets | QR + verification code | for confirmed bookings |
| Notifications | Sent on each confirmed booking | email + push |
| Audit logs | One per booking lifecycle event | actor, action, entity |
| AppSettings | Singleton `id="global"` | commission, holdExpiry, cancellation policy |

### Re-seeding

The script is **safe to re-run**. It uses `upsert` for entities keyed on a unique field, and `findFirst + create` for the rest. Already-seeded data is skipped.

To start from a clean slate:

```bash
# Stop infra
docker compose down -v                 # ⚠️ wipes Postgres + Minio + Grafana volumes
docker compose up -d
# Apply migrations + seed
pnpm --filter @camermove/db exec prisma migrate deploy
pnpm seed
```

## Demo accounts

| Email | Password | Role |
|-------|----------|------|
| `traveler@camermove.cm` | `motdepasse123` | traveler |
| `partner@camermove.cm` | `motdepasse123` | transporter_staff |
| `admin@camermove.cm` | `motdepasse123` | admin |
| `super@camermove.cm` | `motdepasse123` | super_admin |

## Migrations

```bash
pnpm --filter @camermove/db exec prisma migrate dev --name <name>   # dev (creates + applies)
pnpm --filter @camermove/db exec prisma migrate deploy              # prod (applies only)
pnpm --filter @camermove/db exec prisma migrate status              # check drift
```

Migrations are append-only. **Never** edit a migration after it has been applied in any environment.

## Backups

Postgres is the only stateful service that needs backup. Minio (object storage) and Grafana (dashboards) are re-creatable from code.

```bash
# Dump
docker compose exec -T postgres pg_dump -U camermove camermove > backup-$(date +%F).sql

# Restore
cat backup-2026-09-09.sql | docker compose exec -T postgres psql -U camermove -d camermove
```

Schedule daily via cron. Verify monthly by restoring to a throwaway DB.
