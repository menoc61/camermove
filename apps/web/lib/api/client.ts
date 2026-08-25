/**
 * Shared API helpers for the web app. Mirrors the bookings.ts pattern
 * (token in Authorization header, throws ApiError on non-2xx).
 */
function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init: RequestInit & { token: string }): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${init.token}`)
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  const res = await fetch(`${apiBase()}${path}`, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new ApiError(res.status, text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}
