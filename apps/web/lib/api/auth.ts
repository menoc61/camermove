import { ApiError } from "./client"

const base = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

export interface AuthUser {
  id: string
  email: string
  role: string
}

export interface AuthResponse {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

async function parseErrorResponse(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const parsed = JSON.parse(text) as { message?: string }
    if (parsed.message) return parsed.message
  } catch {
    // keep generic status message
  }
  return text || `HTTP ${res.status}`
}

async function authPost(path: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, await parseErrorResponse(res))
  return (await res.json()) as AuthResponse
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return authPost("/api/v1/auth/login", { email, password })
}

export function register(input: {
  email: string
  password: string
  firstName?: string
  lastName?: string
}): Promise<AuthResponse> {
  return authPost("/api/v1/auth/register", input)
}

export function refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
  return authPost("/api/v1/auth/refresh", { refreshToken })
}

export async function logout(accessToken: string, refreshToken?: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${base()}/api/v1/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  })
  if (!res.ok) throw new ApiError(res.status, await parseErrorResponse(res))
  return (await res.json()) as { ok: boolean }
}
