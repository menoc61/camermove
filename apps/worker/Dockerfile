# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/events/package.json packages/events/package.json
COPY packages/media/package.json packages/media/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/frontend/package.json packages/frontend/package.json
# Retry loop: npm registry transfers flake inside docker builds (curl error 23).
RUN for i in 1 2 3 4 5; do pnpm install --frozen-lockfile && break || { echo "pnpm install attempt $i failed, retrying..."; sleep 20; }; done

FROM deps AS builder
COPY . .
RUN pnpm --filter @camermove/db exec prisma generate
RUN pnpm --filter @camermove/api build
RUN pnpm --filter @camermove/worker build

FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
# Run TS sources via tsx (same runtime as dev) — see apps/api/Dockerfile.
COPY --from=builder /app/apps/worker/src ./apps/worker/src
COPY --from=builder /app/apps/api/src ./apps/api/src
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
ENTRYPOINT ["dumb-init", "--"]
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node_modules/.bin/tsx apps/worker/src/healthcheck.ts
CMD ["node_modules/.bin/tsx", "apps/worker/src/index.ts"]
