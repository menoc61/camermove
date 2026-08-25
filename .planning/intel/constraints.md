# Constraints — Synthesized Intel

Source: GSD doc synthesizer (merge mode, 2026-08-25)
Precedence: ADR > SPEC > PRD > DOC

---

## SPEC-001: Monorepo Foundations + Turborepo Shell

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md — Task 0.1
- type: protocol
- content:
  - Turborepo monorepo with apps/web, apps/api, apps/worker + packages/*, pnpm 11.9.0, Node >=22, ESM-only, tsx in dev
  - Root scripts: dev/build/lint/test/typecheck/format via turbo; pnpm-workspace.yaml lists apps/* and packages/*
  - tsconfig.base.json: ES2022, Bundler, strict, noUncheckedIndexedAccess, skipLibCheck, declaration true
  - .gitignore excludes node_modules/.next/dist/.turbo/.env/coverage
  - All business logic in apps/api + packages/*; apps/web only calls REST /api/v1; versioned endpoints; Zod on every endpoint; typed AppError -> HTTP mapper; pagination {items, pagination} on every list endpoint; no unbounded arrays

## SPEC-002: Global Constraints (cross-cutting)

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md — Global Constraints section
- type: nfr
- content:
  - French user-facing copy, no hardcoded strings — via next-intl i18n (design doc confirms launch French, i18n-ready for English)
  - Never store/log raw card data; secrets only via packages/config from .env (gitignored), commit .env.example with placeholders
  - TDD with Vitest (red-green-refactor); small single-purpose files (schema/service/repository/routes/types per module)
  - Never commit built artifacts; APIs versioned /api/v1; monitoring from first deploy (OTel tracing + Prometheus /metrics per app + Grafana dashboards/alerts + Sentry; METRICS_ENABLED gates telemetry)
  - Scope expansion via data/config (new cities/routes/transporters never require schema rewrite or redeploy)

## SPEC-003: Typed Config Package

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md — Task 0.2 + C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md §4
- type: api-contract
- content:
  - loadEnv(): Env parses .env via Zod; throws ConfigError on invalid/empty secrets
  - Env schema includes: NODE_ENV, PORT, API_URL, DATABASE_URL (secret), REDIS_URL, KAFKA_BROKERS, MINIO_ENDPOINT/PORT/ACCESS_KEY/SECRET_KEY/BUCKET, JWT_SECRET/REFRESH_SECRET, GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL, NOTCHPAY_BASE_URL/PUBLIC_KEY/PRIVATE_KEY/HASH_KEY, TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM, NTFY_HOST
  - Single Zod EnvSchema; no process.env outside packages/config; error classes: AppError, BadRequest/Unauthorized/Forbidden/NotFound/ConflictError, ConfigError; Role type traveler|transporter_staff|admin|super_admin

## SPEC-004: Local Infra Docker Compose

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md — Task 0.3 + C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md §4 (infra)
- type: protocol
- content:
  - Services: postgres 16-alpine (5432, pgdata), redis 7-alpine (6379), minio (9000/9001, miniodata), kafka bitnami 3.7 (9092), mailhog (1025/8025), kafka-ui (8080), prometheus (9090, infra/prometheus.yml scraping api:3000/metrics and worker:4000/metrics), grafana (3001); healthcheck on postgres
  - .env.example must cover all Env keys; DATABASE_URL=postgresql://camermove:camermove@localhost:5432/camermove; NOTCHPAY_BASE_URL=https://api.notchpay.co
  - Deploy topology: Postgres primary + read-replica ready; Redis for cache/lock/rate-limit; Kafka partitions + trustProxy + /health + SIGTERM graceful; stateless API behind LB

## SPEC-005: Prisma Data Model + Migrations

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md — Task 0.4 + C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md §5
- type: schema
- content:
  - Prisma schema models: User, SocialAccount, Transporter, Vehicle, Route, Trip, SeatAvailability, Booking, Passenger, Payment, Commission, Ticket, Notification, AuditLog, PartnerApplication, Document
  - Enums: Role, TransporterStatus, VehicleStatus, BookingStatus (pending_payment|confirmed|expired|cancelled|refunded), PaymentStatus, PaymentMethod, PaymentProvider notchpay, TicketStatus, NotificationChannel, NotificationStatus, PartnerApplicationStatus
  - Key relations: User 1-N SocialAccount/Booking/Notification/AuditLog; Transporter 1-N Vehicle/Route/Trip/Document + 1-1 PartnerApplication; Route unique[transporterId, originCity, destinationCity]; Trip -> Route/Vehicle/Transporter + 1-1 SeatAvailability; Booking -> Trip/User + N Passenger/Payment + 1-1 Commission + N Ticket
  - Prisma client generated to packages/db/generated; singleton prisma via loadEnv DATABASE_URL; plan doc specifies Prisma 7 (see auto-resolved note), design doc says Prisma generically; PROJECT.md locks Prisma 6 stable — roadmapper resolves to 6

## SPEC-006: Atomic Seat Availability Repository (risk-critical)

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md — Task 0.5 + C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md §5 invariant
- type: api-contract
- content:
  - getSeatAvailability(tripId): SeatAvailability|null
  - atomicHoldSeats(tripId, count): boolean — inside $transaction, SELECT seatsAvailable/seatsHeld FROM SeatAvailability WHERE tripId FOR UPDATE, throw ConflictError if missing or seatsAvailable < count, else update seatsAvailable decrement count, seatsHeld increment count; returns true
  - atomicReleaseHeldSeats(tripId, count): increment seatsAvailable, decrement seatsHeld within transaction
  - atomicConfirmBookedSeats(tripId, count): decrement seatsHeld, increment seatsBooked
  - Postgres triggers trg_seat_check / trg_booking_status enforce invariants transactionally (per AGENTS.md); tests simulate concurrent last-seat booking; ACID required (Prisma $transaction + row locks)

## SPEC-007: Kafka Event Backbone + BullMQ Delayed Jobs

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md — Task 0.6 + C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md §4 Scale design
- type: protocol
- content:
  - EVENT_TOPICS: bookingCreated=camermove.booking.created, paymentCompleted=camermove.payment.completed, ticketIssued=camermove.ticket.issued, seatHeldExpired=camermove.seat.held.expired, notificationShouldSend=camermove.notification.should-send
  - DomainEvent<T> {id, type, ts, aggregateId, data:T}
  - createKafkaClient(env) via kafkajs; createEventProducer (idempotent:true, publish(topic,event) with key aggregateId, JSON value, pino log); createEventConsumer groupId camermove-worker-{NODE_ENV}, subscribe fromBeginning, eachMessage JSON parse + handler with retry/throw + DLQ; outbox pattern: publish within DB transaction to avoid lost/fake events; consumer idempotent by event id + offsets
  - Redis+BullMQ complements Kafka for delayed jobs: seat-hold expiry timers, trip reminders, notification retries with backoff; Redis also for rate-limiting, distributed seat-hold, response cache

## SPEC-008: Auth Module — Password, JWT, RBAC

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md — Task 0.7 + C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md §8
- type: api-contract
- content:
  - hashPassword/verifyPassword via argon2 (plan) — design doc says bcrypt (see auto-resolved note; AGENTS.md and plan enforce argon2)
  - signTokens(user{id,role}, env): access 15m (JWT_SECRET), refresh 30d (JWT_REFRESH_SECRET); verifyAccessToken throws UnauthorizedError; fastify authPlugin decorates requireAuth(role?) preHandler checking Bearer header and role match, attaches req.user {id,role}
  - Routes: POST /api/v1/auth/register (Zod email+password min8, ConflictError if exists, 201 with user+tokens), POST /api/v1/auth/login, POST /api/v1/auth/refresh (stub {ok:true} allowed per AGENTS.md), GET /api/v1/auth/me (requireAuth)
  - User repo: findUserByEmail, findUserById, createUser; RBAC roles: traveler, transporter_staff, admin, super_admin; Google OAuth via SocialAuthProvider interface: GET /auth/google -> consent, callback exchanges code, validates id_token (aud/iss), upserts User + SocialAccount (provider, providerUserId, email, emailVerified true), issues JWT; SocialAccount unique[provider, providerUserId]; passwordHash nullable for OAuth users; creds in .env, button env-gated
  - Every endpoint validates with Zod; AppError mapped in single error handler; stateless JWT Authorization: Bearer, no server session

## SPEC-009: Media Package — MinIO Presigned URLs

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md — Task 0.8 + C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md §6
- type: api-contract
- content:
  - createStorage(env): {getClient, ensureBucket, presignPut(objectKey,mimetype) 15m, presignGet(objectKey) 5m, removeObject} via minio Client (endpoint/port/useSSL/accessKey/secretKey); objectKey(prefix, extension) generates server-owned key prefix/cuid.ext with safeExt sanitization; ensureBucket at startup; buckets: transporters/logos/tickets/docs private by default; validate MIME+size, never trust client paths, conservatively set bucket policies; adapter swappable to S3/GCS via env; DB stores object keys on Transporter.documents/logo

## SPEC-010: Frontend + Observability Wiring (planned, referenced in both SPECs)

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md §4, §10, §11 + C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md Global Constraints
- type: nfr
- content:
  - Web: Next.js 16 App Router + TS 5.9 + Tailwind 4 + shadcn/ui tweakcn theme cmt1ew8a7000004jp22krc04q + Zustand (persist for auth token, ephemeral searchFilters/cart/bookingDraft) + TanStack Query for server data; never duplicate server cache in Zustand
  - Observability: OTel SDK auto-instruments Fastify/Prisma/Redis/Kafka with W3C trace-context across API->Kafka->worker, spans per route/module with attributes; Prometheus scrapes /metrics (METRICS_ENABLED, metrics Fastify plugin, OTel exporter) + infra exporters; Grafana single UI for metrics/logs (Loki optional)/alerting correlated with Sentry; prometheus job api host.docker.internal:3000
  - Security NFR: HTTPS-only, Zod every endpoint, Redis rate limiting (dual-layer IP per-route + app-wide via RATE_LIMIT_* env, 429 Retry-After, Redis shared with memory fallback; OTel metrics search_requests_total{origin,destination}), webhook signature verify (X-Notch-Signature HMAC-SHA256 via N_HASH_KEY), audit log, automated backups Postgres+MinIO tested restore, media MIME+size validated, Kafka idempotent, evolvability via data/config; endpoint metadata via metadataPlugin (ip, os, browser, device, ua, referer, requestId) plus handler-specific fields per AGENTS.md table
  - Notifications (§9): NotificationService.send via channel adapters: email SMTP (MailHog dev->real), WhatsApp Twilio, push ntfy hosted https://ntfy.sh per-user topic camermove_<userId> (web Service Worker + mobile app), graceful degrade (log+email fallback), cred-less dev works, types: bookingConfirmation/paymentConfirmation/eTicket/tripReminder/modification/cancellation/new-booking alert/key admin alerts
  - Payments (§7): PaymentProvider interface -> NotchPay adapter; POST /payments amount XAF, phone +237, email, callback, idempotent reference, returns authorization_url, webhook verifies X-Notch-Signature, idempotent status update, on complete confirm Booking decrement seats generate Ticket+Commission

## SPEC-011: Build Sequence + Definition of Done

- source: C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\specs\2026-08-24-camermove-web-mvp-design.md §12, §13 + C:\Users\DTA_WorkStation\Documents\camermove\docs\superpowers\plans\2026-08-24-camermove-lot0-lot1.md header Tasks 0.1-0.8 (Lot 0 foundations) + Lot 1 search slice
- type: protocol
- content:
  - Lots: 0 Foundations (monorepo, CI, compose, schema, auth/RBAC incl OAuth, config/env, Kafka producer, OTel/Prometheus/Grafana, shadcn/Zustand base), 1 Search (route/trip CRUD, search API, results/filter/sort UI, detail), 2 Booking core (seat hold+expiry, passenger info, recap, concurrency tests), 3 Payment (adapter+webhook, confirmation, failure/expiry release), 4 Ticketing & notifications (QR/code, channels, dashboard), 5 Transporter & admin (self-service, CRUD+stats+audit, partner workflow, commission config/reporting, presigned media), 6 Polish (cancellation/refund, public/legal, security+load, backup/restore drill), 7 Pilot (deploy, seed transporters, live path, feedback)
  - DoD checklist: search Yaounde-Douala, offers display, select offer, passenger info, amount computed, payment initiated+status processed, unique booking reference, e-ticket generated, transporter sees booking, admin sees booking+transaction, seats update no double-booking, notifications fire, data protected+backed up, mobile works
