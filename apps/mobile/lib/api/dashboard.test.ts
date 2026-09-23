import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboard } from "./dashboard";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("dashboard api", () => {
  it("getDashboard calls the dashboard endpoint with bearer token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ upcoming: [] }) });
    await getDashboard("tok123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/me/dashboard");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });
});
