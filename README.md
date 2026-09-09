# CamerMove

**Plateforme multi-services dédiée à la mobilité, au voyage et aux services associés au Cameroun.**

CamerMove réunit six services autour d'un seul compte : transport interurbain (produit héros), hôtels & appartements, location de véhicules, transport de colis, assurance voyage, billetterie événements. Le tout avec paiement Mobile Money et billet QR.

> Réinventons la mobilité africaine.

## Structure

- `apps/api` — Fastify REST API (toute la logique métier)
- `apps/web` — Next.js 16 client web (React 19, Tailwind v4, shadcn/ui)
- `apps/worker` — Kafka consumer + BullMQ processor
- `apps/worker/trip-reminder` — Job CRON rappels de trajet
- `packages/db` — Prisma + repositories (single data access layer)
- `packages/config` — env Zod-validé (loadEnv)
- `packages/observability` — prom-client + OpenTelemetry
- `packages/events` — Kafka topics + producers
- `packages/media` — MinIO / S3 object storage
- `packages/frontend` — composants UI partagés (web)
- `packages/shared` — math, formatters, money

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind v4, shadcn/ui, GSAP, Lenis, Framer Motion |
| API | Fastify 5, Prisma 6, Postgres 16, ioredis, kafkajs, Zod |
| Async | Kafka 3.7 (events), BullMQ (jobs), Redis 7 (cache / rate limit / idempotency) |
| Storage | MinIO (S3-compatible) |
| Infra | Docker Compose, Prometheus, Grafana, OpenTelemetry |
| Tests | Vitest (unit + integration) |

## Quick Start

```bash
cp .env.example .env
pnpm install
bash scripts/dev-up.sh         # or: .\scripts\dev-up.cmd on PowerShell
```

Le script (idempotent) démarre Postgres/Redis/Kafka/MinIO + lance API/worker/web, applique les migrations, et seed la base si vide. Voir [LAUNCH.md](./LAUNCH.md).

## Comptes de démo (après `pnpm seed`)

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super admin | `super@camermove.cm` | `motdepasse123` |
| Admin | `admin@camermove.cm` | `motdepasse123` |
| Transporteur | `partner@camermove.cm` | `motdepasse123` |
| Voyageur | `traveler@camermove.cm` | `motdepasse123` |

Le seed couvre les six services : 4 transporteurs / 336+ trajets, 6 hôtels, 8 véhicules, 2 opérateurs colis, 5 événements, 5 polices d'assurance, plus les paiements / billets / notifications / audit logs correspondants. Voir [docs/DATABASE.md](./docs/DATABASE.md).

## URLs locales

| Service | URL |
|---------|-----|
| Web (app voyageur) | http://localhost:3002 |
| API | http://localhost:3000 |
| Swagger / OpenAPI | http://localhost:3000/docs |
| Health | http://localhost:3000/health |
| MailHog (emails) | http://localhost:8025 |
| MinIO console | http://localhost:9001 (`minioadmin`/`minioadmin`) |
| Kafka UI | http://localhost:8080 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 (`admin`/`admin`) |

## Design System

Swiss / Bauhaus minimalism. Helvetica-style typography. Cool gray, pure white, natural wood. Hairlines, zero radius, no shadows, numbered section heads.

Voir [docs/DESIGN-SYSTEM.md](./docs/DESIGN-SYSTEM.md) pour les tokens, le grid, la typographie, et les composants. Source de vérité : `apps/web/app/globals.css` (Next.js) + `dist/assets/css/main.css` (static deploy).

## Documentation

- [docs/architecture.md](./docs/architecture.md) — frontières monorepo, runtime flow, invariants
- [docs/DESIGN-SYSTEM.md](./docs/DESIGN-SYSTEM.md) — palette, typo, composants, motion
- [docs/DATABASE.md](./docs/DATABASE.md) — schéma, index, seed, migrations, backups
- [docs/OBSERVABILITY.md](./docs/OBSERVABILITY.md) — Prometheus, Grafana, OpenTelemetry, alertes
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — dev, Docker Compose, production checklist
- [docs/runbook.md](./docs/runbook.md) — local infra, ports, troubleshooting
- [docs/workflows.md](./docs/workflows.md) — diagrammes Mermaid (use-case, séquence, activité)
- [AGENTS.md](./AGENTS.md) — principes d'ingénierie (non-négociables)
- [LAUNCH.md](./LAUNCH.md) — guide de démarrage

## Scripts utiles

```bash
pnpm dev                    # start all
pnpm build                  # production build
pnpm -r typecheck           # 0 errors requis
pnpm -r test                # tests
pnpm seed                   # seed complet 6 services (idempotent)
pnpm smoke                  # smoke tests auth + search
pnpm smoke:auth
pnpm smoke:search
pnpm smoke:tickets
pnpm smoke:dashboard
pnpm swagger:export         # openapi.json
```
