import { describe, it, expect } from "vitest"
import { isMissingTableError } from "./outbox"

describe("isMissingTableError", () => {
  it("treats Prisma P2021 as missing table", () => {
    expect(isMissingTableError({ code: "P2021" })).toBe(true)
  })

  it("rejects other Prisma codes", () => {
    expect(isMissingTableError({ code: "P2002" })).toBe(false)
  })

  it("matches raw 'relation does not exist' messages", () => {
    expect(isMissingTableError(new Error('relation "Outbox" does not exist'))).toBe(true)
  })

  it("rejects unrelated errors", () => {
    expect(isMissingTableError(new Error("connection refused"))).toBe(false)
  })
})
