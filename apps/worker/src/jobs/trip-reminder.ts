/**
 * Trip reminder cron — 30-min setInterval, idempotent via Notification presence check.
 *
 * UPGRADE PATH: when BullMQ is installed in a future phase, replace this with
 *   Queue.add('trip-reminder', {}, { repeat: { pattern: 'every 30 minutes' } })
 * and register the handler as a Worker. Until then, setInterval is the v1 pattern
 * (matches apps/worker/src/index.ts expireHolds/reconcileStalePayments cadence).
 */
import { prisma } from "@camermove/db"
import { loadEnv } from "@camermove/config"
import { createKafkaClient, EVENT_TOPICS } from "@camermove/events"

const REMINDER_TYPE = "trip.reminder.24h"
const WINDOW_MINUTES_BEFORE = 24 * 60
const WINDOW_TOLERANCE_MINUTES = 60 // scan [now+23h, now+25h] to absorb setInterval drift
const SCAN_LIMIT = 100

/**
 * Find confirmed bookings whose trip departs in ~24h AND that haven't received
 * a trip.reminder.24h notification yet. Returns idempotent list.
 */
export async function findBookingsToRemind(now: Date = new Date()): Promise<Array<{ bookingId: string; userId: string; reference: string; departureAt: Date; origin: string; destination: string }>> {
  const windowStart = new Date(now.getTime() + (WINDOW_MINUTES_BEFORE - 30) * 60 * 1000)
  const windowEnd = new Date(now.getTime() + (WINDOW_MINUTES_BEFORE + WINDOW_TOLERANCE_MINUTES) * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      trip: { departureAt: { gte: windowStart, lte: windowEnd } },
    },
    include: {
      trip: { include: { route: true } },
    },
    take: SCAN_LIMIT,
  })

  const toRemind: Array<{ bookingId: string; userId: string; reference: string; departureAt: Date; origin: string; destination: string }> = []
  for (const b of bookings) {
    // Idempotency: skip if a trip.reminder.24h Notification row already exists for this (user, booking).
    // Notification has no bookingId column, so match on payload.bookingId (persisted by the dispatcher).
    const existing = await prisma.notification.findFirst({
      where: { type: REMINDER_TYPE, userId: b.userId, payload: { path: ["bookingId"], equals: b.id } },
      select: { id: true },
    })
    if (existing) continue
    toRemind.push({
      bookingId: b.id,
      userId: b.userId,
      reference: b.reference,
      departureAt: b.trip.departureAt,
      origin: b.trip.route.originCity,
      destination: b.trip.route.destinationCity,
    })
  }
  return toRemind
}

/**
 * Publish trip.reminder.24h NotificationEvent for each booking. Idempotent because
 * findBookingsToRemind skips any booking with an existing notification row.
 */
export async function runTripReminder(now: Date = new Date()): Promise<number> {
  const toRemind = await findBookingsToRemind(now)
  if (toRemind.length === 0) return 0

  const env = loadEnv() as never
  const kafka = createKafkaClient(env)
  const producer = kafka.producer({ idempotent: true })
  await producer.connect().catch(() => {})

  let sent = 0
  for (const b of toRemind) {
    try {
      const verificationCode = await prisma.ticket
        .findFirst({ where: { bookingId: b.bookingId }, select: { verificationCode: true } })
        .then((t) => t?.verificationCode ?? "")
      await producer
        .send({
          topic: EVENT_TOPICS.tripReminder24h,
          messages: [
            {
              key: b.bookingId,
              value: JSON.stringify({
                id: `trip-reminder-${b.bookingId}-${now.toISOString()}`,
                type: "trip.reminder.24h",
                ts: now.toISOString(),
                aggregateId: b.bookingId,
                data: {
                  type: "trip.reminder.24h",
                  userId: b.userId,
                  payload: {
                    bookingId: b.bookingId,
                    reference: b.reference,
                    departureAt: b.departureAt.toISOString(),
                    origin: b.origin,
                    destination: b.destination,
                    verificationCode,
                  },
                },
              }),
            },
          ],
        })
        .catch(() => {})
      sent++
    } catch (e) {
      console.error(`trip-reminder failed for booking ${b.bookingId}`, e)
    }
  }

  await producer.disconnect().catch(() => {})
  if (sent > 0) console.log(`trip-reminder published ${sent} event(s)`)
  return sent
}

/**
 * Manual one-shot trigger for `pnpm --filter @camermove/worker trip-reminder --once`.
 * Run via: pnpm exec tsx -e "import('./src/jobs/trip-reminder.js').then(m => m.runTripReminder())"
 */
export async function runOnce(): Promise<number> {
  const n = await runTripReminder()
  console.log(`trip-reminder one-shot processed ${n} booking(s)`)
  return n
}

if (process.argv.includes("--once")) {
  runOnce()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
