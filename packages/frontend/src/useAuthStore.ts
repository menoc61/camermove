import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface AuthUser { id: string; email: string; role: string }

interface RefreshResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (a: { accessToken: string; refreshToken?: string | null; user: AuthUser }) => void
  clearAuth: () => void
  /** True when there is no usable access token (absent or past expiry - skewSeconds). */
  isAccessTokenExpired: (skewSeconds?: number) => boolean
  /**
   * Proactively refresh when the access token is expired (or within skewSeconds
   * of expiry). Returns true when a usable access token is in store afterwards.
   * 401 from the endpoint clears the store; network errors keep existing state.
   */
  refreshIfNeeded: (opts?: { baseUrl?: string; skewSeconds?: number }) => Promise<boolean>
  /** Best-effort server logout, then always clears the store. */
  logout: (opts?: { baseUrl?: string }) => Promise<void>
}

// Base URL of the API (no Next.js dependency here: the host app configures it,
// e.g. from NEXT_PUBLIC_API_URL). Defaults to same-origin relative calls.
let authApiBaseUrl = ""

export function configureAuthApiBaseUrl(url: string): void {
  authApiBaseUrl = url.replace(/\/$/, "")
}

function getAccessTokenExpiryMs(token: string): number | null {
  try {
    const segment = token.split(".")[1]
    if (!segment) return null
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
    const json = typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("utf-8")
    const payload = JSON.parse(json) as { exp?: unknown }
    return typeof payload.exp === "number" ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, user, refreshToken: refreshToken ?? null }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
      isAccessTokenExpired: (skewSeconds = 30) => {
        const { accessToken } = get()
        if (!accessToken) return true
        const exp = getAccessTokenExpiryMs(accessToken)
        if (exp === null) return false
        return Date.now() >= exp - skewSeconds * 1000
      },
      refreshIfNeeded: async (opts) => {
        const { accessToken, refreshToken, user } = get()
        if (!accessToken || !refreshToken) return false
        if (!get().isAccessTokenExpired(opts?.skewSeconds)) return true
        const base = opts?.baseUrl ?? authApiBaseUrl
        try {
          const res = await fetch(`${base}/api/v1/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          })
          if (!res.ok) {
            if (res.status === 401) get().clearAuth()
            return false
          }
          const data = (await res.json()) as RefreshResponse
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user ?? user })
          return true
        } catch {
          return false
        }
      },
      logout: async (opts) => {
        const { accessToken, refreshToken } = get()
        try {
          if (accessToken) {
            const base = opts?.baseUrl ?? authApiBaseUrl
            await fetch(`${base}/api/v1/auth/logout`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(refreshToken ? { refreshToken } : {}),
            })
          }
        } catch {
          // best-effort: store is cleared regardless
        } finally {
          get().clearAuth()
        }
      },
    }),
    { name: "camermove-auth" }
  )
)
