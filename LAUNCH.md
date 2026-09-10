# CamerMove — Local Launch (Windows)

One command starts everything: Docker infra → migrations → seed-if-empty → API + worker + web.

## Prerequisites

- **Node.js ≥ 22** and **pnpm ≥ 11** (`corepack enable`)
- **Docker Desktop** running
- **Bash** (Git Bash — installed with Git on Windows) and `curl`

## Start

```bash
pnpm install
bash scripts/dev-up.sh
```

The script is **idempotent** — re-running it is always safe. It recreates containers
(all ports are bound to `127.0.0.1` only), waits for Postgres, applies
`prisma migrate deploy`, seeds only if the DB is empty, then launches API/worker/web
detached and polls until each is healthy.

Works from any terminal. On Windows PowerShell / CMD prefer the wrapper (it pins
Git Bash explicitly — the `bash` on PATH is often a WSL stub with no distro):

```powershell
.\scripts\dev-up.cmd          # or:  .\scripts\dev-up.cmd stop
```

From Git Bash or WSL (with docker on PATH): `bash scripts/dev-up.sh`

## URLs

| Service | URL |
|---|---|
| Web (traveler app) | http://localhost:3002 |
| API | http://localhost:3000 |
| Swagger / OpenAPI docs | http://localhost:3000/docs |
| Health check | http://localhost:3000/health |
| MailHog (captured emails) | http://localhost:8025 |
| MinIO console | http://localhost:9001 (`minioadmin` / `minioadmin`) |
| Kafka UI | http://localhost:8080 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 (user `admin`, password `admin` — set in docker-compose.yml) |

## Seeded demo data

Two seeds (both idempotent, safe to re-run):

- **Minimal** (`packages/db/prisma/seed.ts`, `pnpm seed`) — transport only:
  demo users (`admin@`/`user@`/`partner@camermove.cm`), CamerMove Express,
  route Yaoundé → Douala, 9 trips.
- **Rich** (`scripts/seed-rich.ts`, `pnpm seed:rich`) — all six services:
  4 users (incl. `super@camermove.cm` / `Super123!`), 3 transporters,
  ~1700 trips, 6 hotels / 15 rooms, 8 rental vehicles, 8 parcels with
  status chains, 5 insurance policies, 5 events / 12 ticket categories,
  bookings + payments + tickets + notifications + audit logs.
  Verify with `pnpm seed:verify` (volumes + second-run-changes-nothing).

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super admin | `super@camermove.cm` | `Super123!` |
| Admin | `admin@camermove.cm` | `Admin123!` |
| Transporteur | `partner@camermove.cm` | `Partner123!` |
| Voyageur | `user@camermove.cm` | `User123!` |

## Landing Page Features

The landing page (`http://localhost:3002`) follows a Studio-Haas direction —
rigorous Swiss / Bauhaus minimalism:

- **Loading intro** — ink overlay, CAMERMOVE wordmark, 0→100% counter,
  curtain reveal (skipped on repeat visits, bypassed on reduced-motion)
- **Horizontal video carousel** — full-width transport + hotel chapters
  with chapter selector and progress rail
- **Six swippable service rails** — Transport (hero), Hôtels, Locations,
  Colis, Assurance, Événements, each reading its own backend module
- **Method section** — four principles applied to mobility
- **Smooth scrolling** — Lenis; GSAP batch reveals; numbered section heads
- **Responsive** — snap rails, 44px touch targets, working mobile nav

## Design System

- **Typography:** Inter (Helvetica-style stack, `--font-body`)
- **Colors:** cool gray ink, warm paper, pure white surfaces, natural wood
- **Shape:** hairline borders, zero radius, no shadows, 12-col Swiss grid

## Stop

```bash
bash scripts/dev-up.sh stop
```

Stops the app processes (tree-kill) and runs `docker compose down`. Data in named
volumes (`pgdata`, `miniodata`, `grafanadata`) survives.

## Logs

`.superpowers\logs\{api,worker,web}-{out,err}.log`

## Troubleshooting

- **Port 3001 is squatted by Grafana** — that's why the web dev server intentionally
  runs on **3002**, not Next's default.
- **Kafka topics** auto-provision on worker boot (consumer-side admin API) — no manual step.
- **`docker compose` fails** — make sure Docker Desktop is fully started first.
- **Port already in use (3000/3002)** — the script kills stale listeners automatically;
  to inspect manually: `Get-NetTCPConnection -LocalPort 3000 -State Listen`.
- **Promote a superadmin**:
  `docker compose exec -T postgres psql -U camermove -d camermove -c "UPDATE \"User\" SET role='super_admin' WHERE email='vous@example.cm';"`
