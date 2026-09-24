import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUrbanLines, fetchUrbanSchedule, type UrbanTrip } from "./intraurban";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("intraurban api", () => {
  it("fetchUrbanLines hits GET without auth", async () => {
    const payload = [
      { origin: "Akwa", dest: "Bonapriso", price: 300, transporterId: "t1", companyName: "TransUrban", tripCountToday: 12 },
      { origin: "Deido", dest: "Bonanjo", price: 250, transporterId: "t2", companyName: "CityBus", tripCountToday: 8 },
    ];
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchUrbanLines()).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/intraurban/lines");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("fetchUrbanSchedule builds query with date and optional origin/dest/pax", async () => {
    const payload: UrbanTrip[] = [
      { id: "ut1", origin: "Akwa", dest: "Bonapriso", departureAt: "2026-10-01T07:00:00Z", arrivalAt: "2026-10-01T07:30:00Z", price: 300, seatsAvailable: 15, totalSeats: 20, line: "Akwa-Bonapriso", vehicleTypeInfo: "Minibus", isUrban: true, validUntil: "2026-10-01T23:59:59Z" },
    ];
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await fetchUrbanSchedule({ origin: "Akwa", dest: "Bonapriso", date: "2026-10-01", pax: 2 });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(init.method).toBe("GET");
    expect(url).toContain("/api/v1/intraurban/schedule?");
    expect(url).toContain("date=2026-10-01");
    expect(url).toContain("origin=Akwa");
    expect(url).toContain("dest=Bonapriso");
    expect(url).toContain("pax=2");
  });

  it("fetchUrbanSchedule works with only date parameter", async () => {
    const payload: UrbanTrip[] = [];
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await fetchUrbanSchedule({ date: "2026-10-01" });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://localhost:3000/api/v1/intraurban/schedule?date=2026-10-01");
  });

  it("fetchUrbanSchedule handles special characters in origin/dest", async () => {
    const payload: UrbanTrip[] = [];
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await fetchUrbanSchedule({ origin: "Boulevard de la Liberté", dest: "Rue Joss", date: "2026-10-01" });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("origin=Boulevard+de+la+Libert%C3%A9");
    expect(url).toContain("dest=Rue+Joss");
  });
});