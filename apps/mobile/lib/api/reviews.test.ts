import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReview } from "./reviews";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("reviews api", () => {
  it("posts the review to /api/v1/reviews with bearer token and idempotency key", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await createReview("tok123", {
      target: "trip",
      tripId: "t1",
      bookingId: "b1",
      rating: 5,
      comment: "Parfait",
    });
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe("http://localhost:3000/api/v1/reviews");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({
      target: "trip",
      tripId: "t1",
      bookingId: "b1",
      rating: 5,
      comment: "Parfait",
    });
  });
});
