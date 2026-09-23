import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSearch } from "./search";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("search api", () => {
  it("builds the search query with defaults", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await fetchSearch({ origin: "Yaounde", destination: "Douala", date: "2026-10-01", pax: 2 });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(init.method).toBe("GET");
    expect(url).toContain("/api/v1/search?");
    expect(url).toContain("origin=Yaounde");
    expect(url).toContain("destination=Douala");
    expect(url).toContain("date=2026-10-01");
    expect(url).toContain("pax=2");
    expect(url).toContain("sortBy=price_asc");
    expect(url).toContain("page=1");
    expect(url).toContain("perPage=20");
    expect(init.headers.Authorization).toBeUndefined();
  });
});
