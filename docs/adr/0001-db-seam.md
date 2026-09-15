# ADR 0001 — DB access seam: keep `@camermove/db` as a thin transport, not a repository-per-module layer

Date: 2026-09-15
Status: Accepted

## Context

The architecture review flagged that `apps/api/src` repositories (hotel, rental, parcel, insurance, event, agency…) are 10–60 line files whose only role is to call `prisma.<model>.<operation>`, while real query logic (where-builders, FOR UPDATE ceremonies, pricing lookups) lives in services. Two options were considered:

1. **Move all Prisma access into `packages/db` repositories** — a true single data-access layer per AGENTS.md §4 ("all Prisma access via repositories, no cross-module `prisma.*` calls").
2. **Keep Prisma access in API services**, treating `@camermove/db` as a transport/infra package (client, Redis, settings cache, atomic seat SQL, shared repositories).

## Decision

Option 2 — keep `@camermove/db` as a thin transport seam.

Rationale:

- A per-module repository layer that only forwards `prisma.*` calls adds an indirection with zero query value; the genuine shared data logic already lives in `packages/db` (`settings.ts` cache, `seat.repository` atomic SQL, `user.repository`).
- The project's actual coupling boundary is enforced by **modules owning their own tables** (`noAccessToOtherModulesTables`) plus `pgTSLockRow` guard rails — that is where cross-module DB discipline is real, not in a forwarding layer.
- The booking lifecycle (the one place with true cross-cutting transactional ceremony) is now centralized in `apps/api/src/booking-kernel/` (`confirm.ts`, `cancel.ts`, `references.ts`), which is the seam that matters for correctness (idempotency + FOR UPDATE + audit + events).

## Consequences

- `packages/db` exports: `prisma`, `getSharedRedis`/`closeSharedRedis` (single Redis client for the whole monorepo), `getAppSettingsCached`/`invalidateAppSettingsCache`, seat/user repositories, `Prisma` types.
- API services may call `prisma.*` for their own module's tables only; shared lifecycle logic goes through `booking-kernel`; payment initiation goes through `payments/initiate.ts`.
- Redis access must go through `@camermove/db`'s shared client (API `lib/redis.ts` re-exports it; no second connection pool).
- Revisit if a second consumer (e.g. a future BFF or mobile API) needs the same repositories — at that point promote repositories into `packages/db` for real.
