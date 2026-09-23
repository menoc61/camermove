/**
 * Typed REST adapter for the mobile app → /api/v1.
 * Port of apps/web/lib/api/resource.ts minus Next.js-only options.
 * Owns the API base URL (one env read), Bearer auth, automatic
 * Idempotency-Key on POST/PUT/PATCH (via expo-crypto, Hermes-safe),
 * query-string building, and uniform ApiError surfacing.
 *
 * NOTE (deviation from web port): expo-crypto is loaded via dynamic import,
 * not a static import. A static `import * as Crypto from "expo-crypto"`
 * transitively pulls react-native (Flow syntax) which vitest cannot parse,
 * so the whole suite fails at load. The dynamic import keeps runtime
 * behavior identical on device (expo-crypto is installed) while letting
 * Node/vitest fall back to an RFC4122 v4 generator below.
 */

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  token?: string | null;
  body?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  errorLabel?: string;
}

export function buildQuery(params: Record<string, unknown> = {}): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

async function parseError(res: Response, path: string, errorLabel?: string): Promise<ApiError> {
  if (errorLabel) return new ApiError(res.status, `${errorLabel}: ${path}`);
  let message = `HTTP ${res.status}`;
  try {
    const text = await res.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) message = parsed.message;
        else message = text;
      } catch {
        message = text;
      }
    }
  } catch {
    // body unreadable — keep generic status message
  }
  return new ApiError(res.status, message);
}

async function newIdempotencyKey(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  try {
    const Crypto = await import("expo-crypto");
    if (typeof Crypto.randomUUID === "function") return Crypto.randomUUID();
  } catch {
    // Node/vitest: expo-crypto pulls react-native (unparseable here) — fall through.
  }
  // RFC4122 v4 fallback (vitest/Node only; device always uses expo-crypto above).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    headers["Idempotency-Key"] = await newIdempotencyKey(opts.idempotencyKey);
  }
  Object.assign(headers, opts.headers);
  const res = await fetch(`${API_BASE_URL}${path}${buildQuery(opts.params)}`, {
    method,
    headers,
    body,
  });
  if (!res.ok) throw await parseError(res, path, opts.errorLabel);
  try {
    return (await res.json()) as T;
  } catch {
    return undefined as T;
  }
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage?: number;
  totalPages: number;
}

export interface ResourceClient<T> {
  get: <R = T>(path: string, opts?: RequestOptions) => Promise<R>;
  list: <R = T>(path: string, opts?: RequestOptions) => Promise<PaginatedResponse<R>>;
  create: <R = T>(path: string, body: unknown, opts?: RequestOptions) => Promise<R>;
  update: <R = T>(path: string, body: unknown, opts?: RequestOptions) => Promise<R>;
  remove: <R = void>(path: string, opts?: RequestOptions) => Promise<R>;
  request: typeof request;
}

export function resourceClient<T>(basePath: string): ResourceClient<T> {
  const url = (path: string) => `${basePath}${path}`;
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
  };
}

export function apiBase(): string {
  return API_BASE_URL;
}

export async function apiFetch<T>(path: string, init: RequestInit & { token: string }): Promise<T> {
  return request<T>(path, {
    method: init.method as HttpMethod | undefined,
    token: init.token,
    body: init.body,
    headers: init.headers as Record<string, string> | undefined,
  });
}
