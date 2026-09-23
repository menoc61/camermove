import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTripPayment } from "./bookings";
import { fetchMyPayments } from "./payments";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("payments api", () => {
  it("createTripPayment posts booking, provider and phone with bearer token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await createTripPayment("tok123", "b1", { provider: "notchpay", phone: "690000000" });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/payments");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(JSON.parse(init.body)).toEqual({ bookingId: "b1", provider: "notchpay", phone: "690000000" });
  });

  it("fetchMyPayments lists owner payments with bearer token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await fetchMyPayments("tok123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/payments");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });
});
