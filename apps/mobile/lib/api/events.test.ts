import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelEventBooking,
  createEventBooking,
  createEventBookingPayment,
  fetchEvent,
  fetchEvents,
  fetchEventBooking,
  fetchMyEventBookings,
  verifyTicket,
} from "./events";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("events api", () => {
  it("fetchEvents builds the query with defaults", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 1, totalPages: 0 }) });
    await fetchEvents({ city: "Yaounde" });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(init.method).toBe("GET");
    expect(url).toContain("/api/v1/events?");
    expect(url).toContain("city=Yaounde");
    expect(url).toContain("page=1");
  });

  it("fetchEvents passes all filters including date range and orderBy", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 2, totalPages: 5 }) });
    await fetchEvents({
      city: "Douala",
      eventType: "concert",
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
      q: "music",
      page: 2,
      perPage: 12,
      orderBy: "startDate_asc",
    });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("city=Douala");
    expect(url).toContain("eventType=concert");
    expect(url).toContain("dateFrom=2026-10-01");
    expect(url).toContain("dateTo=2026-10-31");
    expect(url).toContain("q=music");
    expect(url).toContain("page=2");
    expect(url).toContain("perPage=12");
    expect(url).toContain("orderBy=startDate_asc");
  });

  it("fetchEvent hits GET /api/v1/events/:id", async () => {
    const payload = { id: "e1", name: "Festival", city: "Yaounde" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchEvent("e1")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toBe("http://localhost:3000/api/v1/events/e1");
    expect(init.method).toBe("GET");
  });

  it("createEventBooking posts with bearer token and idempotency key", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "eb1",
        ticketNumber: "EVT-ABC123",
        qrCode: null,
        event: { id: "e1", name: "Festival", venue: "Hall", city: "Yaounde", startDate: "2026-10-15", endDate: null, eventType: "concert", status: "published", posterUrl: null },
        ticketCategory: { id: "tc1", name: "VIP", description: null, price: 15000, quantity: 100, sold: 10, status: "available", available: 90 },
        quantity: 2,
        totalAmount: 30000,
        status: "pending_payment",
        createdAt: "2026-09-23T10:00:00Z",
      }),
    });
    await createEventBooking("tok123", {
      eventId: "e1",
      ticketCategoryId: "tc1",
      quantity: 2,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/events/bookings");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({
      eventId: "e1",
      ticketCategoryId: "tc1",
      quantity: 2,
    });
  });

  it("fetchMyEventBookings includes auth header and params", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 1, perPage: 20, totalPages: 0 }) });
    await fetchMyEventBookings("tok123", { dateFrom: "2026-01-01", dateTo: "2026-12-31", q: "festival", page: 1, perPage: 10 });
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toContain("/api/v1/events/bookings/me?");
    expect(url).toContain("dateFrom=2026-01-01");
    expect(url).toContain("dateTo=2026-12-31");
    expect(url).toContain("q=festival");
    expect(url).toContain("page=1");
    expect(url).toContain("perPage=10");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("fetchEventBooking hits GET with bearer", async () => {
    const payload = { id: "eb1", ticketNumber: "EVT-ABC123", status: "confirmed" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchEventBooking("eb1", "tok123")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/events/bookings/eb1");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("cancelEventBooking posts to cancel endpoint with idempotency", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "eb1", status: "cancelled" }) });
    await cancelEventBooking("tok123", "eb1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/events/bookings/eb1/cancel");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("createEventBookingPayment sends provider and idempotency key", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ paymentUrl: "https://pay.example.com/123", authorizationUrl: "https://auth.example.com/123" }) });
    await createEventBookingPayment("eb1", "tok123", "cinetpay");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/events/bookings/eb1/pay");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({ provider: "cinetpay" });
  });

  it("createEventBookingPayment defaults to notchpay", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ paymentUrl: "https://pay.example.com/123", authorizationUrl: "https://auth.example.com/123" }) });
    await createEventBookingPayment("eb1", "tok123");
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({ provider: "notchpay" });
  });

  it("verifyTicket posts code with bearer", async () => {
    const payload = { kind: "event", valid: true, status: "valid", label: "Valide", detail: null, holder: "Jean Dupont", quantity: 2, category: "VIP" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(verifyTicket("tok123", "EVT-ABC123")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/tickets/verify");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(JSON.parse(init.body)).toEqual({ code: "EVT-ABC123" });
  });
});