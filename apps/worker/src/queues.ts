/**
 * BullMQ workers (AGENTS.md §1: BullMQ owns holdExpiresAt + reminders;
 * Kafka stays the event backbone — the consumer in index.ts is untouched).
 */
import { Worker, type Job } from "bullmq";
import { createLogger } from "@camermove/config";
import {
  QUEUE_NAMES,
  REPEAT_INTERVALS_MS,
  createQueueConnection,
  ensureRepeatableJob,
  getPaymentsQueue,
  getTripsQueue,
} from "@camermove/shared/queues";

const log = createLogger();

const workers: Worker[] = [];

async function processHoldExpire(job: Job<{ bookingId: string }>): Promise<void> {
  const { bookingId } = job.data;
  if (!bookingId) return;
  const mod = await import("../../api/src/bookings/service.js");
  const didExpire: boolean = await mod.expireHoldById(bookingId);
  if (didExpire) log.info({ bookingId }, "hold-expire released booking");
}

async function processReconciliation(): Promise<void> {
  const mod = await import("../../api/src/payments/jobs/reconciliation.js");
  await mod.reconcileStalePayments();
}

async function processTripReminder(): Promise<void> {
  const mod = await import("./jobs/trip-reminder.js");
  const n: number = await mod.runTripReminder();
  if (n > 0) log.info({ n }, "trip-reminder published events via queue");
}

/** Start BullMQ Workers and register repeatable jobs. Call once from main(). */
export async function startQueues(): Promise<void> {
  workers.push(
    new Worker(QUEUE_NAMES.holds, processHoldExpire, {
      connection: createQueueConnection(),
      concurrency: 5,
    }),
    new Worker(QUEUE_NAMES.payments, processReconciliation, {
      connection: createQueueConnection(),
      concurrency: 5,
    }),
    new Worker(QUEUE_NAMES.trips, processTripReminder, {
      connection: createQueueConnection(),
      concurrency: 5,
    }),
  );
  for (const w of workers) {
    w.on("failed", (job, err) =>
      log.error({ queue: w.name, jobId: job?.id, err: (err as Error).message }, "queue job failed"),
    );
  }

  // Repeatables (deduped via fixed jobIds — re-adding upserts, safe on every boot)
  await ensureRepeatableJob(
    getPaymentsQueue(),
    "reconcile-stale-payments",
    {},
    REPEAT_INTERVALS_MS.payments,
    "reconcile-stale-payments",
  );
  await ensureRepeatableJob(
    getTripsQueue(),
    "trip-reminder",
    {},
    REPEAT_INTERVALS_MS.trips,
    "trip-reminder",
  );

  log.info(
    { paymentsEveryMin: REPEAT_INTERVALS_MS.payments / 60000, tripsEveryMin: REPEAT_INTERVALS_MS.trips / 60000 },
    "bullmq workers started",
  );
}

/** Graceful shutdown: close workers + queues. */
export async function closeQueues(): Promise<void> {
  const { closeQueues: closeSharedQueues } = await import("@camermove/shared/queues");
  await Promise.all(workers.splice(0).map((w) => w.close().catch(() => {})));
  await closeSharedQueues();
}
