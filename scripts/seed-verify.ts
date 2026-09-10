/**
 * Verify the rich seed: minimum counts per table + idempotency
 * (re-runs seed:rich internally, counts must be identical).
 *
 * Run: `pnpm seed:verify`
 * Exit non-zero with a clear message on failure.
 */
import { execSync } from "node:child_process"
import { prisma } from "@camermove/db"

const MINIMUMS: Array<[string, () => Promise<number>, number]> = [
  ["users", () => prisma.user.count(), 4],
  ["transporters", () => prisma.transporter.count(), 3],
  ["trips", () => prisma.trip.count(), 100],
  ["bookings", () => prisma.booking.count(), 1],
  ["payments", () => prisma.payment.count(), 1],
  ["hotels", () => prisma.hotel.count(), 5],
  ["hotelRooms", () => prisma.hotelRoom.count(), 10],
  ["rentalVehicles", () => prisma.rentalVehicle.count(), 8],
  ["parcels", () => prisma.parcel.count(), 8],
  ["insurancePolicies", () => prisma.insurancePolicy.count(), 5],
  ["events", () => prisma.event.count(), 5],
  ["ticketCategories", () => prisma.ticketCategory.count(), 10],
]

async function snapshot(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const [name, fn] of MINIMUMS) out[name] = await fn()
  return out
}

async function main() {
  let failures = 0
  const before = await snapshot()

  // Idempotency: run the seed again, counts must not change.
  try {
    execSync("pnpm --filter @camermove/api exec tsx ../../scripts/seed-rich.ts", { stdio: "pipe" })
  } catch (e) {
    console.error(`✗ seed:rich re-run failed (idempotency check): ${(e as Error).message}`)
    failures++
  }
  const after = await snapshot()
  for (const name of Object.keys(before)) {
    if (before[name] !== after[name]) {
      console.error(`✗ NOT IDEMPOTENT: ${name} changed ${before[name]} → ${after[name]} on re-run`)
      failures++
    }
  }
  if (failures === 0) console.log("✓ idempotency: second run changed nothing")

  for (const [name, , min] of MINIMUMS) {
    const n = after[name]
    if (n >= min) console.log(`✓ ${name}: ${n} (≥ ${min})`)
    else { console.error(`✗ ${name}: ${n} < minimum ${min}`); failures++ }
  }

  await prisma.$disconnect()
  if (failures > 0) { console.error(`\n✗ seed:verify FAILED (${failures} check(s))`); process.exit(1) }
  console.log("\n✓ seed:verify passed")
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
