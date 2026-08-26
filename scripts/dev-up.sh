#!/usr/bin/env bash
# One-command local launch for CamerMove.
#   bash scripts/dev-up.sh         # start everything (idempotent - safe to re-run)
#   bash scripts/dev-up.sh stop    # stop app processes + docker compose down
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS="$ROOT/.superpowers/logs"
cd "$ROOT"

log() { printf '[dev-up] %s\n' "$*"; }
die() { printf '[dev-up] ERROR: %s\n' "$*" >&2; exit 1; }

stop_apps() {
  # Kill any repo-owned node trees + stale listeners on app ports (Windows: netstat/taskkill).
  local pids
  pids="$(netstat -ano | grep -E 'LISTENING' | grep -E ':(3000|3002) ' | awk '{print $NF}' | sort -u || true)"
  for pid in $pids; do
    log "Stopping listener on app port (PID $pid)"
    taskkill //PID "$pid" //T //F >/dev/null 2>&1 || true
  done
}

wait_url() {
  local url="$1" name="$2" timeout="$3"
  local deadline=$(( $(date +%s) + timeout ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
    if [ "$code" = "200" ]; then log "$name ready ($url)"; return 0; fi
    sleep 2
  done
  log "ERROR: $name not reachable at $url after ${timeout}s" >&2
  return 1
}

mkdir -p "$LOGS"

if [ "${1:-}" = "stop" ]; then
  log "Stopping app processes..."
  stop_apps
  log "Stopping Docker services..."
  docker compose down
  log "All stopped."
  exit 0
fi

command -v docker >/dev/null || die "docker not found - start Docker Desktop first"
command -v curl   >/dev/null || die "curl not found"
command -v pnpm   >/dev/null || die "pnpm not found (corepack enable)"

log "Docker: starting services (ports bound to 127.0.0.1 only)..."
docker compose up -d --force-recreate

log "Waiting for Postgres to be healthy..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -q -U camermove -d camermove; then break; fi
  [ "$i" = "30" ] && die "Postgres not healthy after 60s (run: docker compose ps)"
  sleep 2
done

log "Applying migrations (prisma migrate deploy)..."
pnpm --filter "@camermove/db" exec prisma migrate deploy

trip_count="$(echo 'SELECT COUNT(*) FROM "Trip";' |
  docker compose exec -T postgres psql -U camermove -d camermove -t -A)"
if [ "${trip_count:-0}" -eq 0 ]; then
  log "Database empty - seeding..."
  pnpm --filter "@camermove/db" seed
else
  log "Data already present ($trip_count trips) - seed skipped."
fi

log "Stopping previous app instances (if any)..."
stop_apps

log "Starting API (:3000), worker, web (:3002) detached; logs in .superpowers/logs/..."
nohup pnpm --filter @camermove/api dev     >"$LOGS/api-out.log"    2>"$LOGS/api-err.log"    &
nohup pnpm --filter @camermove/worker dev  >"$LOGS/worker-out.log" 2>"$LOGS/worker-err.log" &
nohup pnpm --filter @camermove/web exec next dev -p 3002 >"$LOGS/web-out.log" 2>"$LOGS/web-err.log" &

log "Waiting for API health at :3000 ..."
wait_url "http://localhost:3000/health" "API" 120 || die "API failed to start (.superpowers/logs/api-err.log)"
log "Waiting for web at :3002 (first Next.js compile may take a minute)..."
wait_url "http://localhost:3002/" "Web" 240 || die "Web failed to start (.superpowers/logs/web-err.log)"

cat <<'EOF'

  CamerMove is up:
    Web (traveler)   http://localhost:3002
    API              http://localhost:3000
    Swagger docs     http://localhost:3000/docs
    Health           http://localhost:3000/health
    MailHog          http://localhost:8025
    MinIO console    http://localhost:9001
    Kafka UI         http://localhost:8080
    Prometheus       http://localhost:9090
    Grafana          http://localhost:3001

  Seeded demo data + account instructions: see LAUNCH.md
  Stop everything:  bash scripts/dev-up.sh stop
EOF
