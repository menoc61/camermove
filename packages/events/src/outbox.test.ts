import { describe, it, expect } from "vitest"
import { isMissingTableError, writeOutbox } from "./outbox"

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

describe("writeOutbox", () => {
  it("writes through when the model exists", async () => {
    const calls: unknown[] = []
    const tx = { outbox: { create: async (args: unknown) => { calls.push(args); return {} } } }
    await writeOutbox(tx, "t", "k", { a: 1 })
    expect(calls).toHaveLength(1)
  })

  it("signals missing-table when the model is absent (stale client / partial double)", async () => {
    const err = await writeOutbox({} as never, "t", "k", {}).catch((e: unknown) => e)
    expect(isMissingTableError(err)).toBe(true)
  })
})
