import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAgenciesList, fetchAgency } from "./agencies";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("agencies api", () => {
  it("fetchAgenciesList hits GET /api/v1/agencies with filters", async () => {
    const payload = { items: [], total: 0 };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchAgenciesList({ city: "Douala" })).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toBe("http://localhost:3000/api/v1/agencies?city=Douala");
    expect(init.method).toBe("GET");
  });

  it("fetchAgenciesList omits empty filters", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0 }) });
    await fetchAgenciesList();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://localhost:3000/api/v1/agencies");
  });

  it("fetchAgency hits GET /api/v1/agencies/:slug", async () => {
    const payload = { id: "a1", companyName: "Amour Mezaam" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchAgency("amour-mezaam")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toBe("http://localhost:3000/api/v1/agencies/amour-mezaam");
    expect(init.method).toBe("GET");
  });

  it("fetchAgency returns null on 404", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchAgency("inconnue")).resolves.toBeNull();
  });
});
