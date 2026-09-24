import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelParcel,
  createParcel,
  createParcelPayment,
  fetchParcel,
  fetchParcels,
  trackParcel,
} from "./parcels";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("parcels api", () => {
  it("fetchParcels builds query with token and defaults", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 1, perPage: 20, totalPages: 0 }) });
    await fetchParcels("tok123", { senderCity: "Yaounde" });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(url).toContain("/api/v1/parcels?");
    expect(url).toContain("senderCity=Yaounde");
    expect(url).toContain("page=1");
    expect(url).toContain("perPage=20");
  });

  it("fetchParcels passes all filters including date range", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 2, perPage: 10, totalPages: 3 }) });
    await fetchParcels("tok123", {
      q: "electronics",
      status: "in_transit",
      recipientCity: "Douala",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      page: 2,
      perPage: 10,
      orderBy: "createdAt",
    });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("q=electronics");
    expect(url).toContain("status=in_transit");
    expect(url).toContain("recipientCity=Douala");
    expect(url).toContain("dateFrom=2026-09-01");
    expect(url).toContain("dateTo=2026-09-30");
    expect(url).toContain("page=2");
    expect(url).toContain("perPage=10");
    expect(url).toContain("orderBy=createdAt");
  });

  it("createParcel posts with bearer and idempotency key", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ trackingNumber: "CM-PARCEL-123", id: "p1" }) });
    await createParcel("tok123", {
      senderName: "Alice",
      senderPhone: "+237612345678",
      recipientName: "Bob",
      recipientPhone: "+237687654321",
      senderCity: "Yaounde",
      recipientCity: "Douala",
      parcelType: "document",
      weightKg: 0.5,
      dimensionsCm: "30x20x2",
      description: "Contracts",
      declaredValue: 50000,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/parcels");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({
      senderName: "Alice",
      senderPhone: "+237612345678",
      recipientName: "Bob",
      recipientPhone: "+237687654321",
      senderCity: "Yaounde",
      recipientCity: "Douala",
      parcelType: "document",
      weightKg: 0.5,
      dimensionsCm: "30x20x2",
      description: "Contracts",
      declaredValue: 50000,
    });
  });

  it("trackParcel hits public endpoint without auth", async () => {
    const payload = {
      id: "p1",
      trackingNumber: "CM-PARCEL-123",
      senderName: "Alice",
      senderPhoneMasked: "+2376****5678",
      recipientName: "Bob",
      recipientPhoneMasked: "+2376****4321",
      senderCity: "Yaounde",
      recipientCity: "Douala",
      parcelType: "document",
      weightKg: 0.5,
      dimensionsCm: "30x20x2",
      description: "Contracts",
      shippingCost: 3500,
      status: "delivered",
      currentLocation: "Douala",
      statusHistory: [{ status: "created", location: "Yaounde", note: "Collected", createdAt: "2026-09-20T10:00:00Z" }],
    };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(trackParcel("CM-PARCEL-123")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/parcels/track/CM-PARCEL-123");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("fetchParcel hits GET with bearer", async () => {
    const payload = { id: "p1", trackingNumber: "CM-PARCEL-123", status: "in_transit" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchParcel("p1", "tok123")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/parcels/p1");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("cancelParcel posts to cancel with idempotency", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "p1", status: "cancelled" }) });
    await cancelParcel("tok123", "p1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/parcels/p1/cancel");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("createParcelPayment sends provider and idempotency key", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ paymentUrl: "https://pay.example.com/123", authorizationUrl: "https://auth.example.com/123" }) });
    await createParcelPayment("p1", "tok123", "cinetpay");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/parcels/p1/pay");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({ provider: "cinetpay" });
  });

  it("createParcelPayment defaults to notchpay", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ paymentUrl: "https://pay.example.com/123", authorizationUrl: "https://auth.example.com/123" }) });
    await createParcelPayment("p1", "tok123");
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({ provider: "notchpay" });
  });
});