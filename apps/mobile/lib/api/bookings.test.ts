import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelBooking, createBooking } from "./bookings";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("bookings api", () => {
  it("createBooking posts trip, seats and passengers with bearer token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await createBooking(
      { tripId: "t1", seatCount: 2, passengers: [{ fullName: "A B" }, { fullName: "C D", phone: "690000000" }] },
      "tok123",
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/bookings");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({
      tripId: "t1",
      seatCount: 2,
      passengers: [{ fullName: "A B" }, { fullName: "C D", phone: "690000000" }],
    });
  });

  it("cancelBooking posts to the booking cancel endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await cancelBooking("b1", "tok123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/bookings/b1/cancel");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });
});
