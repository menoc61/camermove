import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLandingRails, fetchLandingStats } from "./landing";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("landing api", () => {
  it("fetchLandingStats hits GET /api/v1/landing/stats", async () => {
    const payload = {
      minPrice: 3500,
      nextDepartureAt: "2026-09-10T08:00:00.000Z",
      hotelsCount: 12,
      rentalsCount: 7,
      agencies: [],
    };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchLandingStats()).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toBe("http://localhost:3000/api/v1/landing/stats");
    expect(init.method).toBe("GET");
  });

  it("fetchLandingRails defaults to the transport rail", async () => {
    const payload = { type: "transport", items: [] };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchLandingRails()).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toBe("http://localhost:3000/api/v1/landing/rails?type=transport");
    expect(init.method).toBe("GET");
  });

  it("fetchLandingRails passes an explicit type param", async () => {
    const payload = { type: "hotels", items: [] };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchLandingRails("hotels")).resolves.toEqual(payload);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://localhost:3000/api/v1/landing/rails?type=hotels");
  });

  it("throws a labelled error on non-2xx", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchLandingStats()).rejects.toThrow("landing fetch failed");
  });
});
