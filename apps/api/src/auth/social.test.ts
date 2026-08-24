import { describe, it, expect, beforeEach } from "vitest"
import { googleProvider } from "./social"

function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${header}.${body}.sig`
}

describe("googleProvider.verifyIdToken", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id"
  })

  it("rejects wrong aud", () => {
    const tok = makeToken({ iss: "https://accounts.google.com", aud: "wrong", sub: "123", email: "a@b.c" })
    expect(() => googleProvider.verifyIdToken(tok)).toThrow(/aud/)
  })

  it("rejects wrong iss", () => {
    const tok = makeToken({ iss: "https://evil.com", aud: "test-client-id", sub: "123", email: "a@b.c" })
    expect(() => googleProvider.verifyIdToken(tok)).toThrow(/iss/)
  })

  it("accepts correct token", () => {
    const tok = makeToken({
      iss: "https://accounts.google.com",
      aud: "test-client-id",
      sub: "123",
      email: "a@b.c",
      name: "Test User",
    })
    const profile = googleProvider.verifyIdToken(tok)
    expect(profile.sub).toBe("123")
    expect(profile.email).toBe("a@b.c")
  })
})
