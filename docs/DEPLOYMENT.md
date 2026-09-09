# CamerMove — Deployment

> Local dev, Docker Compose, and a single static-landing deploy. Production guidance at the bottom.

## 1. Local development

```bash
# Prereqs: Node ≥ 22, pnpm ≥ 11, Docker Desktop, Git Bash on Windows
pnpm install
bash scripts/dev-up.sh         # or: .\scripts\dev-up.cmd on PowerShell
```

The script (idempotent):
1. `docker compose up -d` — Postgres, Redis, Minio, Kafka, Mailhog, Kafka-UI, Prometheus, Grafana
2. Waits for Postgres healthcheck
3. `prisma migrate deploy`
4. `pnpm seed` (only if DB is empty)
5. Spawns `apps/api`, `apps/worker`, `apps/web` detached
6. Polls each `/health` until 200

### Local URLs

| Service | URL | Notes |
|---------|-----|-------|
| Web (traveler app) | http://localhost:3002 | Next.js dev |
| API | http://localhost:3000 | Fastify |
| Swagger / OpenAPI | http://localhost:3000/docs | API reference |
| Health | http://localhost:3000/health | API liveness |
| MailHog | http://localhost:8025 | Captured transactional emails |
| MinIO console | http://localhost:9001 | `minioadmin` / `minioadmin` |
| Kafka UI | http://localhost:8080 | Topic / consumer inspection |
| Prometheus | http://localhost:9090 | Metrics & alerts |
| Grafana | http://localhost:3001 | `admin` / `admin` |

> The Next.js dev server runs on **3002** because Grafana takes **3000**'s usual neighbour **3001**. Don't change this unless you also bump Grafana.

## 2. Docker Compose (full stack)

```bash
docker compose up -d            # all services
docker compose ps               # status
docker compose logs -f api      # tail API
docker compose down             # stop (keeps volumes)
docker compose down -v          # stop + wipe Postgres, Minio, Grafana volumes
```

### Service summary

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `postgres` | `postgres:16-alpine` | 5432 | Transactional DB |
| `redis` | `redis:7-alpine` | 6379 | Cache, rate limit, idempotency |
| `minio` | `minio/minio:latest` | 9000/9001 | S3-compatible object store |
| `kafka` | `bitnamilegacy/kafka:3.7` | 9092 | Event backbone |
| `mailhog` | `mailhog/mailhog:latest` | 1025/8025 | Local SMTP capture |
| `kafka-ui` | `provectuslabs/kafka-ui:latest` | 8080 | Kafka inspection |
| `prometheus` | `prom/prometheus:latest` | 9090 | Metrics scrape + alerts |
| `grafana` | `grafana/grafana:latest` | 3001 | Dashboards |
| `api` | build `apps/api/Dockerfile` | 3000 | Fastify backend |
| `worker` | build `apps/worker/Dockerfile` | 4000 | Kafka consumer + BullMQ |
| `web` | build `apps/web/Dockerfile` | 3002 | Next.js standalone |

## 3. Static landing deploy

The polished Awwwards-quality landing page is bundled standalone under `dist/`. It mirrors the Next.js landing but is self-contained (no DB, no API, no React). Suitable for marketing pages, Awwwards entries, or a low-cost landing on a static host.

```bash
# Files:
dist/index.html
dist/assets/css/main.css
dist/assets/js/main.js
```

Deploy with any static host (Cloudflare Pages, Vercel, Netlify, S3+CloudFront, the Mavis `website_deploy` tool, etc.). The site references external assets:

- Videos: Pexels CDN (links in `dist/index.html`)
- Poster images: Unsplash (links in `dist/index.html`)
- Font: Google Fonts (Inter)

For full self-hosting, download these into `dist/assets/media/` and rewrite the URLs.

## 4. CI smoke tests

```bash
pnpm typecheck                 # all 10 projects
pnpm test                      # unit tests (Vitest)
pnpm smoke                     # auth + search smoke
pnpm smoke:auth                # auth only
pnpm smoke:search              # search only
pnpm smoke:tickets             # ticket lookup
pnpm smoke:dashboard           # dashboard endpoints
pnpm swagger:export            # emit openapi.json for tooling
```

The smoke scripts expect a running stack. They live in `scripts/smoke/` and `scripts/smoke-*.ts`.

## 5. Production checklist

### Secrets

`.env` is gitignored. Production secrets must come from a secret manager (AWS Secrets Manager, GCP Secret Manager, Doppler, Vault). Never commit.

| Var | What | Notes |
|-----|------|-------|
| `JWT_ACCESS_SECRET` | HS256 access token signing | 32+ bytes, rotate quarterly |
| `JWT_REFRESH_SECRET` | HS256 refresh token signing | distinct from access |
| `DATABASE_URL` | Postgres connection | include `?sslmode=require` for managed PG |
| `REDIS_URL` | Redis connection | `rediss://` for TLS |
| `KAFKA_BROKERS` | Bootstrap servers | comma-separated |
| `NOTCHPAY_API_KEY` / `CINETPAY_API_KEY` | Payment provider | rotate on personnel change |
| `SMTP_*` | Transactional mail | Mailgun / SES / Postmark |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Tracing collector | e.g. Tempo, Honeycomb |
| `SENTRY_DSN` (optional) | Error tracking | wire into Fastify `errorHandler` |

### Backups

Postgres only — Minio + Grafana are re-creatable from code.

```bash
# Daily dump
docker compose exec -T postgres pg_dump -U camermove -Fc camermove > backup-$(date +%F).dump

# Restore (custom format)
pg_restore -d camermove backup-2026-09-09.dump
```

### Horizontal scale

The API is stateless. To scale:
1. Run multiple API replicas behind a load balancer
2. Each replica exposes `/metrics` — Prometheus scrapes them all
3. BullMQ jobs are picked up by any worker (one per Redis stream)
4. Web (Next.js) is also stateless — but the static `dist/` deploy is cheaper for the landing

The infra layer (Postgres, Redis, Kafka) is the bottleneck, not the API.

### Health checks

- API: `GET /health` → 200 JSON `{ status: "ok" }`
- Web: `GET /` → 200 (any HTML)
- Postgres: `pg_isready`
- Redis: `PING`
- Kafka: producer `metadata()` call

Wire these into your orchestrator (k8s `livenessProbe`, ECS `HEALTHCHECK`, Nomad checks).

### TLS

- All external traffic on TLS (Let's Encrypt / ACM / Caddy)
- Internal traffic between containers can be plain on the docker network
- Postgres + Redis: enable TLS at the provider; use `?sslmode=require` / `rediss://`

### Logging

- Production logs go to stdout; ship to Loki / CloudWatch / Datadog with a sidecar
- Always include `requestId` and propagate it across services (Kafka headers)
- Drop PII (email, phone) before shipping to third parties
