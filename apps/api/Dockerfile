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

FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init curl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
# Run TS sources via tsx (same runtime as dev): workspace packages point
# their `main` at .ts sources and internal imports are extensionless, so
# plain node cannot boot the service. The tsc build above stays as a
# compile gate for the image.
COPY --from=builder /app/apps/api/src ./apps/api/src
# prisma client needs schema at runtime for migrate status checks
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD curl -f http://localhost:3000/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node_modules/.bin/tsx", "apps/api/src/index.ts"]
