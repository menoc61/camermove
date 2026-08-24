import { describe, it, expect, beforeEach } from "vitest"
import { useAuthStore } from "./useAuthStore"

beforeEach(() => useAuthStore.getState().clearAuth())

describe("useAuthStore", () => {
  it("sets and clears auth", () => {
    useAuthStore.getState().setAuth({ accessToken: "tok", user: { id: "1", email: "a@b.c", role: "traveler" } })
    expect(useAuthStore.getState().accessToken).toBe("tok")
    useAuthStore.getState().clearAuth()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
  it("defaults to null", () => {
    expect(useAuthStore.getState().user).toBeNull()
  })
})
