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

The seed script (`packages/db/prisma/seed.ts`, run via `pnpm --filter @camermove/db seed`)
creates **business data only — no user accounts exist after seeding**:

- Transporter **CamerMove Express** (`express@camermove.cm`, Douala, bus, approved)
- Route **Yaoundé → Douala**
- **9 trips**: days +1/+2/+3 at 07:00 / 13:00 / 18:00 UTC, 6 000–8 000 XAF, 55 seats each (autocar)

Create a traveler account through the API (web login pages ship separately):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/register `
  -ContentType "application/json" `
  -Body '{"email":"vous@example.cm","password":"motdepasse123","firstName":"Vous"}'
```

No `super_admin` is pre-created; promote an existing account manually if needed
(see Troubleshooting).

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
  `docker compose exec -T postgres psql -U camermove -d camermove -c "UPDATE ""User"" SET role='super_admin' WHERE email='vous@example.cm';"`
