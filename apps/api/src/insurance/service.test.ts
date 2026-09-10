import { describe, it, expect, vi } from "vitest"

// Mock cache + kafka + env so the service module loads without Redis/Kafka/DB
vi.mock("../lib/cache.js", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  invalidateCache: vi.fn().mockResolvedValue(undefined),
  cacheKey: (p: string, _o: unknown) => `${p}:mock`,
}))

vi.mock("@camermove/events", () => ({
  createKafkaClient: () => ({
    producer: () => ({
      connect: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }),
  }),
  EVENT_TOPICS: { paymentInitiated: "camermove.payment.initiated" },
}))

vi.mock("@camermove/config", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return {
    ...(orig as object),
    loadEnv: () => ({ API_URL: "http://localhost:3000", FRONTEND_URL: "http://localhost:3000", REDIS_URL: "redis://localhost:6379", KAFKA_BROKERS: "localhost:9092" }),
  }
})

import { DEFAULT_COVERAGE_PRICES, buildPolicyNumber, calcPremium, resolveInsurancePricing } from "./service.js"

describe("insurance/service pricing fallback", () => {
  it("defaults match legacy COVERAGE_PRICES", () => {
    expect(DEFAULT_COVERAGE_PRICES).toEqual({ basic: 2500, standard: 5000, premium: 10000, family: 15000 })
  })

  it("falls back to defaults when no AppSettings override is present", () => {
    expect(resolveInsurancePricing(null)).toEqual(DEFAULT_COVERAGE_PRICES)
    expect(resolveInsurancePricing(undefined)).toEqual(DEFAULT_COVERAGE_PRICES)
    expect(resolveInsurancePricing({})).toEqual(DEFAULT_COVERAGE_PRICES)
    expect(resolveInsurancePricing({ otherFlag: true })).toEqual(DEFAULT_COVERAGE_PRICES)
  })

  it("AppSettings featureFlags.insurancePricing overrides per coverage", () => {
    const resolved = resolveInsurancePricing({ insurancePricing: { standard: 7500, premium: 12000 } })
    expect(resolved.standard).toBe(7500)
    expect(resolved.premium).toBe(12000)
    expect(resolved.basic).toBe(2500)
    expect(resolved.family).toBe(15000)
  })

  it("ignores non-numeric or negative overrides", () => {
    const resolved = resolveInsurancePricing({ insurancePricing: { basic: "cheap", family: -100 } })
    expect(resolved.basic).toBe(2500)
    expect(resolved.family).toBe(15000)
  })

  it("calcPremium uses AppSettings override vs default", () => {
    expect(calcPremium("standard", 2)).toBe(10000)
    const override = resolveInsurancePricing({ insurancePricing: { standard: 7500 } })
    expect(calcPremium("standard", 2, override)).toBe(15000)
    expect(calcPremium("unknown", 3)).toBe(7500) // unknown coverage falls back to basic
  })

  it("buildPolicyNumber is INS-prefixed, unique per call, never bare Date.now", () => {
    const a = buildPolicyNumber("cmuser123456789012345678")
    const b = buildPolicyNumber("cmuser123456789012345678")
    expect(a).toMatch(/^INS-[A-Z0-9]{1,6}-[A-Z0-9]{8}$/)
    expect(a).not.toBe(b)
    expect(a).not.toContain(String(Date.now()))
  })
})
