# CamerMove Web MVP Design

**Date:** 2026-08-24
**Status:** Approved design (awaiting implementation plan)
**Source documents:** CamerMove MVP Master Implementation Prompt v1 + Cahier des Charges + Architecture Technique

---

## 1. Product summary

CamerMove is a Cameroonian interurban mobility platform. The MVP is a **responsive web app** that lets a traveler search, compare, and book a bus ticket on the **Yaoundé ↔ Douala** axis, pay online, and receive an e-ticket — while giving partner transporters a self-service space and CamerMove a full admin back-office.

The business core is designed to be **reused by a future native mobile app**: all business logic lives in the backend API.

- Promoter: Rodrigue DIME
- Launch language: **French** (i18n-ready so English can be added later)

## 2. Roles (RBAC)

| Role | Capability |
|---|---|
| Traveler (Voyageur) | Search, compare, book, pay, e-ticket, manage account/history |
| Transporter staff | Company profile, vehicles, routes, schedules, prices, capacity, bookings/payments |
| CamerMove Admin | Users, transporters, routes, bookings, payments, commissions, notifications, partner applications, stats |
| Super Admin | Sensitive settings, roles/permissions, global config |

## 3. MVP scope

### In scope
Search engine · results & filters/sort · trip detail · traveler account (register/login/reset) · booking flow (search → select → passenger info → recap → payment → confirmation → e-ticket) · temporary seat hold with expiry · NotchPay payment integration · e-ticket with QR/verification code · traveler dashboard (upcoming, history, tickets, cancellations) · transporter space · admin back-office (CRUD + stats + action log) · commission engine (configurable %) · notifications (email, WhatsApp via Twilio, push via ntfy) · basic public pages.

### Out of scope (MVP)
Native mobile app · loyalty · tourism marketplace · dynamic pricing · AI features · real-time geolocation · reviews/ratings · promo codes · advanced mapping.

## 4. Architecture

**Monorepo (Turborepo)** — clean API/frontend split so a mobile app can reuse the API.

```
camermove/
├─ apps/
│  ├─ web/          # Next.js 15 (App Router) + TS + Tailwind + shadcn/ui (tweakcn theme cmt1ew8a7000004jp22krc04q)
│  └─ api/          # Node.js + Fastify + TS, REST /api/v1
├─ packages/
│  └─ shared/       # Zod schemas, TS types, i18n message keys
├─ docker-compose.yml  # postgres + redis + mailhog (dev)
├─ turbo.json
└─ .env / .env.example
```

**Invariant (§4/§30):** all business logic (search, availability, booking, commission) lives in `apps/api`. The web app only calls the API.

## 5. Data model (PostgreSQL via Prisma)

Entities: **User, Transporter, Vehicle, Route, Trip, SeatAvailability, Booking, Payment, Commission, Ticket, Notification, AuditLog, PartnerApplication.**

**Critical invariant:** booking a seat is **atomic and race-safe** — DB transaction + row-level lock (`SELECT ... FOR UPDATE`) for decrement, with a Redis-driven hold-expiry timer. Dedicated tests simulating concurrent bookings on the last seat before the feature is considered done.

## 6. Backend modules

`auth`, `users`, `transporters`, `vehicles`, `routes`, `trips`, `search`, `bookings`, `payments`, `commissions`, `tickets`, `notifications`, `admin`, `stats` — each a Fastify plugin + service + Prisma repository. Controllers thin; business rules in services (unit-tested).

## 7. Payments — NotchPay (sandbox)

Behind a `PaymentProvider` interface → `NotchPay` adapter. Flow:

1. `POST /payments` to NotchPay: `amount` (XAF, no minor units → 1 XAF = 1), customer (`phone` `+237...`, `email`), `callback`, idempotent `reference`.
2. Return `authorization_url` → redirect traveler.
3. On completion NotchPay redirects to `callback` **and** sends a webhook. Webhook verified via `X-Notch-Signature` (HMAC-SHA256 against the hash key) → update `Payment.status`.
4. On `complete`: confirm Booking, decrement seats, generate Ticket + Commission.
5. Idempotent webhook handling (store event id).

