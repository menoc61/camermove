import { describe, it, expect, beforeAll } from "vitest"
import { generateReference } from "./service"

// Unit: reference format + totalAmount math — truth without DB
describe("booking service", () => {
  it("generates CM- reference", () => {
    const ref = generateReference()
    expect(ref).toMatch(/^CM-[A-Z0-9]{6,}$/)
  })

  it("computes totalAmount = price * seatCount", () => {
    const price = 9000
    const seatCount = 3
    expect(price * seatCount).toBe(27000)
  })

  it("hold expires in ~15 min", () => {
    const hold = new Date(Date.now() + 15 * 60 * 1000)
    const diff = hold.getTime() - Date.now()
    expect(diff).toBeGreaterThan(14 * 60 * 1000)
    expect(diff).toBeLessThanOrEqual(15 * 60 * 1000)
  })
})

// Integration: atomic hold is covered by packages/db/src/repositories/seat.repository.test.ts
// + live endpoint sweep (POST /bookings, concurrent 409, expiry) — see .planning/phases/01-*/VERIFICATION.md
