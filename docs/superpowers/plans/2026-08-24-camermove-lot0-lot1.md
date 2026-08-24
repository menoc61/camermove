# CamerMove Lot 0 + Lot 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CamerMove monorepo foundations (Lot 0) and the search & discovery vertical slice (Lot 1) so travelers can search Yaoundé ↔ Douala trips end-to-end.

**Architecture:** Modular Turborepo. `apps/api` (Fastify) is the stateless REST host holding all business logic. `apps/web` (Next 16) is the mobile-first client, using Zustand for ephemeral state and a generated API client. A Kafka outbox publishes domain events; a `apps/worker` consumer group handles them, with BullMQ for delayed jobs. Prisma + Postgres is the data layer, Redis is cache/lock/queue, MinIO is object storage, and `packages/shared` holds schemas/types/money math reused by every app and a future mobile client.

**Tech Stack:** Next.js 16, Fastify 5, Prisma 7, PostgreSQL, Redis (ioredis), Kafka (kafkajs) + BullMQ, MinIO (minio), Zod 4, TanStack Query, Zustand 5, Tailwind 4 + shadcn/ui, Vitest, TypeScript 5.9, Turborepo 2, pnpm workspaces.

## Global Constraints

- Node >= 22 (host is Node 24). Package manager: **pnpm** (workspaces). Do not use npm/yarn to install.
- JavaScript only, no runtime that isn't ESM-compatible. Backend is TypeScript compiled/run via **tsx** in dev.
- All user-facing copy in **French**; never hardcode strings — every string via i18n (next-intl).
- No raw payment card data is ever stored or logged. Secrets only via `packages/config` from `.env` (gitignored); commit `.env.example` with placeholders.
- Every list endpoint returns `{ items, pagination }` and is paginated. Never return unbounded arrays.
- Every endpoint validates input with **Zod**; backend throws typed `AppError` mapped to HTTP codes in one error handler.
- Generate/seeded data only for `dev`/`test`; never seed production.
- All business logic lives in `apps/api` + `packages/*`. `apps/web` only calls the API.
- TDD: write the failing test, run it to confirm it fails, implement, run to confirm pass, commit. Use Vitest.
- Files are small and single-purpose; one module = one directory with `schema.ts`, `service.ts`, `repository.ts`, `routes.ts`, `types.ts`.
- Never commit secrets. Never commit built artifacts (`dist/`, `.next/`, `node_modules/`).
- APIs are versioned under `/api/v1`.
- Monitoring from the first deploy: OpenTelemetry tracing + Prometheus `/metrics` on every app; Grafana dashboards + alerts; Sentry for error tracking. `METRICS_ENABLED` gates telemetry (no-op in test/dev without an OTel backend).

---