Env: `N_PUBLIC_KEY`, `N_PRIVATE_KEY`, `N_HASH_KEY`, `NOTCHPAY_BASE_URL=https://api.notchpay.co`.

## 8. Auth & RBAC

JWT (access+refresh), bcrypt password hashing, 4 roles enforced by API middleware. Admin/super-admin behind stronger auth.

## 9. Notifications

`NotificationService.send(userId, type, channel, payload)` dispatches to channel adapters:

| Channel | Adapter | Launch |
|---|---|---|
| Email | SMTP (MailHog in dev → real later) | yes |
| WhatsApp | Twilio (`twilio` SDK, sandbox sender) | yes |
| Push (web) | ntfy via Service Worker per-user topic | yes |
| Push (mobile) | ntfy app on same per-user topic | yes |

- **ntfy:** hosted instance `https://ntfy.sh`; backend publishes to per-user topic `camermove_<userId>`; browser (@ntfy/web / Service Worker) and ntfy mobile app subscribe. One channel serving web + mobile.
- Channels degrade silently (fallback: log + email) so a cred-less dev env works.
- Twilio creds in `.env` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`) — **never committed**.
- Env: `NTFY_HOST`, plus per-channel enable flags.

Notification types: booking confirmation, payment confirmation, e-ticket, trip reminder, trip modification, cancellation, new-booking alert (transporter), key admin alerts.

## 10. Frontend — mobile-first, French, i18n-ready

- Public: Accueil, À propos, Comment ça marche, Recherche, Résultats (filters/sort), Fiche trajet, Devenir partenaire, FAQ, Contact, CGU/CGV, Privacy, Mentions légales.
- Traveler space: dashboard, profile, upcoming, history, e-tickets, payment details, cancellations, support.
- Transporter space: onboarding request, profile, vehicles, routes/schedules/pricing, capacity, bookings, payments, stats, pause/close offer.
- Admin: dashboard, user/transporter/vehicle/trip/booking/payment/commission/notification mgmt, refund/cancellation, partner review, content mgmt, stats, audit log.
- All copy through i18n (French default); no hardcoded strings. shadcn theme applied.

## 11. Security & NFR

HTTPS-only, Zod validation on every endpoint, rate limiting (Redis), webhook signature verify, audit log, automated backups with tested restore, monitoring from first deploy, evolvability via data/config. Never expose/store raw card data.

## 12. Build sequence (each lot demoable vs §13)

1. **Lot 0 Foundations:** monorepo scaffold, CI, Docker Compose (postgres+redis+mailhog), Prisma schema + migrations, auth + RBAC, shadcn theme base.
2. **Lot 1 Search:** route/trip CRUD (minimal admin UI), search API, results/filter/sort UI, trip detail.
3. **Lot 2 Booking core:** booking creation, seat hold + expiry (concurrency tests), passenger info, recap — stress-test double-booking here.
4. **Lot 3 Payment:** NotchPay adapter + webhook, confirmation transition, failure/expiry release.
5. **Lot 4 Ticketing & notifications:** e-ticket (QR/code), email + WhatsApp + push, traveler dashboard.
6. **Lot 5 Transporter & admin:** transporter self-service, admin CRUD + stats + audit log, partner workflow, commission config/reporting.
7. **Lot 6 Polish & hardening:** cancellation/refund rules, public/legal pages, security + load pass, backup/restore drill.
8. **Lot 7 Pilot:** deploy, seed real transporters, run full live path, collect feedback.

## 13. Acceptance criteria (Definition of Done)

- [ ] User can search Yaoundé ↔ Douala trips
- [ ] Available offers display correctly
- [ ] User can select an offer
- [ ] User can enter passenger information
- [ ] System correctly computes the amount due
- [ ] Payment can be initiated and its status processed
- [ ] A confirmed booking generates a unique reference
- [ ] An e-ticket is generated
- [ ] The transporter sees the booking
- [ ] The admin sees the booking and the transaction
- [ ] Available seats update correctly (no double-booking)
- [ ] Planned notifications fire correctly
- [ ] Data is protected and backed up
- [ ] The site works correctly on smartphone
