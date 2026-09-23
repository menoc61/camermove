import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelRentalBooking,
  createRentalBooking,
  fetchRental,
  fetchRentalBooking,
  fetchRentals,
} from "./rentals";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("rentals api", () => {
  it("fetchRentals hits GET /api/v1/rentals with filters", async () => {
    const payload = { items: [], total: 0, page: 1, perPage: 20, totalPages: 1 };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(
      fetchRentals({
        pickupCity: "Douala",
        category: "suv",
        hasDriver: true,
        minPrice: 5000,
        maxPrice: 25000,
        q: "Toyota",
        page: 2,
        perPage: 12,
      }),
    ).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(init.method).toBe("GET");
    expect(url).toContain("/api/v1/rentals?");
    expect(url).toContain("pickupCity=Douala");
    expect(url).toContain("category=suv");
    expect(url).toContain("hasDriver=true");
    expect(url).toContain("minPrice=5000");
    expect(url).toContain("maxPrice=25000");
    expect(url).toContain("q=Toyota");
    expect(url).toContain("page=2");
    expect(url).toContain("perPage=12");
  });

  it("fetchRentals falls back to city when pickupCity is missing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 1, perPage: 20, totalPages: 1 }),
    });
    await fetchRentals({ city: "Yaounde" });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("pickupCity=Yaounde");
  });

  it("fetchRentals defaults page/perPage when omitted", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 1, perPage: 20, totalPages: 1 }),
    });
    await fetchRentals();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("page=1");
    expect(url).toContain("perPage=20");
    expect(url).not.toContain("pickupCity=");
  });

  it("fetchRental hits GET /api/v1/rentals/:id", async () => {
    const payload = { id: "v1", make: "Toyota", model: "Yaris" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchRental("v1")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toBe("http://localhost:3000/api/v1/rentals/v1");
    expect(init.method).toBe("GET");
  });

  it("createRentalBooking posts to /bookings with bearer + idempotency key", async () => {
    const payload = { id: "rb1", totalAmount: 18000, status: "pending_payment" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(
      createRentalBooking("tok123", {
        rentalVehicleId: "v1",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        pickupCity: "Douala",
        driverName: "Jean",
        driverPhone: "+237690000000",
      }),
    ).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe("http://localhost:3000/api/v1/rentals/bookings");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({
      rentalVehicleId: "v1",
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      pickupCity: "Douala",
      driverName: "Jean",
      driverPhone: "+237690000000",
    });
  });

  it("fetchRentalBooking hits GET /bookings/:id with bearer", async () => {
    const payload = { id: "rb1", status: "pending_payment" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchRentalBooking("tok123", "rb1")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string> },
    ];
    expect(url).toBe("http://localhost:3000/api/v1/rentals/bookings/rb1");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("cancelRentalBooking posts to /bookings/:id/cancel", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "rb1", status: "cancelled" }) });
    await expect(cancelRentalBooking("tok123", "rb1")).resolves.toEqual({ id: "rb1", status: "cancelled" });
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string> },
    ];
    expect(url).toBe("http://localhost:3000/api/v1/rentals/bookings/rb1/cancel");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("throws a labelled error on non-2xx", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchRentals()).rejects.toThrow("rentals search failed");
  });
});
