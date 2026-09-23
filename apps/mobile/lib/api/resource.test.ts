import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, buildQuery, request } from "./resource";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("buildQuery", () => {
  it("skips undefined, null, and empty values", () => {
    expect(buildQuery({ origin: "Yaounde", pax: 1, q: "", skip: undefined })).toBe(
      "?origin=Yaounde&pax=1",
    );
  });

  it("serializes arrays as JSON", () => {
    expect(buildQuery({ ids: ["a", "b"] })).toBe("?ids=%5B%22a%22%2C%22b%22%5D");
  });
});

describe("request", () => {
  it("sends Bearer token and Idempotency-Key on POST", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await request("/api/v1/bookings", {
      method: "POST",
      token: "tok123",
      body: { tripId: "t1" },
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("throws ApiError with server message on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ message: "Trip not found" }),
    });
    await expect(request("/api/v1/trips/x")).rejects.toMatchObject(
      new ApiError(404, "Trip not found"),
    );
  });
});
