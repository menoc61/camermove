import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTicketDetail, lookupTicket, verifyTicket } from "./tickets";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("tickets api", () => {
  it("getTicketDetail gets the ticket with bearer token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "t1" }) });
    await getTicketDetail("tok123", "t1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/me/tickets/t1");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("verifyTicket posts the code with bearer token and idempotency key", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await verifyTicket("tok123", "CM-ABC123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/tickets/verify");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ code: "CM-ABC123" });
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("lookupTicket is public (no token) with ref query", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await lookupTicket("CM-ABC123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/tickets/lookup?ref=CM-ABC123");
    expect(init.headers.Authorization).toBeUndefined();
  });
});
