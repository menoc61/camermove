# Requirements: CamerMove

**Defined:** 2026-08-24
**Core Value:** A traveler can search Yaoundé ↔ Douala, select an offer, pay, and receive a valid e-ticket — with no double-booking, and the transporter and admin see the booking.

## v1 Requirements

### Search

- [ ] **SEARCH-01**: User can search Yaoundé ↔ Douala trips by origin, destination, date, and pax
- [ ] **SEARCH-02**: User can filter results by price range, departure time, transporter, availability, vehicle type, and full-text q
- [ ] **SEARCH-03**: User can sort by price (asc/desc) and departure time, and groupBy transporter
- [ ] **SEARCH-04**: Search results are paginated (page/perPage and limit/offset) with total/totalPages
- [ ] **SEARCH-05**: User can perform advanced search with dateFrom/dateTo, minPrice/maxPrice, and bulk ordering via orderBy
- [ ] **SEARCH-06**: Search handles thousands of requests (debounced 300ms, React Query cache, Redis response cache, Prisma indexes, pagination)
- [ ] **SEARCH-07**: User can view trip detail (price, times, vehicle, transporter, conditions, cancellationPolicy, seatsAvailable)

### Authentication

- [ ] **AUTH-01**: User can register with email/password (+ firstName/lastName)
- [ ] **AUTH-02**: User can log in with email/password and receive JWT access (15m) + refresh (30d)
- [ ] **AUTH-03**: User can refresh session
- [ ] **AUTH-04**: User can view own profile (GET /auth/me) with RBAC
- [ ] **AUTH-05**: User can sign in with Google OAuth (SocialAccount, emailVerified, providerUserId)

### Booking

- [ ] **BOOK-01**: User can create a booking with passenger info and seatCount, with atomic seat hold (no double-booking)
- [ ] **BOOK-02**: Booking hold expires and releases seats
- [ ] **BOOK-03**: System computes totalAmount correctly
- [ ] **BOOK-04**: Booking generates a unique reference
- [ ] **BOOK-05**: User can cancel where policy allows; transporter can pause/close offer

### Payments

- [ ] **PAY-01**: User can initiate payment via NotchPay (Mobile Money) and receive authorization_url
- [ ] **PAY-02**: Payment webhook is verified (X-Notch-Signature) and updates Payment.status idempotently
- [ ] **PAY-03**: On payment success, booking is confirmed, seats become booked, ticket and commission are created
- [ ] **PAY-04**: On payment failure/expiry, held seats are released

### Tickets

- [ ] **TICK-01**: Confirmed booking generates an e-ticket with QR/verificationCode
- [ ] **TICK-02**: Ticket can be looked up by reference and validated

### Transporter

- [ ] **TRANS-01**: Transporter can apply via partner application (with documents via MinIO presigned URLs)
- [ ] **TRANS-02**: Transporter can manage profile, vehicles, routes, schedules, prices, capacity
- [ ] **TRANS-03**: Transporter sees bookings and payment status

### Admin

- [ ] **ADMIN-01**: Admin can manage users, transporters, vehicles, trips, bookings, payments, commissions
- [ ] **ADMIN-02**: Admin can review partner applications and set commission % (global + per-transporter)
- [ ] **ADMIN-03**: Admin sees stats, audit log, and commission reports

### Notifications

- [ ] **NOTIF-01**: System sends booking confirmation, payment confirmation, e-ticket via email (own SMTP, MailHog fallback)
- [ ] **NOTIF-02**: System sends WhatsApp via Twilio (per-user, fallback to log)
- [ ] **NOTIF-03**: System sends push via ntfy per-user topic (web + mobile)

### API & Architecture

- [ ] **API-01**: API exposes limit/offset and page/perPage, orderBy, groupBy, filter, q, bulk actions (POST /trips/bulk), and pagination metadata for every resource
- [ ] **API-02**: Every endpoint validates with Zod and collects metadata (ip, os, browser, device, ua, referer, requestId) via metadataPlugin
- [ ] **API-03**: API serves Swagger OpenAPI at /docs and /docs/json
- [ ] **API-04**: Postman collection covers health, auth, search, trips, metrics, and is importable
- [ ] **API-05**: Smoke scripts allow single suite (auth/search) or all: pnpm smoke, pnpm smoke:auth, pnpm smoke:search, pnpm swagger:export

### Observability & Security

- [ ] **OBS-01**: App exposes Prometheus /metrics (when METRICS_ENABLED) and Grafana dashboards/alerts, with OTel traces
- [ ] **SEC-01**: RBAC enforced at API, passwords argon2, webhook signatures verified, audit log, rate limiting, HTTPS-only, no raw card data

## v2 Requirements

### Loyalty & Marketplace

- **LOYAL-01**: Loyalty points per booking
- **MARKET-01**: Tourism marketplace

### Real-time & AI

- **REAL-01**: Real-time vehicle geolocation
- **AI-01**: Dynamic pricing, AI recommendations

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile app (MVP) | Web MVP first, API reusable — explicitly out of scope per CdCF §35 |
| Advanced mapping | Defer unless cheap/fast |
| Reviews/ratings, promo codes | Deferred per CdCF §35 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEARCH-01 | Phase 1 | Pending |
| SEARCH-02 | Phase 1 | Pending |
| SEARCH-03 | Phase 1 | Pending |
| SEARCH-04 | Phase 1 | Pending |
| SEARCH-05 | Phase 1 | Pending |
| SEARCH-06 | Phase 1 | Pending |
| SEARCH-07 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| BOOK-01 | Phase 2 | Pending |
| BOOK-02 | Phase 2 | Pending |
| BOOK-03 | Phase 2 | Pending |
| BOOK-04 | Phase 2 | Pending |
| BOOK-05 | Phase 2 | Pending |
| PAY-01 | Phase 3 | Pending |
| PAY-02 | Phase 3 | Pending |
| PAY-03 | Phase 3 | Pending |
| PAY-04 | Phase 3 | Pending |
| TICK-01 | Phase 4 | Pending |
| TICK-02 | Phase 4 | Pending |
| TRANS-01 | Phase 5 | Pending |
| TRANS-02 | Phase 5 | Pending |
| TRANS-03 | Phase 5 | Pending |
| ADMIN-01 | Phase 5 | Pending |
| ADMIN-02 | Phase 5 | Pending |
| ADMIN-03 | Phase 5 | Pending |
| NOTIF-01 | Phase 4 | Pending |
| NOTIF-02 | Phase 4 | Pending |
| NOTIF-03 | Phase 4 | Pending |
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| API-03 | Phase 1 | Pending |
| API-04 | Phase 1 | Pending |
| API-05 | Phase 1 | Pending |
| OBS-01 | Phase 1 | Pending |
| SEC-01 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-24*
*Last updated: 2026-08-24 after initial definition*
