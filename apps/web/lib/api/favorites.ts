import { request, resourceClient } from "./resource"

const favorites = resourceClient<Favorite>("/api/v1/favorites")

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
  return favorites.list<Favorite>("", { token, params: { page, perPage } }) as Promise<FavoritesResponse>
}

export function addFavorite(token: string, kind: FavoriteKind, entityId: string) {
  return favorites.create<Favorite>("", { kind, entityId }, { token })
}

export function removeFavorite(token: string, id: string) {
  return favorites.remove<{ ok: boolean }>(`/${id}`, { token })
}
