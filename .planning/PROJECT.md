# CamerMove

## What This Is

CamerMove is a Cameroonian interurban mobility platform. The MVP is a responsive web app (future native mobile reuses the same API) that lets travelers search, compare, and book bus tickets on the Yaoundé ↔ Douala axis, pay via Mobile Money (NotchPay), and receive e-tickets with QR, while transporters self-serve and CamerMove operates a full admin back-office. Pilot language is French, architecture is i18n-ready for English.

## Core Value

A traveler can search Yaoundé ↔ Douala, select an offer, pay, and receive a valid e-ticket — with no double-booking, and the transporter and admin see the booking.

## Business Context

- **Customer**: Travelers Yaoundé ↔ Douala; partner transporters; CamerMove admin
- **Revenue model**: Commission per booking (configurable %, gross/net persisted)
- **Success metric**: Search→booking→payment→ticket conversion; no double-booking; p95 latency < 2s
- **Strategy notes**: Start Yaoundé↔Douala, expand by data/config (no redeploy)

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Search Yaoundé ↔ Douala with powerful filters (price, time, transporter, availability, vehicle type, date range, q) + sort (price/time/availability) + pagination (page/perPage and limit/offset) + groupBy/orderBy + advanced search + bulk actions — handles thousands of requests (indexes, pagination, Redis cache, debounce)
- [ ] Trip detail page with full offer info, conditions, cancellation policy
- [ ] Traveler account (register/login/reset, Google OAuth via SocialAccount, JWT access+refresh, RBAC)
- [ ] Booking flow (search → select → passenger info → recap → payment → confirmation → e-ticket) with atomic seat hold (DB row-lock + Redis TTL, no double-booking) + metadata collection (ip, os, browser, ua, referer)
- [ ] Payment via NotchPay (Mobile Money cm.mtn/cm.orange first, card second) behind PaymentProvider interface, webhook verified (X-Notch-Signature), idempotent
- [ ] E-ticket with QR/verificationCode, ticket lookup
- [ ] Traveler dashboard (upcoming, history, tickets, cancellations per policy)
- [ ] Transporter space (partner application workflow, profile, vehicles, routes/schedules/prices, capacity, bookings, payment status, stats, pause/close offer) with MinIO presigned uploads (logos, documents)
- [ ] Admin back-office (users, transporters, vehicles, trips, bookings, payments, commissions, notifications, partner review, content, stats, audit log, commission config/reporting)
- [ ] Commission engine (configurable % without redeploy, per-transporter override, gross/net persisted)
- [ ] Notifications via NotificationChannel abstraction — email (own SMTP, with MailHog fallback), WhatsApp (Twilio), push (ntfy per-user topic, web+mobile)
- [ ] Swagger OpenAPI at /docs + /docs/json, Postman collection, smoke scripts (single/all)
- [ ] Observability (OpenTelemetry traces, Prometheus /metrics, Grafana dashboards/alerts, Sentry) + metadata logging + rate limiting + audit log + backups
- [ ] Public pages (home, how it works, become partner, FAQ, contact, legal/CGU/privacy) + mobile-first

### Out of Scope

- Native mobile app (MVP is web, API reusable) — defer
- Loyalty, tourism marketplace, dynamic pricing, AI features, real-time geolocation — defer
- Reviews/ratings, promo codes, advanced mapping — defer (hooks kept)

## Context

- Tech: Turborepo monorepo (apps/web Next 16 + apps/api Fastify 5 + apps/worker Kafka consumer + packages/shared|db|config|media|events|frontend|observability), Postgres + Prisma 6, Redis + BullMQ, Kafka (event backbone) + Redis (delayed jobs), MinIO (S3, presigned URLs), Zustand (frontend), Tailwind 4 + shadcn/ui (tweakcn), Vitest, TypeScript 5.9, NotchPay sandbox, Twilio, ntfy.sh
- Prior work: Lots 0–1 built and committed (foundations, Prisma 6 stable, auth incl. Google OAuth, search, web scaffold, media, events, worker, observability, Swagger/Postman/smoke, powerful search + SMTP + indexes + metadata)
- Known constraints: Cameroonian Mobile Money priority, French launch, future English, .env secrets never committed

## Constraints

- **Tech stack**: Node >=22, pnpm workspaces, ESM, Zod validation on every endpoint — why: stable, type-safe, shared with mobile
- **Payments**: Never store raw card data; all via provider hosted flow — why: PCI, CdCF §12
- **Concurrency**: Seat booking must be atomic/race-safe (DB transaction + row lock + Redis hold) — why: single highest-risk bug
- **Modularity**: Business logic only in API/packages, web only calls API — why: mobile reuse, CdCF §30

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Monorepo Turborepo (apps/web,api,worker + packages/*) | Reuse types/schemas across web+API+mobile, one CI, shared money math | — Pending |
| Prisma 6 stable (prisma-client-js) over 7 | Fewer breaking changes, .env auto-load, conventional | — Pending |
| NotchPay sandbox + PaymentProvider interface | Mobile Money first for Cameroon, swappable | — Pending |
| MinIO (self-host, S3 presigned) | Private buckets, server-owned keys, swappable to S3 | — Pending |
| Kafka (events) + Redis+BullMQ (delayed jobs) | Durable replayable events + native delayed/retry | — Pending |
| ntfy.sh hosted for push (per-user topic) | One channel for web+mobile, zero infra | — Pending |
| Twilio WhatsApp now (vs defer) | Requested, behind channel abstraction, fallback to log | — Pending |
| Powerful search (debounce+autocomplete+cache+indexes+advanced filters/bulk/groupBy/orderBy/pagination + metadata) | Handles thousands of requests, API complete | — Pending |
| Own SMTP (env SMTP_* with MailHog fallback) | Production email, configurable without redeploy | — Pending |
| Swagger at /docs + Postman collection + smoke scripts | Facilitate testing, single/all runs | — Pending |
| OTel + Prometheus + Grafana from first deploy | CdCF §29, metadata, alerts | — Pending |

---

*Last updated: 2026-08-24 after initialization*
