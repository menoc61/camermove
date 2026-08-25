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