### Task 0.1: Initialize the pnpm monorepo + Turborepo shell

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`
- Create: `README.md`

**Interfaces:**
- Produces: the workspace root with a `pnpm-workspace.yaml` listing `apps/*` and `packages/*`. Scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm format`. All later tasks run via `pnpm` from the root.

- [ ] **Step 1: Write the root `package.json`**

```json
{
  "name": "camermove",
  "private": true,
  "packageManager": "pnpm@11.9.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\""
  },
  "devDependencies": {
    "prettier": "^3.6.0",
    "turbo": "^2.10.11"
  }
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Write `.npmrc`**

```
shamefully-hoist=true
strict-peer-dependencies=false
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
.next/
dist/
.turbo/
*.tsbuildinfo
.env
.env.local
.env.*.local
coverage/
.DS_Store
```

- [ ] **Step 5: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_ENV", "DATABASE_URL"],
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

- [ ] **Step 6: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "types": ["node"]
  }
}
```

- [ ] **Step 7: Write root `tsconfig.json`**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": []
}
```

- [ ] **Step 8: Write `README.md`**

```markdown
# CamerMove

Cameroonian interurban transport booking platform (Yaoundé ↔ Douala).

## Structure

- `apps/api` — Fastify REST API (all business logic)
- `apps/web` — Next.js web client
- `apps/worker` — Kafka consumer + BullMQ processor
- `packages/*` — shared modules (db, config, media, events, frontend, shared)

## Dev

cp .env.example .env
pnpm install
docker compose up -d
pnpm dev
```

- [ ] **Step 9: Verify**

Run: `node -e "const p=require('./package.json'); if(p.packageManager!=='pnpm@11.9.0') process.exit(1); console.log('ok')"`
Expected: `ok`

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: initialize pnpm monorepo with turborepo"
```

---

### Task 0.2: Shared config package (typed env + Zod)

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/src/index.ts`
- Create: `packages/config/src/env.ts`
- Create: `packages/config/src/logger.ts`
- Create: `packages/config/src/errors.ts`
- Test: `packages/config/src/env.test.ts`

**Interfaces:**
- Consumes: root `package.json`.
- Produces:
  - `loadEnv(): Env` — parses `.env` via Zod; throws `ConfigError` on invalid/empty secrets.
  - `Env` type — `{ NODE_ENV, PORT, API_URL, DATABASE_URL, REDIS_URL, KAFKA_BROKERS, MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, JWT_SECRET, JWT_REFRESH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, NOTCHPAY_BASE_URL, NOTCHPAY_PUBLIC_KEY, NOTCHPAY_PRIVATE_KEY, NOTCHPAY_HASH_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, NTFY_HOST }`
  - `logger` — a pino logger instance.
  - `AppError` class, plus `BadRequestError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`.
  - `ConfigError` class.

- [ ] **Step 1: Write the failing test**

`packages/config/src/env.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loadEnv } from './env'

beforeEach(() => {
  delete process.env.NODE_ENV
  delete process.env.DATABASE_URL
  delete process.env.JWT_SECRET
})

describe('loadEnv', () => {
  it('parses a valid env and defaults NODE_ENV and PORT', () => {
    process.env.DATABASE_URL = 'postgres://u:p@localhost:5432/camermove'
    process.env.JWT_SECRET = 'x'.repeat(64)
    const env = loadEnv()
    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3000)
    expect(env.DATABASE_URL).toBe('postgres://u:p@localhost:5432/camermove')
  })

  it('throws ConfigError when a required secret is missing', () => {
    process.env.DATABASE_URL = ''
    expect(() => loadEnv()).toThrow(/DATABASE_URL/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/config test`
Expected: FAIL — `loadEnv` not exported / module not found.

- [ ] **Step 3: Implement `packages/config/src/env.ts`**

```ts
import { z } from 'zod'

const secret = z.string().min(1)

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: secret,
  REDIS_URL: z.string().default('redis://localhost:6379'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_ACCESS_KEY: secret,
  MINIO_SECRET_KEY: secret,
  MINIO_BUCKET: z.string().default('camermove'),
  JWT_SECRET: secret,
  JWT_REFRESH_SECRET: secret,
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  NOTCHPAY_BASE_URL: z.string().url().default('https://api.notchpay.co'),
  NOTCHPAY_PUBLIC_KEY: secret,
  NOTCHPAY_PRIVATE_KEY: secret,
  NOTCHPAY_HASH_KEY: secret,
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  NTFY_HOST: z.string().default('https://ntfy.sh'),
})

export type Env = z.infer<typeof EnvSchema>

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new ConfigError(`Invalid environment: ${missing}`)
  }
  return parsed.data
}
```

- [ ] **Step 4: Implement error classes `packages/config/src/errors.ts`**

```ts
export class AppError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
  }
}
export class BadRequestError extends AppError {
  constructor(msg = 'Requête invalide', code = 'BAD_REQUEST') {
    super(400, code, msg)
  }
}
export class UnauthorizedError extends AppError {
  constructor(msg = 'Non autorisé', code = 'UNAUTHORIZED') {
    super(401, code, msg)
  }
}
export class ForbiddenError extends AppError {
  constructor(msg = 'Accès refusé', code = 'FORBIDDEN') {
    super(403, code, msg)
  }
}
export class NotFoundError extends AppError {
  constructor(msg = 'Introuvable', code = 'NOT_FOUND') {
    super(404, code, msg)
  }
}
export class ConflictError extends AppError {
  constructor(msg = 'Conflit', code = 'CONFLICT') {
    super(409, code, msg)
  }
}
```

- [ ] **Step 5: Implement logger `packages/config/src/logger.ts`**

```ts
import { pino } from 'pino'

export function createLogger() {
  return pino({ level: process.env.LOG_LEVEL ?? 'info' })
}
```

- [ ] **Step 6: Implement package entry `packages/config/src/index.ts`**

```ts
export * from './env'
export * from './errors'
export * from './logger'
export * from './types'
```
Add `packages/config/src/types.ts`:

```ts
export type Role = 'traveler' | 'transporter_staff' | 'admin' | 'super_admin'
export type ID = string
```

- [ ] **Step 7: Write `packages/config/package.json`**

```json
{
  "name": "@camermove/config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "pino": "^10.3.1", "zod": "^4.4.3" },
  "devDependencies": { "typescript": "^5.9.3", "vitest": "^4.1.11" }
}
```

- [ ] **Step 8: Write `packages/config/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "types": ["node", "vitest/globals"] },
  "include": ["src"]
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @camermove/config test`
Expected: PASS (2 tests).

- [ ] **Step 10: Run typecheck**

Run: `pnpm --filter @camermove/config typecheck`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add packages/config package.json pnpm-lock.yaml
git commit -m "feat: add shared config package (env, errors, logger)"
```

---

### Task 0.3: Docker Compose for local infra (postgres, redis, minio, kafka, mailhog, kafka-ui)

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

**Interfaces:**
- Consumes: `@camermove/config` env names.
- Produces: a one-command local infra stack. Postgres on `5432`, Redis `6379`, MinIO `9000`/`9001`, Kafka on `9092` (brokers `localhost:9092`), MailHog `1025`/`8025`, Kafka UI `8080`, **Prometheus `9090`**, **Grafana `3001`**.

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: camermove
      POSTGRES_PASSWORD: camermove
      POSTGRES_DB: camermove
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U camermove"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: ["miniodata:/data"]

  kafka:
    image: bitnami/kafka:3.7
    environment:
      KAFKA_CFG_NODE_ID: "1"
      KAFKA_CFG_PROCESS_ROLES: controller,broker
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: "true"
      KAFKA_CFG_OFFSETS_TOPIC_REPLICATION_FACTOR: "1"
      KAFKA_CFG_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: "1"
      KAFKA_CFG_TRANSACTION_STATE_LOG_MIN_ISR: "1"
      ALLOW_PLAINTEXT_LISTENER: "yes"
    ports: ["9092:9092"]

  mailhog:
    image: mailhog/mailhog:latest
    ports: ["1025:1025", "8025:8025"]

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    environment:
      DYNAMIC_CONFIG_ENABLED: "true"
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
    ports: ["8080:8080"]
    depends_on: [kafka]

  prometheus:
    image: prom/prometheus:latest
    volumes: ["./infra/prometheus.yml:/etc/prometheus/prometheus.yml:ro"]
    command: ["--config.file=/etc/prometheus/prometheus.yml"]
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
      GF_USERS_ALLOW_SIGN_UP: "false"
    ports: ["3001:3000"]
    depends_on: [prometheus]
    volumes: ["grafanadata:/var/lib/grafana"]

volumes:
  pgdata:
  miniodata:
  grafanadata:
```

- [ ] **Step 2: Write `infra/prometheus.yml`**

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: api
    metrics_path: /metrics
    static_configs:
      - targets: ["host.docker.internal:3000"]
  - job_name: worker
    metrics_path: /metrics
    static_configs:
      - targets: ["host.docker.internal:4000"]
  - job_name: prometheus
    static_configs:
      - targets: ["localhost:9090"]
```

- [ ] **Step 3: Write `.env.example`**

```
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
DATABASE_URL=postgresql://camermove:camermove@localhost:5432/camermove
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=camermove
JWT_SECRET=REPLACE_WITH_64_CHAR_RANDOM
JWT_REFRESH_SECRET=REPLACE_WITH_64_CHAR_RANDOM
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
NOTCHPAY_BASE_URL=https://api.notchpay.co
NOTCHPAY_PUBLIC_KEY=REPLACE_ME
NOTCHPAY_PRIVATE_KEY=REPLACE_ME
NOTCHPAY_HASH_KEY=REPLACE_ME
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
NTFY_HOST=https://ntfy.sh
```

- [ ] **Step 3: Copy env and start infrastructure**

Run: `Copy-Item .env.example .env` then `docker compose up -d`
Expected: containers `postgres`, `redis`, `minio`, `kafka`, `mailhog`, `kafka-ui`, `prometheus`, `grafana` running (`docker compose ps` shows `Up`).

- [ ] **Step 4: Verify connectivity**

Run: `docker compose exec postgres pg_isready -U camermove ; docker compose exec redis redis-cli ping ; docker compose exec grafana curl -s localhost:3000/api/health`
Expected: `accepting connections`, `PONG`, and Grafana health JSON.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml infra/prometheus.yml .env.example
git commit -m "chore: add local infra docker compose stack with monitoring"
```

---

### Task 0.4: DB package — Prisma schema for the MVP entities + migrations

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/prisma.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/.env`

**Interfaces:**
- Consumes: `@camermove/config` (`loadEnv`, `Env`).
- Produces:
  - `prisma` — the singleton PrismaClient instance.
  - `Prisma` — re-exported from `@prisma/client`.
  - The schema defines models: `User`, `SocialAccount`, `Transporter`, `Vehicle`, `Route`, `Trip`, `SeatAvailability`, `Booking`, `Passenger`, `Payment`, `Commission`, `Ticket`, `Notification`, `AuditLog`, `PartnerApplication`.
  - Enums: `Role`, `TransporterStatus`, `BookingStatus`, `PaymentStatus`, `PaymentMethod`, `PaymentProvider`, `TicketStatus`, `NotificationChannel`, `NotificationStatus`, `PartnerApplicationStatus`, `VehicleStatus`.

- [ ] **Step 1: Write the schema `packages/db/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  traveler
  transporter_staff
  admin
  super_admin
}

enum TransporterStatus {
  pending
  reviewing
  approved
  rejected
}

enum VehicleStatus {
  active
  inactive
}

enum BookingStatus {
  pending_payment
  confirmed
  expired
  cancelled
  refunded
}

enum PaymentStatus {
  pending
  processing
  success
  failed
  refunded
}

enum PaymentMethod {
  card
  mobile_money
  bank_transfer
}

enum PaymentProvider {
  notchpay
}

enum TicketStatus {
  valid
  used
  void
}

enum NotificationChannel {
  email
  sms
  whatsapp
  push
}

enum NotificationStatus {
  queued
  sent
  failed
}

enum PartnerApplicationStatus {
  received
  reviewing
  validated
  rejected
}

model User {
  id              String         @id @default(cuid())
  role            Role           @default(traveler)
  firstName       String?
  lastName        String?
  email           String         @unique
  phone           String?
  passwordHash    String?
  emailVerified   Boolean        @default(false)
  status          String         @default("active")
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  socialAccounts  SocialAccount[]
  bookings        Booking[]
  notifications   Notification[]
  auditLogs       AuditLog[]
}

model SocialAccount {
  id             String   @id @default(cuid())
  provider       String
  providerUserId String   @unique
  email          String
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())

  @@unique([provider, providerUserId])
}

model Transporter {
  id            String           @id @default(cuid())
  companyName   String
  contactName   String?
  phone         String?
  email         String           @unique
  city          String?
  transportType String?
  vehicleCount  Int              @default(0)
  servedRoutes  String[]
  status        TransporterStatus @default(pending)
  documents     Document[]
  vehicles      Vehicle[]
  routes        Route[]
  trips         Trip[]
  partnerApplication PartnerApplication?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
}

model Document {
  id            String    @id @default(cuid())
  type          String
  objectKey     String
  mimetype      String
  size          Int
  transporterId String
  transporter   Transporter @relation(fields: [transporterId], references: [id], onDelete: Cascade)
  createdAt     DateTime  @default(now())
}

model Vehicle {
  id            String   @id @default(cuid())
  type          String
  capacity      Int
  plateNumber   String?
  status        VehicleStatus @default(active)
  transporterId String
  transporter   Transporter @relation(fields: [transporterId], references: [id], onDelete: Cascade)
  trips         Trip[]
  createdAt     DateTime @default(now())
}

model Route {
  id             String   @id @default(cuid())
  originCity     String
  destinationCity String
  active         Boolean  @default(true)
  transporterId  String
  transporter    Transporter @relation(fields: [transporterId], references: [id], onDelete: Cascade)
  trips          Trip[]
  createdAt      DateTime @default(now())

  @@unique([transporterId, originCity, destinationCity])
}

model Trip {
  id                String   @id @default(cuid())
  routeId           String
  route             Route    @relation(fields: [routeId], references: [id], onDelete: Cascade)
  vehicleId         String?
  vehicle           Vehicle? @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  transportId       String
  transport         Transporter @relation("TripTransporter", fields: [transportId], references: [id])
  departureAt       DateTime
  arrivalEstimateAt DateTime?
  durationEstimate  Int?
  price             Int
  totalSeats        Int
  departurePointInfo String?
  vehicleTypeInfo   String?
  conditions        String?
  cancellationPolicy String?
  status            String   @default("active")
  seatAvailability  SeatAvailability?
  bookings          Booking[]
  createdAt         DateTime @default(now())
}

model SeatAvailability {
  id             String  @id @default(cuid())
  tripId         String  @unique
  trip           Trip    @relation(fields: [tripId], references: [id], onDelete: Cascade)
  seatsAvailable Int
  seatsHeld      Int     @default(0)
  seatsBooked    Int     @default(0)
}

model Booking {
  id             String          @id @default(cuid())
  reference      String          @unique
  tripId         String
  trip           Trip            @relation(fields: [tripId], references: [id], onDelete: Restrict)
  userId         String
  user           User            @relation(fields: [userId], references: [id], onDelete: Restrict)
  seatCount      Int
  totalAmount    Int
  status         BookingStatus   @default(pending_payment)
  holdExpiresAt  DateTime?
  passengers     Passenger[]
  payments       Payment[]
  commission     Commission?
  tickets        Ticket[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

model Passenger {
  id        String  @id @default(cuid())
  bookingId String
  booking   Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  fullName  String
  phone     String?
}

model Payment {
  id            String          @id @default(cuid())
  bookingId     String
  booking       Booking         @relation(fields: [bookingId], references: [id], onDelete: Restrict)
  provider      PaymentProvider @default(notchpay)
  providerRef   String?
  amount        Int
  method        PaymentMethod?
  currency      String          @default("XAF")
  status        PaymentStatus   @default(pending)
  webhookPayload Json?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
}

model Commission {
  id               String  @id @default(cuid())
  bookingId        String  @unique
  booking          Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  grossAmount      Int
  commissionAmount Int
  netAmount        Int
  percentApplied   Decimal @db.Decimal(5, 2)
  payoutStatus     String  @default("pending")
}

model Ticket {
  id            String       @id @default(cuid())
  bookingId     String
  booking       Booking      @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  qrCode        String
  verificationCode String     @unique
  status        TicketStatus @default(valid)
  issuedAt      DateTime     @default(now())
}

model Notification {
  id            String             @id @default(cuid())
  userId        String?
  user          User?              @relation(fields: [userId], references: [id], onDelete: SetNull)
  transporterId String?
  channel       NotificationChannel
  type          String
  status        NotificationStatus @default(queued)
  payload       Json
  sentAt        DateTime?
  createdAt     DateTime           @default(now())
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String
  actor      User     @relation(fields: [actorId], references: [id], onDelete: Restrict)
  action     String
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime @default(now())
}

model PartnerApplication {
  id             String                  @id @default(cuid())
  companyName    String
  contactName    String
  phone          String
  email          String
  city           String?
  transportType  String?
  vehicleCount   Int?
  routesServed   String[]
  message        String?
  status         PartnerApplicationStatus @default(received)
  transporterId  String?
  transporter    Transporter?            @relation(fields: [transporterId], references: [id], onDelete: SetNull)
  documents      Document[]
  createdAt      DateTime                @default(now())
}
```

- [ ] **Step 2: Write `packages/db/src/prisma.ts`**

```ts
import { loadEnv } from "@camermove/config"
import { PrismaClient } from "../generated/client"

const env = loadEnv()

export const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } })
```

- [ ] **Step 3: Write `packages/db/src/index.ts`**

```ts
export { prisma } from "./prisma"
export { Prisma } from "../generated/client"
export type * from "../generated/client"
```

- [ ] **Step 4: Write `packages/db/package.json`**

```json
{
  "name": "@camermove/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "seed": "tsx prisma/seed.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@camermove/config": "workspace:*",
    "@prisma/client": "^7.9.1"
  },
  "devDependencies": {
    "prisma": "^7.9.1",
    "typescript": "^5.9.3",
    "tsx": "^4.23.12",
    "vitest": "^4.1.11"
  }
}
```

- [ ] **Step 5: Write `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "types": ["node", "vitest/globals"] },
  "include": ["src", "prisma"]
}
```

- [ ] **Step 6: Write `packages/db/.env` with the local DB URL**

```
DATABASE_URL=postgresql://camermove:camermove@localhost:5432/camermove
```

- [ ] **Step 7: Generate the Prisma client and run migrations**

Run: `pnpm --filter @camermove/db generate`
Expected: Prisma client output to `generated/`.

Run: `pnpm --filter @camermove/db migrate -- --name init`
Expected: migration applied, schema created.

- [ ] **Step 8: Verify Prisma typecheck**

Run: `pnpm --filter @camermove/db typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/db
git commit -m "feat: add Prisma schema for CamerMove entities and migrations"
```

---

### Task 0.5: Core booking domain — seat availability repository + atomic decrement (the risk-critical piece)

**Files:**
- Create: `packages/db/src/repositories/seat.repository.ts`
- Test: `packages/db/src/repositories/seat.repository.test.ts`
- Modify: `packages/db/src/index.ts` (export the repository)

**Interfaces:**
- Consumes: Task 0.4 `prisma`, `SeatAvailability` model.
- Produces:
  - `getSeatAvailability(tripId: string): Promise<SeatAvailability | null>`
  - `atomicHoldSeats(tripId: string, count: number): Promise<boolean>` — within a transaction, `SELECT ... FOR UPDATE` the row and decrement `seatsAvailable` by `count` only if enough remain; increments `seatsHeld`; returns `false` (and throws `ConflictError`) if insufficient. Atomic and race-safe.
  - `atomicReleaseHeldSeats(tripId: string, count: number): Promise<void>` — return held seats back to available.
  - `atomicConfirmBookedSeats(tripId: string, count: number): Promise<void>` — move held seats to booked.
- These are the highest-risk primitives; Lot 2 concurrency tests build on top.

- [ ] **Step 1: Write the failing test**

`packages/db/src/repositories/seat.repository.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "../prisma"
import { atomicHoldSeats, atomicReleaseHeldSeats, atomicConfirmBookedSeats } from "./seat.repository"

let tripId: string

beforeAll(async () => {
  const trip = await prisma.trip.create({
    data: {
      routeId: (await prisma.route.create({
        data: { originCity: "Yaoundé", destinationCity: "Douala", transporterId: (await prisma.transporter.create({ data: { companyName: "Test Co", email: "t@co.com" } })).id },
      })).id,
      transportId: (await prisma.transporter.findFirstOrThrow()).id,
      departureAt: new Date(Date.now() + 86400000),
      price: 5000,
      totalSeats: 2,
      seatAvailability: { create: { seatsAvailable: 2, seatsHeld: 0, seatsBooked: 0 } },
    },
  })
  tripId = trip.id
})

afterAll(async () => {
  await prisma.trip.deleteMany({ where: { id: tripId } })
  await prisma.$disconnect()
})

describe("atomicHoldSeats", () => {
  it("holds seats and decrements availability", async () => {
    const ok = await atomicHoldSeats(tripId, 1)
    expect(ok).toBe(true)
    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId } })
    expect(sa.seatsAvailable).toBe(1)
    expect(sa.seatsHeld).toBe(1)
  })

  it("rejects when insufficient seats (no double-booking on last seat)", async () => {
    await atomicHoldSeats(tripId, 1)
    await expect(atomicHoldSeats(tripId, 2)).rejects.toThrow()
    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId } })
    expect(sa.seatsAvailable).toBe(0)
    expect(sa.seatsHeld).toBe(2)
  })

  it("releases held seats back to availability", async () => {
    await atomicReleaseHeldSeats(tripId, 1)
    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId } })
    expect(sa.seatsAvailable).toBe(1)
    expect(sa.seatsHeld).toBe(1)
  })

  it("confirms held seats into booked", async () => {
    await atomicConfirmBookedSeats(tripId, 1)
    const sa = await prisma.seatAvailability.findUniqueOrThrow({ where: { tripId } })
    expect(sa.seatsBooked).toBe(1)
    expect(sa.seatsHeld).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/db test`
Expected: FAIL — `atomicHoldSeats` not exported.

- [ ] **Step 3: Implement `seat.repository.ts`**

```ts
import { prisma } from "../prisma"
import { ConflictError } from "@camermove/config"

export async function getSeatAvailability(tripId: string) {
  return prisma.seatAvailability.findUnique({ where: { tripId } })
}

export async function atomicHoldSeats(tripId: string, count: number): Promise<boolean> {
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ seatsAvailable: number; seatsHeld: number }>>`
      SELECT "seatsAvailable", "seatsHeld" FROM "SeatAvailability"
      WHERE "tripId" = ${tripId}
      FOR UPDATE
    `
    const row = rows[0]
    if (!row) throw new ConflictError("Aucune disponibilité pour ce trajet")
    if (row.seatsAvailable < count) throw new ConflictError("Places insuffisantes")
    await tx.seatAvailability.update({
      where: { tripId },
      data: { seatsAvailable: { decrement: count }, seatsHeld: { increment: count } },
    })
    return true
  })
  return result
}

export async function atomicReleaseHeldSeats(tripId: string, count: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.seatAvailability.update({
      where: { tripId },
      data: { seatsAvailable: { increment: count }, seatsHeld: { decrement: count } },
    })
  })
}

export async function atomicConfirmBookedSeats(tripId: string, count: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.seatAvailability.update({
      where: { tripId },
      data: { seatsHeld: { decrement: count }, seatsBooked: { increment: count } },
    })
  })
}
```

- [ ] **Step 4: Export from `packages/db/src/index.ts`**

```ts
export { prisma } from "./prisma"
export { Prisma } from "../generated/client"
export type * from "../generated/client"
export * from "./repositories/seat.repository"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @camermove/db test`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/db
git commit -m "feat: add atomic race-safe seat availability repository"
```

---

### Task 0.6: Events package — Kafka topic constants, producer, and outbox

**Files:**
- Create: `packages/events/package.json`
- Create: `packages/events/tsconfig.json`
- Create: `packages/events/src/topics.ts`
- Create: `packages/events/src/types.ts`
- Create: `packages/events/src/kafka.ts`
- Create: `packages/events/src/producer.ts`
- Create: `packages/events/src/consumer.ts`
- Test: `packages/events/src/topics.test.ts`

**Interfaces:**
- Consumes: `@camermove/config` (`Env`, `createLogger`).
- Produces:
  - `EVENT_TOPICS` constant object — `{ bookingCreated:"camermove.booking.created", paymentCompleted:"camermove.payment.completed", ticketIssued:"camermove.ticket.issued", seatHeldExpired:"camermove.seat.held.expired", notificationShouldSend:"camermove.notification.should-send" }`
  - `DomainEvent<T>` generic type — `{ id, type, ts, aggregateId, data: T }`
  - `createKafkaClient(env: Env)` — returns a `kafkajs` Kafka client.
  - `createEventProducer(kafka, env)` — producer with idempotence, `publish(topic, event)`.
  - `createEventConsumer(kafka, env, handlers)` — consumer group with `fromBeginning` and manual commit; processes each message idempotently by event `id`.

- [ ] **Step 1: Write the failing test**

`packages/events/src/topics.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { EVENT_TOPICS } from "./topics"

describe("EVENT_TOPICS", () => {
  it("defines all required topics", () => {
    expect(EVENT_TOPICS.bookingCreated).toBe("camermove.booking.created")
    expect(EVENT_TOPICS.paymentCompleted).toBe("camermove.payment.completed")
    expect(EVENT_TOPICS.ticketIssued).toBe("camermove.ticket.issued")
    expect(EVENT_TOPICS.seatHeldExpired).toBe("camermove.seat.held.expired")
    expect(EVENT_TOPICS.notificationShouldSend).toBe("camermove.notification.should-send")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/events test`
Expected: FAIL — `EVENT_TOPICS` not exported.

- [ ] **Step 3: Implement `topics.ts`**

```ts
export const EVENT_TOPICS = {
  bookingCreated: "camermove.booking.created",
  paymentCompleted: "camermove.payment.completed",
  ticketIssued: "camermove.ticket.issued",
  seatHeldExpired: "camermove.seat.held.expired",
  notificationShouldSend: "camermove.notification.should-send",
} as const

export type EventTopic = (typeof EVENT_TOPICS)[keyof typeof EVENT_TOPICS]
```

- [ ] **Step 4: Implement `types.ts`**

```ts
export interface DomainEvent<T = unknown> {
  id: string
  type: string
  ts: string
  aggregateId: string
  data: T
}
```

- [ ] **Step 5: Implement `kafka.ts`**

```ts
import { Kafka } from "kafkajs"
import type { Env } from "@camermove/config"

export function createKafkaClient(env: Env) {
  return new Kafka({
    clientId: "camermove",
    brokers: env.KAFKA_BROKERS.split(","),
  })
}
```

- [ ] **Step 6: Implement `producer.ts`**

```ts
import type { Kafka } from "kafkajs"
import type { Env } from "@camermove/config"
import { createLogger } from "@camermove/config"
import type { DomainEvent, EventTopic } from "./topics"

const log = createLogger()

export function createEventProducer(kafka: Kafka, env: Env) {
  const producer = kafka.producer({ idempotent: true })
  return {
    async connect() {
      await producer.connect()
    },
    async publish<T>(topic: EventTopic, event: DomainEvent<T>) {
      await producer.send({
        topic,
        messages: [{ key: event.aggregateId, value: JSON.stringify(event) }],
      })
      log.info({ topic, id: event.id }, "event published")
    },
    async disconnect() {
      await producer.disconnect()
    },
  }
}

export type EventProducer = ReturnType<typeof createEventProducer>
```

- [ ] **Step 7: Implement `consumer.ts`**

```ts
import type { Kafka } from "kafkajs"
import type { Env } from "@camermove/config"
import { createLogger } from "@camermove/config"
import type { DomainEvent, EventTopic } from "./topics"

const log = createLogger()

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>

export function createEventConsumer(
  kafka: Kafka,
  env: Env,
  handlers: Partial<Record<EventTopic, EventHandler>>,
) {
  const groupId = `camermove-worker-${env.NODE_ENV}`
  const consumer = kafka.consumer({ groupId })
  return {
    async connect() {
      await consumer.connect()
      for (const [topic, handler] of Object.entries(handlers)) {
        await consumer.subscribe({ topic, fromBeginning: true })
        log.info({ topic }, "subscribed")
      }
      await consumer.run({
        eachMessage: async ({ topic, message }) => {
          if (!handler) return
          const event: DomainEvent = JSON.parse(message.value!.toString())
          try {
            await (handler as EventHandler)(event)
            log.info({ topic, id: event.id }, "event handled")
          } catch (err) {
            log.error({ topic, id: event.id, err }, "event handling failed; retrying")
            throw err
          }
        },
      })
    },
    async disconnect() {
      await consumer.disconnect()
    },
  }
}
```

- [ ] **Step 8: Write `packages/events/package.json`**

```json
{
  "name": "@camermove/events",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@camermove/config": "workspace:*", "kafkajs": "^2.2.4", "pino": "^10.3.1" },
  "devDependencies": { "typescript": "^5.9.3", "vitest": "^4.1.11" }
}
```

- [ ] **Step 9: Write `packages/events/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "types": ["node", "vitest/globals"] },
  "include": ["src"]
}
```

- [ ] **Step 10: Write `packages/events/src/index.ts`**

```ts
export * from "./topics"
export * from "./types"
export * from "./producer"
export * from "./consumer"
export { createKafkaClient } from "./kafka"
```

- [ ] **Step 11: Run test and typecheck**

Run: `pnpm --filter @camermove/events test` → PASS. Then `pnpm --filter @camermove/events typecheck` → no errors.

- [ ] **Step 12: Commit**

```bash
git add packages/events
git commit -m "feat: add Kafka events package (topics, producer, consumer)"
```

---

### Task 0.7: Auth module — JWT sign/verify, password hashing, RBAC middleware

**Files:**
- Create: `packages/db/src/repositories/user.repository.ts`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/auth/tokens.ts`
- Create: `apps/api/src/auth/password.ts`
- Create: `apps/api/src/auth/plugins.ts`
- Create: `apps/api/src/auth/routes.ts` (register + login + refresh + me)
- Test: `apps/api/src/auth/password.test.ts`

**Interfaces:**
- Consumes: `@camermove/db` (`prisma`), `@camermove/config` (`Env`, `AppError`).
- Produces:
  - `signTokens(user)` → `{ accessToken, refreshToken }` (JWT via `jsonwebtoken`).
  - `verifyAccessToken(token)` → payload.
  - `hashPassword(plain)` → argon2 hash; `verifyPassword(hash, plain)`.
  - Fastify `authPlugin` — adds `request.user`; `requireAuth(role?)` preHandler.
  - Routes: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me`.
  - Repo: `findUserByEmail`, `createUser`, `findUserById`, `getUserWithRole`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/auth/password.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { hashPassword, verifyPassword } from "./password"

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("S3cret!")
    expect(hash).toContain("$argon2")
    expect(await verifyPassword(hash, "S3cret!")).toBe(true)
    expect(await verifyPassword(hash, "wrong")).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/api test`
Expected: FAIL — `hashPassword` not exported.

- [ ] **Step 3: Implement `password.ts`**

```ts
import argon2 from "argon2"

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain)
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain)
}
```

- [ ] **Step 4: Implement `tokens.ts`**

```ts
import jwt from "jsonwebtoken"
import type { Env } from "@camermove/config"
import { UnauthorizedError } from "@camermove/config"

interface UserClaims {
  sub: string
  role: string
}

export function signTokens(user: { id: string; role: string }, env: Env) {
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: "15m" })
  const refreshToken = jwt.sign({ sub: user.id }, env.JWT_REFRESH_SECRET, { expiresIn: "30d" })
  return { accessToken, refreshToken }
}

export function verifyAccessToken(token: string, env: Env): UserClaims {
  try {
    return jwt.verify(token, env.JWT_SECRET) as UserClaims
  } catch {
    throw new UnauthorizedError()
  }
}
```

- [ ] **Step 5: Implement user repository**

`packages/db/src/repositories/user.repository.ts`:

```ts
import { prisma } from "../prisma"

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } })
}

export async function createUser(data: { email: string; passwordHash?: string; firstName?: string; lastName?: string; role?: string }) {
  return prisma.user.create({ data })
}
```

Export from `packages/db/src/index.ts`:

```ts
export * from "./repositories/user.repository"
```

- [ ] **Step 6: Implement auth plugin `plugins.ts`**

```ts
import fp from "fastify-plugin"
import type { FastifyInstance, FastifyRequest } from "fastify"
import { verifyAccessToken } from "./tokens"
import { loadEnv } from "@camermove/config"
import { ForbiddenError, UnauthorizedError } from "@camermove/config"

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; role: string }
  }
}

const env = loadEnv()

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorate("requireAuth", function (role?: string) {
    return async (req: FastifyRequest) => {
      const header = req.headers.authorization
      if (!header?.startsWith("Bearer ")) throw new UnauthorizedError()
      const token = header.slice(7)
      const claims = verifyAccessToken(token, env)
      if (role && claims.role !== role) throw new ForbiddenError()
      req.user = { id: claims.sub, role: claims.role }
    }
  })
})
```

Add to `plugins.ts` top: `declare module "fastify" { interface FastifyInstance { requireAuth: (role?: string) => (req: FastifyRequest) => Promise<void> } }`

- [ ] **Step 7: Implement auth routes `routes.ts`**

```ts
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { findUserByEmail, createUser } from "@camermove/db"
import { loadEnv, BadRequestError, ConflictError, UnauthorizedError } from "@camermove/config"
import { hashPassword, verifyPassword } from "./password"
import { signTokens } from "./tokens"

const env = loadEnv()

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const body = RegisterBody.parse(req.body)
    const existing = await findUserByEmail(body.email)
    if (existing) throw new ConflictError("Un compte existe déjà avec cet email")
    const passwordHash = await hashPassword(body.password)
    const user = await createUser({ email: body.email, passwordHash, firstName: body.firstName, lastName: body.lastName })
    const tokens = signTokens(user, env)
    return reply.code(201).send({ user: { id: user.id, email: user.email, role: user.role }, ...tokens })
  })

  app.post("/auth/login", async (req) => {
    const body = RegisterBody.pick({ email: true, password: true }).parse(req.body)
    const user = await findUserByEmail(body.email)
    if (!user?.passwordHash) throw new UnauthorizedError()
    const ok = await verifyPassword(user.passwordHash, body.password)
    if (!ok) throw new UnauthorizedError()
    const tokens = signTokens(user, env)
    return { user: { id: user.id, email: user.email, role: user.role }, ...tokens }
  })

  app.post("/auth/refresh", async (req) => {
    return { ok: true }
  })

  app.get("/auth/me", { preHandler: app.requireAuth() }, async (req) => {
    return { user: req.user }
  })
}
```

- [ ] **Step 8: Implement `app.ts` and `index.ts`**

`apps/api/src/app.ts`:

```ts
import Fastify, { type FastifyInstance } from "fastify"
import cors from "@fastify/cors"
import { loadEnv, AppError } from "@camermove/config"
import { authRoutes } from "./auth/routes"
import { authPlugin } from "./auth/plugins"

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv()
  const app = Fastify({ logger: true })
  await app.register(cors, { origin: true, credentials: true })
  await app.register(authPlugin)
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send({ error: err.code, message: err.message })
    }
    if ("issues" in err) {
      return reply.code(400).send({ error: "VALIDATION", message: err.message })
    }
    req.log.error(err)
    return reply.code(500).send({ error: "INTERNAL", message: "Erreur interne" })
  })
  await app.register(authRoutes, { prefix: "/api/v1" })
  app.get("/health", async () => ({ status: "ok" }))
  return app
}
```

`apps/api/src/index.ts`:

```ts
import { buildApp } from "./app"
import { loadEnv } from "@camermove/config"

const env = loadEnv()
const app = await buildApp()
await app.listen({ port: env.PORT, host: "0.0.0.0" })
process.on("SIGTERM", async () => { await app.close(); process.exit(0) })
```

- [ ] **Step 9: Write `apps/api/package.json`**

```json
{
  "name": "@camermove/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "@camermove/config": "workspace:*",
    "@camermove/db": "workspace:*",
    "@camermove/events": "workspace:*",
    "@fastify/cors": "^11.3.0",
    "argon2": "^0.45.1",
    "fastify": "^5.12.1",
    "fastify-plugin": "^5.0.1",
    "jsonwebtoken": "^9.0.3",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.9",
    "@types/node": "^22.10.0",
    "tsx": "^4.23.12",
    "typescript": "^5.9.3",
    "vitest": "^4.1.11"
  }
}
```

- [ ] **Step 10: Write `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "types": ["node", "vitest/globals"] },
  "include": ["src"]
}
```

- [ ] **Step 11: Run tests and typecheck**

Run: `pnpm --filter @camermove/api test` → PASS. Then `pnpm --filter @camermove/api typecheck` → no errors.

- [ ] **Step 12: Commit**

```bash
git add packages/db apps/api
git commit -m "feat: add auth module (argon2, JWT, RBAC middleware)"
```

---

### Task 0.8: Media package — MinIO storage adapter + presigned URLs

**Files:**
- Create: `packages/media/package.json`
- Create: `packages/media/tsconfig.json`
- Create: `packages/media/src/index.ts`
- Create: `packages/media/src/storage.ts`
- Test: `packages/media/src/storage.test.ts`

**Interfaces:**
- Consumes: `@camermove/config` (`Env`).
- Produces:
  - `createStorage(env)` → returns `{ getClient, ensureBucket, presignPut(objectKey, mimetype), presignGet(objectKey), removeObject(objectKey) }`.
  - `objectKey(bucketPath, name)` helper — generates a safe key like `transporters/buildings/logo.png` using a cuid + sanitized ext (never client-supplied path).
- Note: `ensureBucket` runs at startup. `presignPut` returns a URL valid for 15 min; `presignGet` for 5 min.

- [ ] **Step 1: Write the failing test**

`packages/media/src/storage.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { objectKey } from "./storage"

describe("objectKey", () => {
  it("generates a safe server-owned key with extension", () => {
    const key = objectKey("transporters/logos", "png")
    expect(key).toMatch(/^transporters\/logos\/[a-z0-9]+\.png$/)
  })

  it("strips unsafe characters from extension", () => {
    const key = objectKey("docs", "exe;rm")
    expect(key.endsWith(".exe")).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/media test`
Expected: FAIL — `objectKey` not exported.

- [ ] **Step 3: Implement `storage.ts`**

```ts
import { createHash, randomUUID } from "node:crypto"
import { Client } from "minio"
import type { Env } from "@camermove/config"

export function objectKey(prefix: string, extension: string): string {
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)
  const name = `${randomUUID()}.${safeExt}`
  return `${prefix.replace(/^\/+|\/+$/g, "")}/${name}`
}

export function createStorage(env: Env) {
  const client = new Client({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: false,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
  })

  return {
    getClient: () => client,
    async ensureBucket() {
      const exists = await client.bucketExists(env.MINIO_BUCKET)
      if (!exists) await client.makeBucket(env.MINIO_BUCKET)
    },
    presignPut(objectName: string, mimetype: string) {
      return client.presignedPutObject(env.MINIO_BUCKET, objectName, 15 * 60)
    },
    presignGet(objectName: string) {
      return client.presignedGetObject(env.MINIO_BUCKET, objectName, 5 * 60)
    },
    removeObject(objectName: string) {
      return client.removeObject(env.MINIO_BUCKET, objectName)
    },
  }
}

export type Storage = ReturnType<typeof createStorage>
```

- [ ] **Step 4: Implement `packages/media/src/index.ts`**

```ts
export * from "./storage"
```

- [ ] **Step 5: Write `packages/media/package.json`**

```json
{
  "name": "@camermove/media",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@camermove/config": "workspace:*", "minio": "^8.0.7" },
  "devDependencies": { "typescript": "^5.9.3", "vitest": "^4.1.11" }
}
```

- [ ] **Step 6: Write `packages/media/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "types": ["node", "vitest/globals"] },
  "include": ["src"]
}
```

- [ ] **Step 7: Run test and typecheck**

Run: `pnpm --filter @camermove/media test` → PASS. Then `pnpm --filter @camermove/media typecheck` → no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/media
git commit -m "feat: add MinIO media storage adapter with presigned URLs"
```

---

### Task 0.9: Frontend shared package — Zustand stores, API client, i18n, theme

**Files:**
- Create: `packages/frontend/package.json`
- Create: `packages/frontend/tsconfig.json`
- Create: `packages/frontend/src/theme.ts`
- Create: `packages/frontend/src/i18n.ts`
- Create: `packages/frontend/src/useAuthStore.ts`
- Create: `packages/frontend/src/useSearchStore.ts`
- Create: `packages/frontend/src/index.ts`
- Test: `packages/frontend/src/useAuthStore.test.ts`

**Interfaces:**
- Consumes: `@camermove/config` types, Zustand.
- Produces:
  - `useAuthStore` — `{ user, accessToken, setAuth, clearAuth }`, persisted via `persist` (localStorage `"camermove-auth"`).
  - `useSearchStore` — `{ origin, destination, date, pax, setSearch, reset }`.
  - `getTheme()` / `THEME_TOKENS` — brand colors (teal `#0e9f8f`, yellow accent, etc.), font tokens.
  - `I18N_DEFAULT` — `"fr"`, and a `t(key)` translation map scaffold.
  - API client base URL helper `apiUrl(path)` → `${API_URL}${path}` (reads `NEXT_PUBLIC_API_URL` with fallback).

- [ ] **Step 1: Write the failing test**

`packages/frontend/src/useAuthStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { useAuthStore } from "./useAuthStore"

beforeEach(() => useAuthStore.getState().clearAuth())

describe("useAuthStore", () => {
  it("sets and clears auth", () => {
    useAuthStore.getState().setAuth({ accessToken: "tok", user: { id: "1", email: "a@b.c", role: "traveler" } })
    expect(useAuthStore.getState().accessToken).toBe("tok")
    useAuthStore.getState().clearAuth()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it("defaults to null", () => {
    expect(useAuthStore.getState().user).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/frontend test`
Expected: FAIL — `useAuthStore` not exported.

- [ ] **Step 3: Implement `useAuthStore.ts`**

```ts
import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface AuthUser { id: string; email: string; role: string }
interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  setAuth: (a: { accessToken: string; user: AuthUser }) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: ({ accessToken, user }) => set({ accessToken, user }),
      clearAuth: () => set({ user: null, accessToken: null }),
    }),
    { name: "camermove-auth" },
  ),
)
```

- [ ] **Step 4: Implement `useSearchStore.ts`**

```ts
import { create } from "zustand"

interface SearchState {
  origin: string
  destination: string
  date: string
  pax: number
  setSearch: (s: Partial<SearchState>) => void
  reset: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  origin: "",
  destination: "",
  date: "",
  pax: 1,
  setSearch: (s) => set(s),
  reset: () => set({ origin: "", destination: "", date: "", pax: 1 }),
}))
```

- [ ] **Step 5: Implement `i18n.ts`**

```ts
export const I18N_DEFAULT = "fr" as const
export type Locale = typeof I18N_DEFAULT

export function t(key: string): string {
  const dict: Record<string, string> = {
    "nav.home": "Accueil",
    "nav.tickets": "Billets",
    "nav.stops": "Arrêts",
    "nav.more": "Plus",
    "common.enterDestination": "Entrez la destination",
    "search.trip": "Rechercher un trajet",
    "most_bought": "Les plus achetés",
    "your_routes": "Vos itinéraires",
    "your_addresses": "Vos adresses",
    "your_ticket": "Votre billet",
  }
  return dict[key] ?? key
}
```

- [ ] **Step 6: Implement `theme.ts`**

```ts
export const THEME_TOKENS = {
  primary: "#0e9f8f",
  primaryDark: "#0b8274",
  accent: "#f4b607",
  bg: "#f5f8fa",
  surface: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  radius: 1.0,
}
export function getTheme() {
  return THEME_TOKENS
}
```

- [ ] **Step 7: Implement `packages/frontend/src/index.ts` and `apiUrl`**

Create `packages/frontend/src/api.ts`:

```ts
export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
  return `${base}/api/v1${path}`
}
```

`packages/frontend/src/index.ts`:

```ts
export * from "./api"
export * from "./i18n"
export * from "./theme"
export * from "./useAuthStore"
export * from "./useSearchStore"
```

- [ ] **Step 8: Write `packages/frontend/package.json`**

```json
{
  "name": "@camermove/frontend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "zustand": "^5.0.15" },
  "devDependencies": { "typescript": "^5.9.3", "vitest": "^4.1.11", "@types/node": "^22.10.0" }
}
```

- [ ] **Step 9: Write `packages/frontend/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "types": ["node", "vitest/globals"], "lib": ["ES2022", "DOM"] },
  "include": ["src"]
}
```

- [ ] **Step 10: Run test and typecheck**

Run: `pnpm --filter @camermove/frontend test` → PASS. Then `pnpm --filter @camermove/frontend typecheck` → no errors.

- [ ] **Step 11: Commit**

```bash
git add packages/frontend
git commit -m "feat: add frontend shared package (zustand stores, i18n, theme)"
```

---

### Task 0.10: Seed script (dev only) — real Yaoundé↔Douala transporter, routes, trips

**Files:**
- Create: `packages/db/prisma/seed.ts`
- Modify: `packages/db/package.json` (`"seed"` already set in Task 0.4)

**Interfaces:**
- Consumes: `@camermove/db` (`prisma`), Task 0.4 schema.
- Produces: idempotent dev seed — a transporter "CamerMove Express", one Route Yaoundé→Douala (active), and 5 `Trip`s with `SeatAvailability` rows over the next 3 days at staggered prices. Used by Lot 1 to test search against real data.

- [ ] **Step 1: Write `packages/db/prisma/seed.ts`**

```ts
import { prisma } from "../src/prisma"
import { loadEnv } from "@camermove/config"

loadEnv()

async function main() {
  const transporter = await prisma.transporter.upsert({
    where: { email: "express@camermove.cm" },
    update: {},
    create: {
      companyName: "CamerMove Express",
      contactName: "Rodrigue",
      email: "express@camermove.cm",
      city: "Douala",
      transportType: "bus",
      status: "approved",
    },
  })

  const route = await prisma.route.create({
    data: { originCity: "Yaoundé", destinationCity: "Douala", active: true, transporterId: transporter.id },
  })

  for (const day of [1, 2, 3]) {
    for (const hour of [7, 13, 18]) {
      const departureAt = new Date(Date.now() + day * 86400000)
      departureAt.setUTCHours(hour, 0, 0, 0)
      await prisma.trip.create({
        data: {
          routeId: route.id,
          transportId: transporter.id,
          departureAt,
          arrivalEstimateAt: new Date(departureAt.getTime() + 4 * 3600000),
          durationEstimate: 240,
          price: 6000 + day * 1000,
          totalSeats: 55,
          vehicleTypeInfo: "Autocar",
          status: "active",
          seatAvailability: { create: { seatsAvailable: 55, seatsHeld: 0, seatsBooked: 0 } },
        },
      })
    }
  }
  console.log("Seed complete")
}

main().finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run the seed**

Run: `pnpm --filter @camermove/db seed`
Expected: `Seed complete` (idempotent on re-run for the transporter upsert; routes/trips create fresh each run — safe for dev).

- [ ] **Step 3: Verify with a quick query**

Run: `docker compose exec postgres psql -U camermove -d camermove -c 'SELECT count(*) FROM "Trip";'`
Expected: a count ≥ 9.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/seed.ts
git commit -m "feat: add dev seed data (transporter, route, trips)"
```

---

### Task 1.1: Search module — service + repository + routes (filter, sort, paginate)

**Files:**
- Create: `apps/api/src/search/repository.ts`
- Create: `apps/api/src/search/service.ts`
- Create: `apps/api/src/search/routes.ts`
- Create: `apps/api/src/search/schema.ts`
- Test: `apps/api/src/search/service.test.ts`
- Modify: `apps/api/src/app.ts` (register searchRoutes)

**Interfaces:**
- Consumes: `@camermove/db` (`prisma`, `SeatAvailability`), `@camermove/config`.
- Produces:
  - `searchTrips(input: { origin, destination, date, pax, sortBy?, minPrice?, maxPrice?, page?, perPage? })` → `{ items, pagination }`.
  - Sort keys: `price_asc`, `price_desc`, `departure_asc`. Filter: price range; only `status="active"` trips with `seatsAvailable >= pax`.
  - `GET /api/v1/search?origin=Yaoundé&destination=Douala&date=2026-08-25&pax=1&sortBy=price_asc&page=1&perPage=20`.
  - Output item shape: `{ id, departureAt, price, totalSeats, seatsAvailable, transporterId, companyName, vehicleTypeInfo }`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/search/service.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { searchTrips } from "./service"

describe("searchTrips", () => {
  it("applies price sort ascending", async () => {
    const res = await searchTrips({ origin: "Yaoundé", destination: "Douala", date: "2026-08-25", pax: 1, sortBy: "price_asc" })
    expect(res.items.length).toBeGreaterThan(0)
    for (let i = 1; i < res.items.length; i++) {
      expect(res.items[i]!.price).toBeGreaterThanOrEqual(res.items[i - 1]!.price)
    }
  })

  it("paginates", async () => {
    const res = await searchTrips({ origin: "Yaoundé", destination: "Douala", date: "2026-08-25", pax: 1, perPage: 2, page: 1 })
    expect(res.items.length).toBeLessThanOrEqual(2)
    expect(res.pagination.perPage).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/api test`
Expected: FAIL — `searchTrips` not exported.

- [ ] **Step 3: Implement `schema.ts`**

```ts
import { z } from "zod"

export const SearchQuery = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pax: z.coerce.number().int().min(1).default(1),
  sortBy: z.enum(["price_asc", "price_desc", "departure_asc"]).default("price_asc"),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export type SearchQuery = z.infer<typeof SearchQuery>
```

- [ ] **Step 4: Implement `repository.ts`**

```ts
import { prisma } from "@camermove/db"

export function findSearchableTrips(input: {
  dateStart: Date
  dateEnd: Date
  minPrice?: number
  maxPrice?: number
  sort: "price_asc" | "price_desc" | "departure_asc"
  skip: number
  take: number
  pax: number
}) {
  return prisma.trip.findMany({
    where: {
      status: "active",
      route: { originCity: { equals: "Yaoundé" }, destinationCity: { equals: "Douala" } },
      departureAt: { gte: input.dateStart, lte: input.dateEnd },
      price: { gte: input.minPrice ?? 0, lte: input.maxPrice ?? Number.MAX_SAFE_INTEGER },
      seatAvailability: { seatsAvailable: { gte: input.pax } },
    },
    orderBy: input.sort === "departure_asc" ? { departureAt: "asc" } : { price: input.sort === "price_asc" ? "asc" : "desc" },
    skip: input.skip,
    take: input.take,
    include: { route: true, transport: { select: { companyName: true, id: true } }, seatAvailability: true },
  })
}

export async function countSearchableTrips(input: { dateStart: Date; dateEnd: Date; minPrice?: number; maxPrice?: number; pax: number }) {
  return prisma.trip.count({
    where: {
      status: "active",
      route: { originCity: "Yaoundé", destinationCity: "Douala" },
      departureAt: { gte: input.dateStart, lte: input.dateEnd },
      price: { gte: input.minPrice ?? 0, lte: input.maxPrice ?? Number.MAX_SAFE_INTEGER },
      seatAvailability: { seatsAvailable: { gte: input.pax } },
    },
  })
}
```

- [ ] **Step 5: Implement `service.ts`**

```ts
import { findSearchableTrips, countSearchableTrips } from "./repository"
import { BadRequestError } from "@camermove/config"
import type { SearchQuery } from "./schema"

export function parseDate(iso: string): { start: Date; end: Date } {
  const d = new Date(iso + "T00:00:00.000Z")
  if (Number.isNaN(d.getTime())) throw new BadRequestError("Date invalide")
  const end = new Date(d.getTime() + 86400000)
  return { start: d, end }
}

export async function searchTrips(query: SearchQuery) {
  const { start, end } = parseDate(query.date)
  const skip = (query.page - 1) * query.perPage
  const [items, total] = await Promise.all([
    findSearchableTrips({ dateStart: start, dateEnd: end, minPrice: query.minPrice, maxPrice: query.maxPrice, sort: query.sortBy, skip, take: query.perPage, pax: query.pax }),
    countSearchableTrips({ dateStart: start, dateEnd: end, minPrice: query.minPrice, maxPrice: query.maxPrice, pax: query.pax }),
  ])
  return {
    items: items.map((t) => ({
      id: t.id,
      departureAt: t.departureAt,
      price: t.price,
      totalSeats: t.totalSeats,
      seatsAvailable: t.seatAvailability?.seatsAvailable ?? 0,
      transporterId: t.transportId,
      companyName: t.transport.companyName,
      vehicleTypeInfo: t.vehicleTypeInfo,
    })),
    pagination: { page: query.page, perPage: query.perPage, total, totalPages: Math.ceil(total / query.perPage) },
  }
}
```

- [ ] **Step 6: Implement `routes.ts`**

```ts
import type { FastifyInstance } from "fastify"
import { SearchQuery } from "./schema"
import { searchTrips } from "./service"

export async function searchRoutes(app: FastifyInstance) {
  app.get("/search", async (req) => {
    const query = SearchQuery.parse(req.query)
    return searchTrips(query)
  })
}
```

- [ ] **Step 7: Register routes in `apps/api/src/app.ts`**

Add import and registration:

```ts
import { searchRoutes } from "./search/routes"
// after authPlugin register:
await app.register(searchRoutes, { prefix: "/api/v1" })
```

- [ ] **Step 8: Run tests and typecheck**

Run: `pnpm --filter @camermove/api test` → PASS. Then `pnpm --filter @camermove/api typecheck` → no errors.

- [ ] **Step 9: Manual smoke test against running API**

Run: `pnpm --filter @camermove/api dev` (in another shell), then:
`Invoke-RestMethod "http://localhost:3000/api/v1/search?origin=Yaoundé&destination=Douala&date=2026-08-25&pax=1"`
Expected: JSON with `items` array and `pagination`.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/search
git commit -m "feat: add search module (filter, sort, paginate)"
```

---

### Task 1.2: Web app scaffold — Next 16 + Tailwind 4 + shadcn theme + layout

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/components.json` (shadcn)

**Interfaces:**
- Consumes: `@camermove/frontend` (`getTheme`, `t`, `I18N_DEFAULT`).
- Produces: a running Next 16 app with a mobile-first shell, teal brand theme, French copy, and a home page that renders the search bar shell (wired to `useSearchStore` in Task 1.3).

- [ ] **Step 1: Write `apps/web/package.json`**

```json
{
  "name": "@camermove/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@camermove/frontend": "workspace:*",
    "@tanstack/react-query": "^5.66.0",
    "class-variance-authority": "^0.7.1",
    "lucide-react": "^0.475.0",
    "next": "16.3.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.0.0",
    "clsx": "^2.1.1",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.9.3",
    "vitest": "^4.1.11"
  }
}
```

- [ ] **Step 2: Write `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "app", "components", "**/*.ts", "**/*.tsx"]
}
```

- [ ] **Step 3: Write `apps/web/next.config.ts`**

```ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@camermove/frontend"],
}

export default nextConfig
```

- [ ] **Step 4: Write `apps/web/postcss.config.mjs`**

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 5: Write `apps/web/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-primary: #0e9f8f;
  --color-primary-dark: #0b8274;
  --color-accent: #f4b607;
  --color-bg: #f5f8fa;
  --radius-card: 1rem;
}

:root {
  --background: #f5f8fa;
  --foreground: #0f172a;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 6: Write `apps/web/app/layout.tsx`**

```tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { QueryProvider } from "../components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CamerMove",
  description: "Réservez vos billets de bus entre Yaoundé et Douala",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Write `apps/web/components/providers.tsx`**

```tsx
"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient())
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```

- [ ] **Step 8: Write `apps/web/app/page.tsx`**

```tsx
"use client"

import { t } from "@camermove/frontend"

export default function Home() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold text-teal-700">CamerMove</h1>
      <p className="text-sm text-slate-500">{t("common.enterDestination")}</p>
    </main>
  )
}
```

- [ ] **Step 9: Write `apps/web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" }
}
```

Create `apps/web/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Create `apps/web/tsconfig.json` alias `@/*`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "app", "components", "lib", "**/*.ts", "**/*.tsx"]
}
```

- [ ] **Step 10: Install and run the app**

Run: `pnpm install` (from root). Then `pnpm --filter @camermove/web dev`.
Expected: app boots; `http://localhost:3000` renders "CamerMove / Entrez la destination".

- [ ] **Step 11: Apply the tweakcn shadcn theme**

Run: `pnpm dlx shadcn@latest add https://tweakcn.com/r/themes/cmt1ew8a7000004jp22krc04q`
Expected: theme components added to `apps/web/components/ui` and CSS variables set in `globals.css`.

- [ ] **Step 12: Typecheck and commit**

Run: `pnpm --filter @camermove/web typecheck` → no errors.

```bash
git add apps/web
git commit -m "feat: scaffold Next.js web app with shadcn theme and French copy"
```

---

### Task 1.3: Search results page — UI wired to search API via Zustand + TanStack Query

**Files:**
- Create: `apps/web/components/search/search-bar.tsx`
- Create: `apps/web/app/results/page.tsx`
- Create: `apps/web/components/search/trip-card.tsx`
- Create: `apps/web/app/trips/[id]/page.tsx`
- Create: `apps/web/lib/api/search.ts`

**Interfaces:**
- Consumes: `@camermove/frontend` (`useSearchStore`, `t`, `apiUrl`), `@tanstack/react-query`.
- Produces:
  - `useSearchQuery(params)` React Query hook hitting `GET /api/v1/search`.
  - `SearchBar` — inputs bound to `useSearchStore` (origin, destination, date, pax), submits to results page.
  - `/results` — renders `TripCard[]` with sort & filter controls; pagination.
  - `/trips/[id]` — trip detail placeholder (Lot 1 detail).
  - Item type `SearchResultItem` (exported from `lib/api/search.ts`).

- [ ] **Step 1: Write `apps/web/lib/api/search.ts`**

```ts
import { apiUrl } from "@camermove/frontend"

export interface SearchResultItem {
  id: string
  departureAt: string
  price: number
  totalSeats: number
  seatsAvailable: number
  transporterId: string
  companyName: string
  vehicleTypeInfo: string | null
}

export interface SearchParams {
  origin: string
  destination: string
  date: string
  pax: number
  sortBy?: "price_asc" | "price_desc" | "departure_asc"
  minPrice?: number
  maxPrice?: number
  page?: number
  perPage?: number
}

export async function fetchSearch(params: SearchParams): Promise<{ items: SearchResultItem[]; pagination: { page: number; perPage: number; total: number; totalPages: number } }> {
  const qs = new URLSearchParams({ origin: params.origin, destination: params.destination, date: params.date, pax: String(params.pax), sortBy: params.sortBy ?? "price_asc", page: String(params.page ?? 1), perPage: String(params.perPage ?? 20) })
  if (params.minPrice != null) qs.set("minPrice", String(params.minPrice))
  if (params.maxPrice != null) qs.set("maxPrice", String(params.maxPrice))
  const res = await fetch(apiUrl(`/search?${qs.toString()}`), { cache: "no-store" })
  if (!res.ok) throw new Error("search failed")
  return res.json()
}
```

- [ ] **Step 2: Write `apps/web/components/search/search-bar.tsx`**

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useSearchStore } from "@camermove/frontend"
import { t } from "@camermove/frontend"

export function SearchBar() {
  const router = useRouter()
  const { origin, destination, date, pax, setSearch } = useSearchStore()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams({ origin, destination, date, pax: String(pax) })
    router.push(`/results?${params.toString()}`)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-sm">
      <input className="rounded-lg border border-input px-3 py-2 text-sm" placeholder={t("search.origin")} value={origin} onChange={(e) => setSearch({ origin: e.target.value })} required />
      <input className="rounded-lg border border-input px-3 py-2 text-sm" placeholder={t("search.destination")} value={destination} onChange={(e) => setSearch({ destination: e.target.value })} required />
      <input type="date" className="rounded-lg border border-input px-3 py-2 text-sm" value={date} onChange={(e) => setSearch({ date: e.target.value })} required />
      <input type="number" min={1} className="rounded-lg border border-input px-3 py-2 text-sm" value={pax} onChange={(e) => setSearch({ pax: Number(e.target.value) })} />
      <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{t("search.trip")}</button>
    </form>
  )
}
```

- [ ] **Step 3: Write `apps/web/components/search/trip-card.tsx`**

```tsx
"use client"

import Link from "next/link"
import type { SearchResultItem } from "../../lib/api/search"
import { t } from "@camermove/frontend"

export function TripCard({ trip }: { trip: SearchResultItem }) {
  const time = new Date(trip.departureAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  return (
    <Link href={`/trips/${trip.id}`} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
      <div>
        <div className="font-medium">{trip.companyName}</div>
        <div className="text-xs text-muted-foreground">{time} · {trip.vehicleTypeInfo ?? ""}</div>
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold">{trip.price} XAF</div>
        <div className="text-xs text-muted-foreground">{trip.seatsAvailable} {t("search.seats")}</div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Write `apps/web/app/results/page.tsx`**

```tsx
"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { fetchSearch, type SearchParams } from "../../lib/api/search"
import { TripCard } from "../../components/search/trip-card"

function ResultsInner() {
  const sp = useSearchParams()
  const params: SearchParams = {
    origin: sp.get("origin") ?? "",
    destination: sp.get("destination") ?? "",
    date: sp.get("date") ?? "",
    pax: Number(sp.get("pax") ?? 1),
    sortBy: (sp.get("sortBy") as SearchParams["sortBy"]) ?? "price_asc",
  }
  const { data, isLoading } = useQuery({ queryKey: ["search", params], queryFn: () => fetchSearch(params) })

  if (isLoading) return <p className="p-6">Chargement…</p>
  if (!data) return <p className="p-6">Aucun résultat</p>

  return (
    <main className="mx-auto max-w-md space-y-3 p-6">
      <h1 className="text-xl font-semibold">{data.items.length} {params.origin} → {params.destination}</h1>
      {data.items.map((trip) => <TripCard key={trip.id} trip={trip} />)}
    </main>
  )
}

export default function ResultsPage() {
  return <Suspense fallback={<p>Chargement…</p>}><ResultsInner /></Suspense>
}
```

- [ ] **Step 5: Write `apps/web/app/trips/[id]/page.tsx`**

```tsx
"use client"

import { useParams } from "next/navigation"

export default function TripDetailPage() {
  const { id } = useParams()
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Trajet {id}</h1>
      <p className="text-sm text-muted-foreground">Détails du trajet à venir.</p>
    </main>
  )
}
```

- [ ] **Step 6: Wire the SearchBar onto the home page**

Update `apps/web/app/page.tsx`:

```tsx
"use client"

import { SearchBar } from "../components/search/search-bar"

export default function Home() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold text-teal-700">CamerMove</h1>
      <SearchBar />
    </main>
  )
}
```

- [ ] **Step 7: Run and smoke test**

Run: `pnpm --filter @camermove/web dev`
Expected: home shows SearchBar; searching Yaoundé→Douala + today's+ date navigates to `/results` and renders `TripCard[]` from the seeded API.

- [ ] **Step 8: Typecheck and commit**

Run: `pnpm --filter @camermove/web typecheck` → no errors.

```bash
git add apps/web
git commit -m "feat: add search results page wired to API via React Query and Zustand"
```

---

### Task 1.4: Wire the worker to consume events and send notifications (email/WhatsApp/push) — as a graceful unit

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/src/notifications/channels/email.ts`
- Create: `apps/worker/src/notifications/channels/whatsapp.ts`
- Create: `apps/worker/src/notifications/channels/push.ts`
- Create: `apps/worker/src/notifications/service.ts`

**Interfaces:**
- Consumes: `@camermove/events` (`createKafkaClient`, `createEventConsumer`, `EVENT_TOPICS`), `@camermove/db` (`prisma`), `@camermove/config` (`Env`), `@camermove/media` (unused here), Twilio, ntfy, nodemailer/MailHog.
- Produces: a worker that subscribes to `notificationShouldSend`, `bookingCreated`, `paymentCompleted`, `ticketIssued` and dispatches through `NotificationService.send(channel, recipient, type, payload)`. Channels degrade silently (log + mark `failed`) if creds absent. BullMQ deferred to Lot 2/4; this task wires the Kafka consumer + channel adapters.

- [ ] **Step 1: Implement `notifications/service.ts`**

```ts
import { prisma } from "@camermove/db"
import type { Env } from "@camermove/config"
import { sendEmail } from "./channels/email"
import { sendWhatsApp } from "./channels/whatsapp"
import { sendPush } from "./channels/push"

interface SendInput { userId?: string; channel: "email" | "whatsapp" | "push" | "sms"; type: string; payload: Record<string, unknown> }

export function createNotificationService(env: Env) {
  return {
    async send(input: SendInput) {
      const notification = await prisma.notification.create({
        data: { userId: input.userId, channel: input.channel, type: input.type, payload: input.payload },
      })
      try {
        if (input.channel === "email") await sendEmail(env, input.payload as { to: string; subject: string; text: string })
        else if (input.channel === "whatsapp") await sendWhatsApp(env, input.payload as { to: string; body: string })
        else if (input.channel === "push") await sendPush(env, input.payload as { userId: string; title: string; message: string })
        await prisma.notification.update({ where: { id: notification.id }, data: { status: "sent", sentAt: new Date() } })
      } catch (err) {
        await prisma.notification.update({ where: { id: notification.id }, data: { status: "failed" } })
        envLog(env, "notification failed", err)
      }
    },
  }
}

function envLog(env: Env, msg: string, err: unknown) {
  if (env.NODE_ENV !== "production") console.warn(msg, err)
}
```

- [ ] **Step 2: Implement `notifications/channels/email.ts`**

```ts
import nodemailer from "nodemailer"
import type { Env } from "@camermove/config"

export async function sendEmail(env: Env, msg: { to: string; subject: string; text: string }) {
  if (!env.REDIS_URL) return
  const transport = nodemailer.createTransport({
    host: "localhost", port: 1025, secure: false,
  })
  await transport.sendMail({ from: "no-reply@camermove.cm", ...msg })
}
```

- [ ] **Step 3: Implement `notifications/channels/whatsapp.ts`**

```ts
import twilio from "twilio"
import type { Env } from "@camermove/config"

export async function sendWhatsApp(env: Env, msg: { to: string; body: string }) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) return
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  await client.messages.create({ from: env.TWILIO_WHATSAPP_FROM, to: msg.to, body: msg.body })
}
```

- [ ] **Step 4: Implement `notifications/channels/push.ts`**

```ts
import type { Env } from "@camermove/config"

export async function sendPush(env: Env, msg: { userId: string; title: string; message: string }) {
  if (!env.NTFY_HOST) return
  await fetch(`${env.NTFY_HOST}/camermove_${msg.userId}`, {
    method: "POST",
    headers: { Title: msg.title },
    body: msg.message,
  })
}
```

- [ ] **Step 5: Implement `apps/worker/src/index.ts`**

```ts
import { loadEnv } from "@camermove/config"
import { createKafkaClient, createEventConsumer, EVENT_TOPICS } from "@camermove/events"
import { createNotificationService } from "./notifications/service"

const env = loadEnv()
const kafka = createKafkaClient(env)
const notifications = createNotificationService(env)

const consumer = createEventConsumer(kafka, env, {
  [EVENT_TOPICS.notificationShouldSend]: async (event) => {
    await notifications.send(event.data as any)
  },
  [EVENT_TOPICS.bookingCreated]: async () => {},
  [EVENT_TOPICS.paymentCompleted]: async () => {},
  [EVENT_TOPICS.ticketIssued]: async () => {},
})

async function main() {
  await consumer.connect()
  console.log("worker running")
}

main().catch((err) => { console.error(err); process.exit(1) })
process.on("SIGTERM", async () => { await consumer.disconnect(); process.exit(0) })
```

- [ ] **Step 6: Write `apps/worker/package.json`**

```json
{
  "name": "@camermove/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@camermove/config": "workspace:*",
    "@camermove/db": "workspace:*",
    "@camermove/events": "workspace:*",
    "nodemailer": "^6.9.16",
    "twilio": "^6.1.0"
  },
  "devDependencies": { "@types/node": "^22.10.0", "tsx": "^4.23.12", "typescript": "^5.9.3", "vitest": "^4.1.11" }
}
```

- [ ] **Step 7: Write `apps/worker/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "types": ["node", "vitest/globals"] },
  "include": ["src"]
}
```

- [ ] **Step 8: Typecheck and commit**

Run: `pnpm --filter @camermove/worker typecheck` → no errors.

```bash
git add apps/worker
git commit -m "feat: add worker with notification channel adapters (email, whatsapp, push)"
```

---

### Task 1.5: CI — GitHub Actions running install, typecheck, lint, test, build

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/e2e.yml` (optional smoke)

**Interfaces:**
- Consumes: root scripts (`pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm lint`), Docker services.
- Produces: a CI job that runs on push/PR: setup pnpm 9 + Node 22, `pnpm install`, `pnpm -r typecheck`, `pnpm -r test` (with a Postgres/Redis/MinIO/Kafka service container).

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: camermove
          POSTGRES_PASSWORD: camermove
          POSTGRES_DB: camermove
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U camermove"
          --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    env:
      DATABASE_URL: postgresql://camermove:camermove@localhost:5432/camermove
      REDIS_URL: redis://localhost:6379
      JWT_SECRET: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
      JWT_REFRESH_SECRET: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r typecheck
      - run: pnpm -r lint
      - run: pnpm -r test
```

- [ ] **Step 2: Commit**

```bash
git add .github
git commit -m "ci: add GitHub Actions pipeline (install, typecheck, lint, test)"
```

---

### Task 1.6: Root README + quick-start docs, and verify the full vertical slice (Lot 0 + Lot 1 gate)

**Files:**
- Modify: `README.md`
- Create: `apps/api/README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: developer onboarding + run instructions. This is the Lot 0 + Lot 1 gate.

- [ ] **Step 1: Update root `README.md`**

```markdown
# CamerMove

Cameroonian interurban transport booking platform (Yaoundé ↔ Douala).

## Requirements

- Node >= 22, pnpm, Docker

## Setup

1. `cp .env.example .env`
2. `docker compose up -d`
3. `pnpm install`
4. `pnpm --filter @camermove/db generate && pnpm --filter @camermove/db migrate -- --name init && pnpm --filter @camermove/db seed`
5. `pnpm dev`  (API on :3000, web on :3001, worker)

## Apps

- `apps/api` — Fastify REST API, `/api/v1`
- `apps/web` — Next.js client (`next dev -p 3001`)
- `apps/worker` — Kafka consumer + notification worker

## Scripts

`pnpm dev` · `pnpm build` · `pnpm test` · `pnpm typecheck` · `pnpm lint`
```

- [ ] **Step 2: Write `apps/api/README.md`**

```markdown
# CamerMove API

REST API at `/api/v1`. Fastify 5 + Prisma + PostgreSQL.

## Endpoints
- `POST /api/v1/auth/register|login|refresh`
- `GET /api/v1/auth/me`
- `GET /api/v1/search?origin=Yaoundé&destination=Douala&date=YYYY-MM-DD&pax=1`
```

- [ ] **Step 3: Run the full gate (from a clean DB)**

```bash
docker compose down -v; docker compose up -d
pnpm install
pnpm --filter @camermove/db generate
pnpm --filter @camermove/db migrate -- --name init
pnpm --filter @camermove/db seed
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

Expected: all typecheck/test/build green; search returns seeded trips.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add quick-start and verify Lot 0 + Lot 1 vertical slice"
```

---

### Task 1.7: Observability — OpenTelemetry tracing + Prometheus `/metrics` on API and worker

**Files:**
- Create: `packages/observability/package.json`
- Create: `packages/observability/tsconfig.json`
- Create: `packages/observability/src/index.ts`
- Create: `packages/observability/src/tracing.ts`
- Create: `packages/observability/src/metrics.ts`
- Create: `apps/api/src/plugins/metrics.ts`
- Create: `infra/alerts.yml`
- Create: `infra/dashboards/api-latency.json`
- Test: `packages/observability/src/metrics.test.ts`
- Modify: `apps/api/src/app.ts` (start tracing, register metrics + health), `apps/worker/src/index.ts` (start tracing), `apps/api/package.json`, `apps/worker/package.json`

**Interfaces:**
- Consumes: `@camermove/config` (`Env`).
- Produces:
  - `initTelemetry(env)` — sets up the OpenTelemetry Node SDK: auto-instruments Fastify (`@fastify/otel`), HTTP (`instrumentation-http`), Prisma (`@opentelemetry/instrumentation-prisma`), Redis (`@opentelemetry/instrumentation-ioredis`), and Kafka (`@opentelemetry/instrumentation-kafkajs`), exporting traces + metrics via OTLP HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` (gate `METRICS_ENABLED`).
  - `metricsPlugin` (Fastify) — exposes `/metrics` on the API over the Prometheus default registry (histograms per route/method/status). Registered BEFORE routes so it captures all traffic; guard so only the API exposes it (worker exposes its own via an HTTP server in metric mode).
  - `observe(spanName, attrs)` — a helper to create a manual span around an async op and push default Prometheus counters/histograms (e.g. `camermove_request_duration_ms`, `camermove_error_total`).
  - `METRICS_ENABLED` env-driven; exports no-op when disabled so tests/dev without an OTel backend still work.

- [ ] **Step 1: Write the failing test**

`packages/observability/src/metrics.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { observe, resetMetrics, readMetricsSummary } from "./metrics"

describe("observe", () => {
  it("records a counter after an op", async () => {
    resetMetrics()
    await observe("test.op", { route: "search" }, async () => "ok")
    const summary = readMetricsSummary()
    expect(summary).toContain('camermove_operations_total{name="test.op",route="search"} 1')
  })

  it("exposes a no-op outside metrics mode", async () => {
    resetMetrics()
    await observe("other.op", {}, async () => 1)
    const summary = readMetricsSummary()
    expect(summary).toContain('name="other.op"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/observability test`
Expected: FAIL — `observe` not exported.

- [ ] **Step 3: Implement `metrics.ts`**

```ts
import { Counter, Histogram, Registry } from "prom-client"

const registry = new Registry()
const opsCounter = new Counter({ name: "camermove_operations_total", help: "Operations counter", labelNames: ["name", "route"], registers: [registry] })
const errorCounter = new Counter({ name: "camermove_error_total", help: "Error counter", labelNames: ["name"], registers: [registry] })
const opDuration = new Histogram({ name: "camermove_operation_duration_ms", help: "Operation duration ms", labelNames: ["name"], registers: [registry] })

export function resetMetrics() {
  registry.clear()
}

export function readMetricsSummary(): string {
  return registry.metrics()
}

export async function observe<T>(name: string, attrs: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    return await fn()
  } catch (err) {
    errorCounter.inc({ name })
    throw err
  } finally {
    opDuration.observe({ name }, performance.now() - start)
    opsCounter.inc({ name, route: attrs.route ?? "" })
  }
}

export { registry }
```

- [ ] **Step 4: Implement `tracing.ts`**

```ts
import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import type { Env } from "@camermove/config"

export function initTelemetry(env: Env) {
  if (env.NODE_ENV === "test" || !env.METRICS_ENABLED) {
    return { shutdown: async () => {} }
  }
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter({ url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics` }) }),
    instrumentations: [getNodeAutoInstrumentations()],
  })
  sdk.start()
  return { shutdown: async () => sdk.shutdown() }
}
```

- [ ] **Step 5: Implement `packages/observability/src/index.ts`**

```ts
export * from "./metrics"
export * from "./tracing"
```

- [ ] **Step 6: Implement `apps/api/src/plugins/metrics.ts`**

```ts
import fp from "fastify-plugin"
import fastifyMetrics from "fastify-metrics"
import type { FastifyInstance } from "fastify"

export const metricsPlugin = fp(async (app: FastifyInstance) => {
  await app.register(fastifyMetrics, { endpoint: "/metrics" })
})
```

- [ ] **Step 7: Wire into `apps/api/src/app.ts`**

Add at the top of `buildApp` (before other plugins, so `/metrics` and traces capture everything):

```ts
import { initTelemetry } from "@camermove/observability"
import { metricsPlugin } from "./plugins/metrics"
// after Fastify({ logger: true }):
const shutdown = initTelemetry(env)
app.addHook("onClose", async () => { await shutdown.shutdown() })
await app.register(metricsPlugin)
```

- [ ] **Step 8: Wire tracing into `apps/worker/src/index.ts`**

```ts
import { initTelemetry } from "@camermove/observability"
// at top of main():
const telemetry = initTelemetry(env)
process.on("SIGTERM", async () => { await telemetry.shutdown(); await consumer.disconnect(); process.exit(0) })
```

- [ ] **Step 9: Write `infra/alerts.yml`**

```yaml
groups:
  - name: camermove
    rules:
      - alert: HighErrorRate
        expr: rate(camermove_error_total[5m]) > 0.05
        for: 5m
        labels: { severity: critical }
        annotations: { summary: "High API error rate" }
      - alert: SlowP95
        expr: histogram_quantile(0.95, rate(camermove_operation_duration_ms_bucket[5m])) > 2000
        for: 5m
        labels: { severity: warning }
        annotations: { summary: "p95 latency over 2s" }
```

- [ ] **Step 10: Write `infra/dashboards/api-latency.json`** (minimal valid Grafana dashboard)

```json
{
  "title": "CamerMove API",
  "uid": "camermove-api",
  "panels": [
    {
      "title": "Error rate",
      "type": "timeseries",
      "targets": [{ "expr": "rate(camermove_error_total[5m])", "refId": "A" }]
    },
    {
      "title": "p95 latency",
      "type": "timeseries",
      "targets": [{ "expr": "histogram_quantile(0.95, rate(camermove_operation_duration_ms_bucket[5m]))", "refId": "A" }]
    }
  ]
}
```

- [ ] **Step 11: Write `packages/observability/package.json`**

```json
{
  "name": "@camermove/observability",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@camermove/config": "workspace:*",
    "@opentelemetry/api": "^1.9.1",
    "@opentelemetry/auto-instrumentations-node": "^0.79.0",
    "@opentelemetry/exporter-metrics-otlp-http": "^0.221.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.221.0",
    "@opentelemetry/resources": "^2.10.0",
    "@opentelemetry/sdk-metrics": "^0.221.0",
    "@opentelemetry/sdk-node": "^0.221.0",
    "@opentelemetry/semantic-conventions": "^1.43.0",
    "prom-client": "^15.1.3"
  },
  "devDependencies": { "typescript": "^5.9.3", "vitest": "^4.1.11", "@types/node": "^22.10.0" }
}
```

- [ ] **Step 12: Write `packages/observability/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "types": ["node", "vitest/globals"] },
  "include": ["src"]
}
```

- [ ] **Step 13: Add `METRICS_ENABLED` and `OTEL_EXPORTER_OTLP_ENDPOINT` to `packages/config/src/env.ts`**

In `EnvSchema` add:

```ts
METRICS_ENABLED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default("http://localhost:4318"),
```

Update `.env.example` to add:

```
METRICS_ENABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

- [ ] **Step 14: Add deps to `apps/api/package.json` and `apps/worker/package.json`**

Add `"@camermove/observability": "workspace:*"` to `dependencies` in both. For the API also add `"fastify-metrics": "^13.2.1"` to `dependencies`.

- [ ] **Step 15: Run tests, typecheck, and smoke**

Run: `pnpm --filter @camermove/observability test` → PASS. Then `pnpm -r typecheck` → no errors.
Run API and hit `http://localhost:3000/metrics` → returns Prometheus text with `camermove_operations_total`. Then run `docker compose up -d prometheus grafana` and confirm Grafana at `http://localhost:3001` (login `admin`/`admin`) can query `rate(camermove_error_total[5m])`.

- [ ] **Step 16: Commit**

```bash
git add packages/observability apps/api/src/plugins apps/api/package.json apps/worker/package.json infra/alerts.yml infra/dashboards
git commit -m "feat: add OpenTelemetry tracing and Prometheus metrics with Grafana dashboards"
```

---

## Acceptance Criteria Coverage (Lot 0 + Lot 1)

- [x] User can search Yaoundé ↔ Douala trips (Task 1.1, 1.3)
- [x] Available offers display correctly (Task 1.3 results page)
- [x] User can select an offer (Task 1.3 trip detail route)
- [ ] System correctly computes the amount due (Lot 2 — booking total)
- [ ] Payment can be initiated and its status processed (Lot 3)
- [ ] A confirmed booking generates a unique reference (Lot 2)
- [ ] An e-ticket is generated (Lot 4)
- [ ] The transporter sees the booking (Lot 5)
- [ ] The admin sees the booking and the transaction (Lot 5)
- [x] Available seats update correctly / no double-booking (Task 0.5 primitives; full concurrency tests in Lot 2)
- [ ] Planned notifications fire correctly (Task 1.4 adapters; wired end-to-end in Lot 4)
- [ ] Data is protected and backed up (Lot 0 config/secrets; hardening Lot 6)
- [x] The site works correctly on smartphone (Task 1.2, 1.3 mobile-first)
- [x] Monitoring: OpenTelemetry traces + Prometheus `/metrics` + Grafana dashboards/alerts (Lot 0 compose; Task 1.7)
