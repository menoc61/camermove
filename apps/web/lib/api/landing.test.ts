import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchLandingRail, fetchLandingStats } from "./landing"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("landing fetchers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.stubGlobal("fetch", mockFetch)
  })

  it("fetchLandingStats hits GET /api/v1/landing/stats", async () => {
    const payload = {
      minPrice: 3500,
      nextDepartureAt: "2026-09-10T08:00:00.000Z",
      hotelsCount: 12,
      rentalsCount: 7,
      agencies: [],
    }
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => payload })
    await expect(fetchLandingStats()).resolves.toEqual(payload)
    expect(mockFetch).toHaveBeenCalledOnce()
    const url = String(mockFetch.mock.calls[0]?.[0])
    expect(url).toContain("/api/v1/landing/stats")
  })

  it("fetchLandingRail hits GET /api/v1/landing/rails?type=", async () => {
    const payload = { type: "transport", items: [] }
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => payload })
    await expect(fetchLandingRail("transport")).resolves.toEqual(payload)
    const url = String(mockFetch.mock.calls[0]?.[0])
    expect(url).toContain("/api/v1/landing/rails?type=transport")
  })

  it("throws on non-2xx", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(fetchLandingStats()).rejects.toThrow("landing fetch failed")
  })
})
