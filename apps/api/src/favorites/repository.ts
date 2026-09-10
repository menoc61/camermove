import { prisma } from "@camermove/db"
import type { Favorite } from "@camermove/db"

export type FavoriteRow = Favorite

export function buildFavoriteWhere(input: { userId: string }) {
  return { userId: input.userId }
}

export async function findFavorites(userId: string, skip: number, take: number) {
  return prisma.favorite.findMany({
    where: buildFavoriteWhere({ userId }),
    skip,
    take,
    orderBy: { createdAt: "desc" },
  })
}

export async function countFavorites(userId: string) {
  return prisma.favorite.count({ where: buildFavoriteWhere({ userId }) })
}

export async function findFavoriteByUnique(userId: string, kind: string, entityId: string) {
  return prisma.favorite.findFirst({ where: { userId, kind, entityId } })
}

export async function findFavoriteById(id: string) {
  return prisma.favorite.findFirst({ where: { id } })
}

export async function createFavorite(data: { userId: string; kind: string; entityId: string }) {
  return prisma.favorite.create({ data })
}

export async function deleteFavorite(id: string) {
  return prisma.favorite.delete({ where: { id } })
}
