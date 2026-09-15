/**
 * Single typed REST adapter for apps/web → /api/v1.
 * Owns the API base URL (one env read), Bearer auth, automatic
 * Idempotency-Key on POST/PUT/PATCH, query-string building, JSON parsing
 * and uniform error surfacing (ApiError with status).
 */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface RequestOptions {
  method?: HttpMethod
  token?: string | null
  body?: unknown
  params?: object
  headers?: Record<string, string>
  idempotencyKey?: string
  cache?: RequestCache
  next?: { revalidate?: number | false; tags?: string[] }
  errorLabel?: string
}

export function buildQuery(params: object = {}): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null || value === "") continue
    qs.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value))
  }
  const s = qs.toString()
  return s ? `?${s}` : ""
}

async function parseError(res: Response, path: string, errorLabel?: string): Promise<ApiError> {
  if (errorLabel) return new ApiError(res.status, `${errorLabel}: ${path}`)
  let message = `HTTP ${res.status}`
  try {
    const text = await res.text()
    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: string }
        if (parsed.message) message = parsed.message
        else message = text
      } catch {
        message = text
      }
    }
  } catch {
    // body unreadable — keep generic status message
  }
  return new ApiError(res.status, message)
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET"
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  let body: BodyInit | undefined
  if (opts.body !== undefined) {
    body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json"
  }
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    headers["Idempotency-Key"] = opts.idempotencyKey ?? crypto.randomUUID()
  }
  Object.assign(headers, opts.headers)
  const res = await fetch(`${API_BASE_URL}${path}${buildQuery(opts.params)}`, {
    method,
    headers,
    body,
    cache: opts.cache,
    next: opts.next,
  })
  if (!res.ok) throw await parseError(res, path, opts.errorLabel)
  try {
    return (await res.json()) as T
  } catch {
    return undefined as T
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  perPage?: number
  totalPages: number
}

export interface ResourceClient<T> {
  get: <R = T>(path: string, opts?: RequestOptions) => Promise<R>
  list: <R = T>(path: string, opts?: RequestOptions) => Promise<PaginatedResponse<R>>
  create: <R = T>(path: string, body: unknown, opts?: RequestOptions) => Promise<R>
  update: <R = T>(path: string, body: unknown, opts?: RequestOptions) => Promise<R>
  remove: <R = void>(path: string, opts?: RequestOptions) => Promise<R>
  request: typeof request
}

export function resourceClient<T>(basePath: string): ResourceClient<T> {
  const url = (path: string) => `${basePath}${path}`
  return {
    get: <R>(path: string, opts: RequestOptions = {}) => request<R>(url(path), { ...opts, method: "GET" }),
    list: <R>(path: string, opts: RequestOptions = {}) =>
      request<PaginatedResponse<R>>(url(path), { ...opts, method: "GET" }),
    create: <R>(path: string, body: unknown, opts: RequestOptions = {}) =>
      request<R>(url(path), { ...opts, method: "POST", body }),
    update: <R>(path: string, body: unknown, opts: RequestOptions = {}) =>
      request<R>(url(path), { ...opts, method: "PUT", body }),
    remove: <R>(path: string, opts: RequestOptions = {}) => request<R>(url(path), { ...opts, method: "DELETE" }),
    request,
  }
}

export function apiBase(): string {
  return API_BASE_URL
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { token: string }
): Promise<T> {
  return request<T>(path, {
    method: init.method as HttpMethod | undefined,
    token: init.token,
    body: init.body,
    headers: init.headers as Record<string, string> | undefined,
  })
}
