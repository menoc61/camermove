import { describe, it, expect } from "vitest"
import { objectKey } from "./storage"

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
