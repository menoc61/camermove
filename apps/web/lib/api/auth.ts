import { request } from "./resource"

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

function authPost(path: string, body: unknown): Promise<AuthResponse> {
  return request<AuthResponse>(path, { method: "POST", body })
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

export function logout(accessToken: string, refreshToken?: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/v1/auth/logout", {
    method: "POST",
    token: accessToken,
    body: refreshToken ? { refreshToken } : {},
  })
}
