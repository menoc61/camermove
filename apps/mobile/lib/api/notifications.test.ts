import { beforeEach, describe, expect, it, vi } from "vitest";
import { markNotificationRead } from "./notifications";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("notifications api", () => {
  it("markNotificationRead patches the read endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await markNotificationRead("tok123", "n1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/me/notifications/n1/read");
    expect(init.method).toBe("PATCH");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
