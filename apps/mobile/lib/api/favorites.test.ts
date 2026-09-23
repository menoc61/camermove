import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFavorite, removeFavorite } from "./favorites";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("favorites api", () => {
  it("addFavorite posts kind and entityId", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await addFavorite("tok123", "hotel", "h1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/favorites");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ kind: "hotel", entityId: "h1" });
  });

  it("removeFavorite deletes by id", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await removeFavorite("tok123", "f1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toBe("http://localhost:3000/api/v1/favorites/f1");
    expect(init.method).toBe("DELETE");
  });
});
