# CamerMove

Cameroonian interurban transport booking platform (Yaoundé ↔ Douala).

## Structure

- `apps/api` — Fastify REST API (all business logic)
- `apps/web` — Next.js 16 web client (React 19, Tailwind v4, shadcn/ui)
- `apps/worker` — Kafka consumer + BullMQ processor
- `packages/*` — shared modules (db, config, media, events, frontend, shared)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind v4, shadcn/ui |
| Animations | GSAP (intro/text reveals), Framer Motion (scroll/hover/layout), Lenis (smooth scroll) |
| API | Fastify, Prisma 6, Postgres |
| Async | Kafka (events), BullMQ (jobs), Redis (cache/rate-limit/idempotency) |
| Storage | MinIO (S3-compatible) |
| Infra | Docker Compose, Prometheus, Grafana |

## Design System

- **Typography:** Plus Jakarta Sans (headings) + Inter (body)
- **Colors:** Warm-neutral palette — teal primary (#0e9f8f), amber accent (#f4b607)
- **Animations:** GSAP for intro/text reveals, Framer Motion for scroll/hover/layout
- **Components:** Button, Card, Input, Modal, Toast, Skeleton — all with micro-interactions

## Quick Start

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm dev
```

Or use the all-in-one script (recommended):

```bash
bash scripts/dev-up.sh
```

See [LAUNCH.md](./LAUNCH.md) for detailed setup instructions.

## Test Credentials

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Admin | admin@camermove.cm | Admin123! | Full admin panel, settings, user management |
| User | user@camermove.cm | User123! | Dashboard, bookings, tickets |
| Partner | partner@camermove.cm | Partner123! | Transporter dashboard, trip management |

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/auth/register | No | Create account |
| POST | /api/v1/auth/login | No | Login, returns JWT |
| POST | /api/v1/auth/refresh | No | Refresh access token |
| GET | /api/v1/auth/me | Yes | Get current user |
| GET | /api/v1/search | No | Search trips |
| POST | /api/v1/bookings | Yes | Create booking |
| GET | /api/v1/bookings | Yes | List user bookings |
| POST | /api/v1/bookings/:id/cancel | Yes | Cancel booking |
| POST | /api/v1/payments | Yes | Initiate payment |
| GET | /api/v1/trips | No | List trips |
| GET | /api/v1/trips/:id | No | Trip detail |
| POST | /api/v1/trips | Admin | Create trip |
| PUT | /api/v1/trips/:id | Admin | Update trip |
| DELETE | /api/v1/trips/:id | Admin | Delete trip |
| GET | /api/v1/tickets/:id | Yes | Get ticket |
| GET | /api/v1/tickets/lookup?code= | No | Lookup ticket (public) |
| POST | /api/v1/partner-applications | Yes | Submit partner application |
| GET | /api/v1/partner-applications/me | Yes | Get own application |
| GET | /api/v1/admin/settings | Admin | Get app settings |
| PUT | /api/v1/admin/settings | Admin | Update settings |
| GET | /api/v1/admin/users | Admin | List users |

## Dev

```bash
pnpm dev              # Start all apps
pnpm -r typecheck     # Typecheck all packages
pnpm -r test          # Run all tests
```

## Documentation

- [LAUNCH.md](./LAUNCH.md) — Local development setup
- [AGENTS.md](./AGENTS.md) — Engineering principles
- [TIXZY_RESEARCH.md](./TIXZY_RESEARCH.md) — Market research
- [docs/superpowers/specs/](./docs/superpowers/specs/) — Design specifications
- [docs/superpowers/plans/](./docs/superpowers/plans/) — Implementation plans
