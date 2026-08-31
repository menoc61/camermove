# Tixzy Clone — Research Brief

## Core Features (Transport/Ticketing Platform)

| Category | Features |
|----------|----------|
| **Search** | Origin → destination, datepicker, passenger count, price filter, sort (price/early), results table |
| **Booking** | Select seats, passenger forms (name/phone), price breakdown, 15-min hold with countdown, idempotent key |
| **Tickets** | QR code display, verification code, trip details, passenger list, status badge (valid/used/void), lookup by reference |
| **Dashboard** | Upcoming trips, history, issued tickets, quick actions (new booking, export) |
| **Admin** | Superadmin settings (commission %, hold expiry, cancellation policy), partner apps, audit log |
| **Payments** | Presigned MinIO upload for receipt, provider integration (Stripe/Merchant), reconciliation, refunds |
| **Notifications** | WhatsApp/SMS confirmations, trip reminders, hold expiry alerts |

## API Endpoint Map (REST /api/v1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /trips | ✓ | Search trips (origin, destination, date, pax, filters, sort, paginated) |
| GET | /trips/:id | ✓ | Trip detail (price, vehicle, schedule) |
| POST | /bookings | ✓ | Create booking (idempotency key, hold 15 min) |
| POST | /bookings/:id/cancel | ✓ | Cancel booking (restore seats) |
| GET | /tickets/:id | ✓ | Ticket detail (QR, passengers, status) |
| GET | /tickets/lookup | ✓ | Lookup by reference code |
| GET | /me/dashboard | ✓ | Dashboard data (upcoming/history/tickets) |
| GET/POST | /admin/settings | super_admin | App settings (commission, hold expiry, features) |
| POST | /payments/presign | ✓ | MinIO presigned upload for receipt |
| POST | /payments/webhook | — | Provider webhook (Stripe/Flutterwave) |
| GET | /auth/login | — | JWT login (email/password) |
| GET | /auth/register | — | User registration |
| GET | /auth/google* | — | OAuth provider flow |

## Required shadcn/ui Components

| Component | Usage | Notes |
|-----------|-------|-------|
| `button` | Primary actions (search, book, confirm, cancel) | `buttonVariants` with primary/secondary/outline |
| `card` | Trip cards, ticket detail, booking summary | `rounded-lg`, semantic variants |
| `badge` | Status labels (confirmed/pending/cancelled/valid/used) | `variant="outline"` with brand colors |
| `input` / `field` / `label` | Passenger forms, search bar | `FieldGroup`/`Field` wrapper |
| `select` | Filters (sort, passenger count, vehicle type) | |
| `skeleton` | Loading states (results, dashboard, trip cards) | |
| `alert` | Error messages (no results, failed booking, expired hold) | `variant="destructive"` |
| `separator` | Section dividers in ticket detail, dashboard | |
| `table` / `tabs` | Dashboard data tables, export grids | |
| `input[type="date"]` | Datepicker for search & export | |

## Database Schema Considerations (Prisma)

Key models (existing patterns from codebase):
- `Trip` — origin, destination, departureAt, arrivalAt, price, seatCount, vehiclePlate, status
- `Booking` — tripId, seatCount, totalAmount, holdExpiresAt, status (confirmed/pending_payment/cancelled/expired), idempotencyKey
- `BookingPassenger` — bookingId, fullName, phone, seatNumber, verified
- `Ticket` — bookingId, reference, verificationCode, qrDataUrl, status (valid/used/void), usedAt
- `Payment` — bookingId, amount, provider, status, webhookId, createdAt
- `AppSettings` — singleton (id="global"), commissionPercent, holdExpiryMinutes, cancellationPolicy, featureFlags
- `AuditLog` — entityType, entityId, action, actorId, ip, ua, metadata, createdAt

## Authentication Flow

- **JWT `Authorization: Bearer`** — stateless, every request carries its own token
- Routes: `/login`, `/register`, `/admin/login` — all functional with role-gated admin surface
- `requireAuth(role?)` at API layer — RBAC enforced
- Token stored in httpOnly cookie (`cm_access`) or localStorage, sent via `headers()`

## Key Integration Points (Infra Already Wired)

| Integration | Status | Notes |
|-------------|--------|-------|
| **Prisma/Postgres** | ✅ Ready | All models, migrations, row-level locks (`SELECT … FOR UPDATE`) |
| **Redis** | ✅ Ready | Rate limiting, cache (60s TTL), idempotency replay, settings cache (30s) |
| **Kafka** | ✅ Ready | Events: `booking.created`, `booking.cancelled`, `payment.succeeded` |
| **BullMQ** | ✅ Ready | Delayed holds (`holdExpiresAt`), trip reminders |
| **MinIO** | ✅ Ready | Presigned URL for receipt uploads, `scripts/dev-up.sh` includes MinIO |
| **docker compose** | ✅ Ready | `scripts/dev-up.sh` — idempotent one-command boot, loopback-only ports |
| **Tests** | ✅ 31/31 passing | Concurrent last-seat, idempotency replay tests |

## Recommended Starting Point

1. **Clone the existing CamerMove repo** — auth, search, booking, and dashboard already wired
2. **Replace data sources** — if Tixzy has different pricing/routing, wire new trip service
3. **Shadcn UI pass** — all pages already on `primary: #0e9f8f` / `secondary: #f4b607` theme
4. **Add Tixzy-specific flows** — e.g., different ticket types, loyalty, or integrated payments

**Next step**: Decide which Tixzy features to implement first (search-only MVP, full book+ticket, or admin surface). I can scaffold the relevant routes/components once you choose.