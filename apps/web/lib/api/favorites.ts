import { apiFetch } from "./client"

export type FavoriteKind = "hotel" | "rental" | "event"

export interface Favorite {
  id: string
  userId: string
  kind: FavoriteKind
  entityId: string
  createdAt: string
}

export interface FavoritesResponse {
  items: Favorite[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export function fetchFavorites(token: string, page = 1, perPage = 20) {
  const qs = new URLSearchParams({ page: String(page), perPage: String(perPage) })
  return apiFetch<FavoritesResponse>(`/api/v1/favorites?${qs.toString()}`, { method: "GET", token })
}

export function addFavorite(token: string, kind: FavoriteKind, entityId: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }
  return apiFetch<Favorite>(`/api/v1/favorites`, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind, entityId }),
    token,
  })
}

export function removeFavorite(token: string, id: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/favorites/${id}`, { method: "DELETE", token })
}
