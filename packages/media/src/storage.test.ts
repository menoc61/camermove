import { describe, it, expect } from "vitest"
import { getStorage, objectKey } from "./storage"

describe("objectKey", () => {
  it("generates a safe server-owned key with extension", () => {
    const key = objectKey("transporters/logos", "png")
    expect(key).toMatch(/^transporters\/logos\/[a-z0-9-]+\.png$/i)
  })

  it("strips unsafe characters from extension", () => {
    const key = objectKey("docs", "exe;rm")
    expect(key).not.toContain(";")
    expect(key).toMatch(/\.exerm$/)
  })
})

describe("getStorage singleton", () => {
  it("returns the same client instance across calls", () => {
    const a = getStorage()
    const b = getStorage()
    expect(a.getClient()).toBe(b.getClient())
  })
})
