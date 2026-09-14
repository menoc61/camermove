/**
 * Docker HEALTHCHECK target: exit 0 iff worker:heartbeat is fresh (<90s), else 1.
 * Run via: pnpm --filter @camermove/worker exec tsx src/healthcheck.ts
 */
import IORedis from "ioredis";
import { loadEnv } from "@camermove/config";

const MAX_AGE_MS = 90_000;
const CONNECT_TIMEOUT_MS = 2000;

async function main(): Promise<void> {
  const { REDIS_URL } = loadEnv();
  const redis = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  try {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        redis.connect(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("redis connect timeout")), CONNECT_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    const raw = await redis.get("worker:heartbeat");
    if (!raw) {
      console.error("healthcheck: no worker:heartbeat key");
      process.exit(1);
    }
    const rawAge = Date.now() - new Date(raw).getTime();
    if (!Number.isFinite(rawAge)) {
      console.error(`healthcheck: stale heartbeat age=${rawAge}ms`);
      process.exit(1);
    }
    // Clamp clock-skew (future-dated heartbeat) to 0 instead of failing.
    const age = Math.max(0, rawAge);
    if (age > MAX_AGE_MS) {
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
