/**
 * Docker HEALTHCHECK target: exit 0 iff worker:heartbeat is fresh (<90s), else 1.
 * Run via: pnpm --filter @camermove/worker exec tsx src/healthcheck.ts
 */
import IORedis from "ioredis";

const MAX_AGE_MS = 90_000;

async function main(): Promise<void> {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const redis = new IORedis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  try {
    const raw = await redis.get("worker:heartbeat");
    if (!raw) {
      console.error("healthcheck: no worker:heartbeat key");
      process.exit(1);
    }
    const age = Date.now() - new Date(raw).getTime();
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
      console.error(`healthcheck: stale heartbeat age=${age}ms`);
      process.exit(1);
    }
    console.log(`healthcheck: heartbeat fresh (age=${age}ms)`);
    process.exit(0);
  } catch (e) {
    console.error("healthcheck failed", (e as Error).message);
    process.exit(1);
  } finally {
    await redis.quit().catch(() => {});
  }
}

void main();
