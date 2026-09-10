/**
 * Shared BullMQ queue definitions (AGENTS.md §1: BullMQ owns holdExpiresAt + reminders;
 * Kafka stays the durable event backbone).
 *
 * Single source of truth for queue names + connection factory + enqueue helpers.
 * Connections are lazy: no Redis I/O happens at import time, so API unit tests
 * that never enqueue never touch Redis.
 */
import { Queue } from "bullmq";
import IORedis from "ioredis";

export const QUEUE_NAMES = {
  holds: "camermove.holds",
  payments: "camermove.payments",
  trips: "camermove.trips",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const REPEAT_INTERVALS_MS = {
  payments: 60 * 60 * 1000, // hourly reconciliation
  trips: 30 * 60 * 1000, // 30-min trip reminders
} as const;

function redisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

/**
 * BullMQ requires `maxRetriesPerRequest: null` on its connections.
 * Each Queue/Worker gets its own connection (blocking clients can't share).
 */
export function createQueueConnection(url: string = redisUrl()): IORedis {
  const conn = new IORedis(url, { maxRetriesPerRequest: null });
  conn.on("error", (err: Error) => console.warn("bullmq redis error", err.message));
  return conn;
}

const queues = new Map<string, Queue>();

function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: createQueueConnection() });
    q.on("error", (err: Error) => console.error(`queue ${name} error`, err));
    queues.set(name, q);
  }
  return q;
}

export function getHoldsQueue(): Queue {
  return getQueue(QUEUE_NAMES.holds);
}

export function getPaymentsQueue(): Queue {
  return getQueue(QUEUE_NAMES.payments);
}

export function getTripsQueue(): Queue {
  return getQueue(QUEUE_NAMES.trips);
}

/** Delayed single-shot hold-expiry job. Deduped per booking via jobId. */
export async function scheduleHoldExpiry(bookingId: string, delayMs: number) {
  const delay = Math.max(0, Math.floor(delayMs));
  return getHoldsQueue().add(
    "hold-expire",
    { bookingId },
    {
      delay,
      jobId: `hold-${bookingId}`,
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  );
}

/**
 * Register (or refresh) a repeatable job. Idempotent via fixed jobId —
 * re-adding with the same jobId + repeat options upserts the repeatable.
 */
export async function ensureRepeatableJob(
  queue: Queue,
  name: string,
  data: Record<string, unknown>,
  everyMs: number,
  jobId: string,
) {
  return queue.add(name, data, {
    repeat: { every: everyMs },
    jobId,
    removeOnComplete: 50,
    removeOnFail: 200,
  });
}

/** Close all lazily-created Queue instances (graceful shutdown / tests). */
export async function closeQueues(): Promise<void> {
  const all = [...queues.values()];
  queues.clear();
  await Promise.all(all.map((q) => q.close().catch(() => {})));
}
