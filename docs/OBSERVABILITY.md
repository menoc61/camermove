# CamerMove — Observability

> Prometheus + Grafana + OpenTelemetry. All wired via `docker compose up -d`. Source: `packages/observability/`, `infra/prometheus.yml`, `infra/alerts.yml`, `infra/dashboards/`.

## Stack

| Layer | Tool | Where |
|-------|------|-------|
| Metrics | prom-client + OpenTelemetry | `packages/observability/src/metrics.ts` |
| Traces | OpenTelemetry (OTLP) | `packages/observability/src/tracing.ts` |
| Scrape | Prometheus | `infra/prometheus.yml` |
| Dashboard | Grafana | `infra/dashboards/*.json` |
| Logs | stdout → Docker → host `.superpowers/logs/` | API/worker/web log files |
| Alerts | Prometheus Alertmanager rules | `infra/alerts.yml` |

## Metrics

The API exposes `/metrics` (Fastify + fastify-metrics). Worker exposes `/metrics` on port 4000. Both are scraped every 15s.

### Custom metrics

| Metric | Type | Labels | Where it's incremented |
|--------|------|--------|------------------------|
| `camermove_operations_total` | Counter | `name, route` | Generic op counter (via `observe()`) |
| `camermove_error_total` | Counter | `name` | On any `observe()` throw |
| `camermove_operation_duration_ms` | Histogram | `name` | `observe()` wrap |
| `search_requests_total` | Counter | `origin, destination` | `observeSearch()` on `/search` |
| `bookings_total` | Counter | `status` | `observeBooking()` on `POST /bookings`, cancel, expire |
| `payments_total` | Counter | `provider, outcome` | `observePayment()` on `POST /payments` |
| `parcels_total` | Counter | `status` | `observeParcel()` on parcel transitions |
| `event_tickets_total` | Counter | `event` | `observeEventTicket()` on event booking |
| `insurance_subscriptions_total` | Counter | `coverage` | `observeInsurance()` on policy create |

All metric labels are **bounded to 48 chars** (lowercased, trimmed) to prevent cardinality blow-up.

### Usage

```ts
import { observeSearch, observeBooking, observePayment } from "@camermove/observability"

observeSearch("Yaoundé", "Douala")
observeBooking("confirmed")
observePayment("notchpay", "success")
```

## Traces

OpenTelemetry is initialized in `apps/api/src/app.ts` via `initTelemetry(env)`. It auto-instruments:

- HTTP (Fastify)
- Postgres (pg)
- Redis (ioredis)
- Kafka (kafkajs)
- DNS, Net

Traces are exported to `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`). For local dev, run a collector (Tempo / Jaeger) on that port, or set `METRICS_ENABLED=false` to skip the SDK entirely.

## Logs

Logs are written by the API / worker / web processes to:

```
.superpowers/logs/api-{out,err}.log
.superpowers/logs/worker-{out,err}.log
.superpowers/logs/web-{out,err}.log
```

Structured via Fastify's pino logger. Each line is JSON with `level, time, msg, requestId, ip, ua, route, status, ...`.

```bash
# Tail API logs
tail -f .superpowers/logs/api-out.log | jq .

# Filter for errors only
cat .superpowers/logs/api-err.log | jq 'select(.level=="error")'
```

## Alerts

Defined in `infra/alerts.yml` (Prometheus rule file). Wire it into Alertmanager with:

```yaml
# infra/alertmanager.yml
route:
  receiver: slack
receivers:
  - name: slack
    slack_configs:
      - api_url: $SLACK_WEBHOOK_URL
        channel: "#camermove-alerts"
```

| Alert | Condition | Severity |
|-------|-----------|----------|
| `HighErrorRate` | `rate(camermove_error_total[5m]) > 0.05` for 5m | critical |
| `SlowP95` | `histogram_quantile(0.95, rate(camermove_operation_duration_ms_bucket[5m])) > 2000` for 5m | warning |
| `BookingSurge` | `rate(bookings_total[15m]) > 1` for 5m | info |
| `PaymentFailures` | `rate(payments_total{outcome="failed"}[10m]) > 0.2` for 5m | critical |

## Grafana dashboards

Located in `infra/dashboards/`. Loaded automatically by the Grafana container on startup.

| File | Purpose |
|------|---------|
| `api-latency.json` | p50 / p95 / p99 per route, error rate, request volume |

**Local URLs** (after `docker compose up -d`):
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin / admin)

To add a new dashboard: drop a JSON file in `infra/dashboards/`, then `docker compose restart grafana`.

## Health checks

- `GET /health` — API liveness (returns 200, JSON `{ status: "ok" }`)
- API container healthcheck in `docker-compose.yml` pings `/health` every 10s
- Web container healthcheck pings the home page every 10s
- Postgres healthcheck: `pg_isready -U camermove` every 5s

## Sanity checklist

```bash
# 1. Scrape targets up
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[].labels.job'

# 2. Sample a metric
curl -s http://localhost:3000/metrics | grep camermove_

# 3. Tail a request log
tail -f .superpowers/logs/api-out.log | jq 'select(.reqId)'

# 4. Fire a test alert
curl -X POST http://localhost:9090/-/reload
# In Prometheus UI: status → rules → "HighErrorRate" → evaluate
```

## Production notes

- Replace Alertmanager receiver with PagerDuty / Opsgenie
- Move Grafana data source to a managed Prometheus (Grafana Cloud, Datadog, New Relic)
- Ship logs to a centralised store (Loki, CloudWatch, ELK)
- Add `requestId` to every log line and propagate it through Kafka for distributed tracing
- Sample traces at 1% in prod (set `OTEL_TRACES_SAMPLER=parentbased_traceidratio`, `OTEL_TRACES_SAMPLER_ARG=0.01`)
