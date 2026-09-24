import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelInsurancePolicy,
  createInsurancePayment,
  fetchInsurancePolicies,
  fetchInsurancePolicy,
  fetchMyInsurancePolicies,
  subscribeInsurance,
  COVERAGE_LABELS,
  COVERAGE_PRICES,
} from "./insurance";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("insurance api", () => {
  it("fetchInsurancePolicies builds query with token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 1, perPage: 20, totalPages: 0 }) });
    await fetchInsurancePolicies("tok123", { coverageType: "premium" });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(url).toContain("/api/v1/insurance/policies?");
    expect(url).toContain("coverageType=premium");
    expect(url).toContain("page=1");
  });

  it("fetchInsurancePolicies passes date range and search", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 1, perPage: 10, totalPages: 0 }) });
    await fetchInsurancePolicies("tok123", { q: "travel", dateFrom: "2026-10-01", dateTo: "2026-10-31", page: 1, perPage: 10 });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("q=travel");
    expect(url).toContain("dateFrom=2026-10-01");
    expect(url).toContain("dateTo=2026-10-31");
    expect(url).toContain("page=1");
    expect(url).toContain("perPage=10");
  });

  it("fetchMyInsurancePolicies uses same endpoint with auth", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 1, perPage: 20, totalPages: 0 }) });
    await fetchMyInsurancePolicies("tok123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toContain("/api/v1/insurance/policies?");
    expect(url).toContain("page=1");
    expect(url).toContain("perPage=20");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("subscribeInsurance posts with bearer and idempotency key", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "pol1",
        providerName: "AssurCam",
        coverageType: "premium",
        destination: "Douala",
        startDate: "2026-10-01",
        endDate: "2026-10-15",
        travelers: 2,
        premium: 10000,
        currency: "XAF",
        status: "pending_payment",
        policyNumber: null,
        documentUrl: null,
        createdAt: "2026-09-23T10:00:00Z",
      }),
    });
    await subscribeInsurance("tok123", {
      destination: "Douala",
      startDate: "2026-10-01",
      endDate: "2026-10-15",
      travelersCount: 2,
      coverageType: "premium",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/insurance/policies");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({
      destination: "Douala",
      startDate: "2026-10-01",
      endDate: "2026-10-15",
      travelersCount: 2,
      coverageType: "premium",
    });
  });

  it("fetchInsurancePolicy hits GET with bearer", async () => {
    const payload = { id: "pol1", coverageType: "premium", status: "active", premium: 10000 };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchInsurancePolicy("tok123", "pol1")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/insurance/policies/pol1");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("cancelInsurancePolicy posts to cancel with idempotency", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "pol1", status: "cancelled" }) });
    await cancelInsurancePolicy("tok123", "pol1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/insurance/policies/pol1/cancel");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("createInsurancePayment sends provider, method, phone, email", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ paymentUrl: "https://pay.example.com/123", authorizationUrl: "https://auth.example.com/123" }) });
    await createInsurancePayment("tok123", "pol1", {
      provider: "cinetpay",
      method: "mobile_money",
      phone: "+237612345678",
      email: "user@example.com",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/insurance/policies/pol1/pay");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({
      provider: "cinetpay",
      method: "mobile_money",
      phone: "+237612345678",
      email: "user@example.com",
    });
  });

  it("createInsurancePayment defaults provider to notchpay", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ paymentUrl: "https://pay.example.com/123", authorizationUrl: "https://auth.example.com/123" }) });
    await createInsurancePayment("tok123", "pol1", { method: "card" });
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({ provider: "notchpay", method: "card" });
  });

  it("COVERAGE_LABELS maps all types to French", () => {
    expect(COVERAGE_LABELS.basic).toBe("Basique");
    expect(COVERAGE_LABELS.standard).toBe("Standard");
    expect(COVERAGE_LABELS.premium).toBe("Premium");
    expect(COVERAGE_LABELS.family).toBe("Famille");
  });

  it("COVERAGE_PRICES maps all types to XAF", () => {
    expect(COVERAGE_PRICES.basic).toBe(2500);
    expect(COVERAGE_PRICES.standard).toBe(5000);
    expect(COVERAGE_PRICES.premium).toBe(10000);
    expect(COVERAGE_PRICES.family).toBe(15000);
  });
});