import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelHotelBooking,
  createHotelBooking,
  fetchHotel,
  fetchHotels,
  getHotelBooking,
} from "./hotels";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("hotels api", () => {
  it("fetchHotels builds the query with defaults", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 1, perPage: 20, totalPages: 0 }) });
    await fetchHotels({ city: "Yaounde" });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(init.method).toBe("GET");
    expect(url).toContain("/api/v1/hotels?");
    expect(url).toContain("city=Yaounde");
    expect(url).toContain("page=1");
    expect(url).toContain("perPage=20");
  });

  it("fetchHotels still applies default pagination on empty params", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 1, perPage: 20, totalPages: 0 }) });
    await fetchHotels({});
    const [url] = fetchMock.mock.calls[0] as [string];
    // page=1 and perPage=20 are defaults — kept so the API can paginate without
    // the client having to think about it. Only user-supplied filters are dropped.
    expect(url).toBe("http://localhost:3000/api/v1/hotels?page=1&perPage=20");
  });

  it("fetchHotels passes minPrice, maxPrice and orderBy", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 1, perPage: 12, totalPages: 0 }) });
    await fetchHotels({ city: "Douala", checkIn: "2026-10-01", checkOut: "2026-10-05", guests: 2, minPrice: 5000, maxPrice: 25000, q: "wifi", page: 2, perPage: 12, orderBy: "price_asc" });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("city=Douala");
    expect(url).toContain("checkIn=2026-10-01");
    expect(url).toContain("checkOut=2026-10-05");
    expect(url).toContain("guests=2");
    expect(url).toContain("minPrice=5000");
    expect(url).toContain("maxPrice=25000");
    expect(url).toContain("q=wifi");
    expect(url).toContain("page=2");
    expect(url).toContain("perPage=12");
    expect(url).toContain("orderBy=price_asc");
  });

  it("fetchHotel hits GET /api/v1/hotels/:id", async () => {
    const payload = { id: "h1", name: "Hotel Sahel" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchHotel("h1")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toBe("http://localhost:3000/api/v1/hotels/h1");
    expect(init.method).toBe("GET");
  });

  it("createHotelBooking posts with bearer token and idempotency key", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "b1", totalAmount: 50000, status: "pending_payment" }) });
    await createHotelBooking("tok123", {
      hotelId: "h1",
      roomTypeId: "r1",
      checkIn: "2026-10-01",
      checkOut: "2026-10-05",
      guests: 2,
      guestNames: ["Alice", "Bob"],
      specialRequests: "Late check-in",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/hotels/bookings");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({
      hotelId: "h1",
      roomTypeId: "r1",
      checkIn: "2026-10-01",
      checkOut: "2026-10-05",
      guests: 2,
      guestNames: ["Alice", "Bob"],
      specialRequests: "Late check-in",
    });
  });

  it("getHotelBooking hits GET /api/v1/hotels/bookings/:id with bearer", async () => {
    const payload = { id: "b1", status: "pending_payment", checkIn: "2026-10-01", checkOut: "2026-10-05", guests: 2, totalAmount: 50000 };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(getHotelBooking("tok123", "b1")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/hotels/bookings/b1");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("cancelHotelBooking posts to the cancel endpoint with idempotency", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "b1", status: "cancelled" }) });
    await cancelHotelBooking("tok123", "b1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/hotels/bookings/b1/cancel");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
