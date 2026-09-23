import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => {
  const mem = new Map<string, string>();
  return {
    getItemAsync: vi.fn(async (k: string) => (mem.has(k) ? mem.get(k)! : null)),
    setItemAsync: vi.fn(async (k: string, v: string) => void mem.set(k, v)),
    deleteItemAsync: vi.fn(async (k: string) => void mem.delete(k)),
    __mem: mem,
  };
});

const fetchMock = vi.fn();

function jwtWithExp(expSeconds: number): string {
  const b64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64url({ alg: "none" })}.${b64url({ exp: expSeconds })}.sig`;
}

describe("auth session", () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    const { useAuthStore } = await import("./session");
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
  });

  it("setAuth stores tokens and reports non-expired access token", async () => {
    const { useAuthStore } = await import("./session");
    const exp = Math.floor(Date.now() / 1000) + 600;
    useAuthStore.getState().setAuth({
      accessToken: jwtWithExp(exp),
      refreshToken: "r1",
      user: { id: "u1", email: "a@b.cm", role: "traveler" },
    });
    expect(useAuthStore.getState().isAccessTokenExpired()).toBe(false);
  });

  it("reports missing token as expired", async () => {
    const { useAuthStore } = await import("./session");
    expect(useAuthStore.getState().isAccessTokenExpired()).toBe(true);
  });

  it("refreshIfNeeded refreshes an expired token and keeps working state on network error", async () => {
    const { useAuthStore } = await import("./session");
    const expired = Math.floor(Date.now() / 1000) - 60;
    const fresh = Math.floor(Date.now() / 1000) + 600;
    useAuthStore.getState().setAuth({
      accessToken: jwtWithExp(expired),
      refreshToken: "r1",
      user: { id: "u1", email: "a@b.cm", role: "traveler" },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: jwtWithExp(fresh), refreshToken: "r2", user: { id: "u1", email: "a@b.cm", role: "traveler" } }),
    });
    expect(await useAuthStore.getState().refreshIfNeeded()).toBe(true);
    expect(useAuthStore.getState().isAccessTokenExpired()).toBe(false);

    useAuthStore.getState().setAuth({
      accessToken: jwtWithExp(expired),
      refreshToken: "r1",
      user: { id: "u1", email: "a@b.cm", role: "traveler" },
    });
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await useAuthStore.getState().refreshIfNeeded()).toBe(false);
    expect(useAuthStore.getState().accessToken).not.toBeNull();
  });

  it("logout clears the store even when the server call fails", async () => {
    const { useAuthStore } = await import("./session");
    useAuthStore.getState().setAuth({
      accessToken: jwtWithExp(Math.floor(Date.now() / 1000) + 600),
      refreshToken: "r1",
      user: { id: "u1", email: "a@b.cm", role: "traveler" },
    });
    fetchMock.mockRejectedValue(new Error("offline"));
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
