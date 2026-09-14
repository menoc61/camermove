"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useAuthStore, configureAuthApiBaseUrl } from "@camermove/frontend"
import { ApiError } from "../lib/api/client"

const CM_ACCESS_COOKIE = "cm_access"
const CM_ACCESS_MAX_AGE_SECONDS = 900 // 15 min — matches JWT access-token TTL

/**
 * Mirror the zustand accessToken to a non-HttpOnly cookie so the Next.js
 * middleware (apps/web/middleware.ts) can gate /dashboard and /tickets/*.
 *
 * NOTE: cm_access is intentionally NOT HttpOnly because zustand is the source
 * of truth and JS needs to read it back on the client. The actual authorization
 * still happens server-side in requireAuth() which validates JWT signature +
 * expiry. SameSite=Lax prevents cross-site POST CSRF (browsers do not send
 * Lax cookies on cross-site requests).
 */
function writeAccessCookie(token: string | null) {
  if (typeof window === "undefined") return
  if (token) {
    document.cookie = `${CM_ACCESS_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax; Max-Age=${CM_ACCESS_MAX_AGE_SECONDS}`
  } else {
    document.cookie = `${CM_ACCESS_COOKIE}=; path=/; SameSite=Lax; Max-Age=0`
  }
}

function AuthCookieSync() {
  // Hydrate cookie from persisted zustand state on first mount.
  // zustand persist middleware restores accessToken from localStorage
  // asynchronously on hydration; this effect runs once after that.
  const initial = useAuthStore.getState().accessToken
  useEffect(() => {
    configureAuthApiBaseUrl(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000")
    writeAccessCookie(initial)
    // Subscribe to future changes (login / logout).
    const unsub = useAuthStore.subscribe((state) => {
      writeAccessCookie(state.accessToken)
    })
    // Proactive access-token refresh (15m TTL): try every 5 minutes.
    const timer = setInterval(() => {
      void useAuthStore.getState().refreshIfNeeded()
    }, 5 * 60 * 1000)
    return () => {
      unsub()
      clearInterval(timer)
    }
  }, [initial])
  return null
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 300_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  // Global error handler for 401 errors - try to refresh token or redirect to login
  useEffect(() => {
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (event.type === "updated") {
        const state = event.query.state
        if (state.status === "error" && state.error instanceof ApiError && state.error.status === 401) {
          const store = useAuthStore.getState()
          // Try to refresh the token
          void store.refreshIfNeeded().then((refreshed) => {
            if (!refreshed) {
              // Refresh failed - clear auth and redirect to login
              store.clearAuth()
              if (typeof window !== "undefined") {
                window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname)
              }
            }
          })
        }
      }
    })
    return () => {
      unsubscribe()
    }
  }, [client])

  return (
    <QueryClientProvider client={client}>
      <AuthCookieSync />
      {children}
    </QueryClientProvider>
  )
}
