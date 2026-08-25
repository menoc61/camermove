import { describe, it, expect } from "vitest"
import { hashPassword, verifyPassword } from "./password"

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("S3cret!")
    expect(hash).toContain("$argon2")
    expect(await verifyPassword(hash, "S3cret!")).toBe(true)
    expect(await verifyPassword(hash, "wrong")).toBe(false)
  })
})
