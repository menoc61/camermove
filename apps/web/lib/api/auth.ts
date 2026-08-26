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

async function authPost(path: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const parsed = JSON.parse(text) as { message?: string }
      if (parsed.message) message = parsed.message
    } catch {
      // keep generic status message
    }
    throw new ApiError(res.status, message)
  }
  return JSON.parse(text) as AuthResponse
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
