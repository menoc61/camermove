import { NotFoundError } from "@camermove/config"
import { invalidateCache } from "../lib/cache.js"
import {
  countFavorites,
  createFavorite,
  deleteFavorite,
  findFavoriteById,
  findFavoriteByUnique,
  findFavorites,
} from "./repository.js"

export async function listFavorites(userId: string, skip: number, take: number) {
  const [items, total] = await Promise.all([findFavorites(userId, skip, take), countFavorites(userId)])
  return { items, total }
}

// Idempotent create: @@unique([userId, kind, entityId]) guarantees one row;
// replay returns the existing row (created: false). The P2002 catch covers
// the check-then-create race between concurrent requests.
export async function addFavorite(input: { userId: string; kind: string; entityId: string }) {
  const existing = await findFavoriteByUnique(input.userId, input.kind, input.entityId)
  if (existing) return { favorite: existing, created: false }
  try {
    const favorite = await createFavorite(input)
    try {
      await invalidateCache("favorites*")
    } catch {}
    return { favorite, created: true }
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      const raced = await findFavoriteByUnique(input.userId, input.kind, input.entityId)
      if (raced) return { favorite: raced, created: false }
    }
    throw err
  }
}

// Owner-or-admin; 404 otherwise (never leak existence to non-owners).
export async function removeFavorite(input: { id: string; userId: string; role: string }): Promise<void> {
  const favorite = await findFavoriteById(input.id)
  if (!favorite) throw new NotFoundError("Favori introuvable")
  const isAdmin = input.role === "admin" || input.role === "super_admin"
  if (!isAdmin && favorite.userId !== input.userId) throw new NotFoundError("Favori introuvable")
  await deleteFavorite(input.id)
  try {
    await invalidateCache("favorites*")
  } catch {}
}
