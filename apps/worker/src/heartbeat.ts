/**
 * Worker liveness heartbeat — SETEX worker:heartbeat every 15s (TTL 60s).
 * The Dockerfile HEALTHCHECK (healthcheck.ts) fails if the key is stale >90s.
 */
import IORedis from "ioredis";
import { createLogger, loadEnv } from "@camermove/config";

const log = createLogger();

export const HEARTBEAT_KEY = "worker:heartbeat";
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_TTL_S = 60;

let timer: NodeJS.Timeout | null = null;
let client: IORedis | null = null;

export function startHeartbeat(): void {
  if (timer) return;
  const env = loadEnv();
  client ??= new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  client.on("error", (err: Error) => log.warn({ err: err.message }, "heartbeat redis error"));

  const beat = () =>
    client
      ?.setex(HEARTBEAT_KEY, HEARTBEAT_TTL_S, new Date().toISOString())
      .catch((e: unknown) => log.warn({ err: (e as Error).message }, "heartbeat failed"));
  void beat();
  timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
  timer.unref?.();
  log.info("worker heartbeat started (15s)");
}

export async function stopHeartbeat(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (client) {
    await client.quit().catch(() => {});
    client = null;
  }
}
