# CamerMove local runbook

## Start the stack

```powershell
pnpm dev:up
```

This starts Docker infrastructure, deploys Prisma migrations, seeds business data when needed, and starts API, worker, and web.

## Local endpoints

| Component | URL |
|---|---|
| Web | http://localhost:3002 |
| API health | http://localhost:3000/health |
| OpenAPI | http://localhost:3000/docs |
| Metrics | http://localhost:3000/metrics |
| Grafana | http://localhost:3001 |
| Kafka UI | http://localhost:8080 |
| Prometheus | http://localhost:9090 |
| MailHog | http://localhost:8025 |
| MinIO console | http://localhost:9001 |

## Local demo accounts (seed data — local only, never production)

All seeded accounts share the password `motdepasse123`.

| Role | Email | Entry point |
|---|---|---|
| Traveler | `traveler@camermove.cm` | http://localhost:3002/login → /dashboard |
| Partner | `partner@camermove.cm` | http://localhost:3002/login → /partner/hotels or /partner/rentals |
| Transporter | see seed output (`transporter` role) | http://localhost:3002/transporter/dashboard |
| Admin | `admin@camermove.cm` | http://localhost:3002/admin/login → /admin |
| Super admin | `super@camermove.cm` | http://localhost:3002/admin/login → /admin (settings enabled) |

Registration for travelers: http://localhost:3002/register. Partner applications: http://localhost:3002/transporter/apply.

## Domain metrics

`GET /metrics` exposes, alongside route/latency metrics:
`search_requests_total{origin,destination}` (labels normalized, lowercased, truncated to 48 chars),
`bookings_total{status}`, `payments_total{provider,outcome}`, `parcels_total{status}`,
`event_tickets_total{event}`, `insurance_subscriptions_total{coverage}`.
Grafana panels and Prometheus alerts (`HighErrorRate`, `SlowP95`, `BookingSurge`, `PaymentFailures`) query these emitted names.

## Verification

```powershell
pnpm -r typecheck
pnpm -r test
pnpm smoke
pnpm smoke:tickets
pnpm smoke:dashboard
```

The API test suite includes concurrent last-seat and idempotency replay coverage. Smoke tests require API on port 3000 and web on port 3002.

## Operational checks

- Prometheus target status must show the API target `UP`.
- Grafana dashboards must use the provisioned Prometheus datasource.
- Kafka UI should show the booking/event topics and consumer group activity.
- Worker logs should show Kafka consumption and BullMQ hold/reminder processing.
- On shutdown, use Ctrl+C and allow API/worker graceful termination.

## Troubleshooting

- If port 3001 is occupied by another process, stop it; Grafana is intentionally published there.
- If database state is stale, run `pnpm --filter @camermove/db exec prisma migrate deploy` and `pnpm --filter @camermove/db seed`.
- Never commit `.env`, access tokens, payment credentials, or webhook secrets.
