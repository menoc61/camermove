// @ts-nocheck
import type { PrismaClient } from "@prisma/client"

/**
 * Corridor stop points (terminus + en-route dépôts) for the Yaoundé ⇄ Douala axis.
 * Mirrors the real N3 "route de l'Est" (Yaoundé — Mvan — Makak — Eséka — Somalama — Edéa — Douala).
 * offsetMinutes = ETA after the trip's departureAt at that stop.
 * Idempotent: upserts on @@unique([routeId, name]) for every route on this axis.
 */
const CORRIDOR_YDE_DLA: Array<{ name: string; kind: string; stopOrder: number; offsetMinutes: number }> = [
  { name: "Yaoundé Terminus Mimboman", kind: "terminus", stopOrder: 0, offsetMinutes: 0 },
  { name: "Mvan (Dépôt)", kind: "depo", stopOrder: 1, offsetMinutes: 25 },
  { name: "Makak (Dépôt)", kind: "depo", stopOrder: 2, offsetMinutes: 110 },
  { name: "Eséka (Dépôt)", kind: "depo", stopOrder: 3, offsetMinutes: 175 },
  { name: "Somalama", kind: "stop", stopOrder: 4, offsetMinutes: 210 },
  { name: "Edéa (Dépôt)", kind: "depo", stopOrder: 5, offsetMinutes: 240 },
  { name: "Douala Terminus", kind: "terminus", stopOrder: 6, offsetMinutes: 285 },
]

const CORRIDOR_DLA_YDE: Array<{ name: string; kind: string; stopOrder: number; offsetMinutes: number }> = [
  { name: "Douala Terminus", kind: "terminus", stopOrder: 0, offsetMinutes: 0 },
  { name: "Edéa (Dépôt)", kind: "depo", stopOrder: 1, offsetMinutes: 45 },
  { name: "Somalama", kind: "stop", stopOrder: 2, offsetMinutes: 80 },
  { name: "Eséka (Dépôt)", kind: "depo", stopOrder: 3, offsetMinutes: 110 },
  { name: "Makak (Dépôt)", kind: "depo", stopOrder: 4, offsetMinutes: 175 },
  { name: "Mvan (Dépôt)", kind: "depo", stopOrder: 5, offsetMinutes: 260 },
  { name: "Yaoundé Terminus Mimboman", kind: "terminus", stopOrder: 6, offsetMinutes: 285 },
]

export async function seedCorridorStops(prisma: PrismaClient): Promise<number> {
  const routes = await prisma.route.findMany({
    where: {
      OR: [
        { originCity: "Yaoundé", destinationCity: "Douala" },
        { originCity: "Douala", destinationCity: "Yaoundé" },
      ],
    },
    select: { id: true, originCity: true },
  })
  let count = 0
  for (const route of routes) {
    const stops = route.originCity === "Yaoundé" ? CORRIDOR_YDE_DLA : CORRIDOR_DLA_YDE
    for (const s of stops) {
      await prisma.routeStop.upsert({
        where: { routeId_name: { routeId: route.id, name: s.name } },
        update: { kind: s.kind, stopOrder: s.stopOrder, offsetMinutes: s.offsetMinutes },
        create: { routeId: route.id, ...s },
      })
      count++
    }
  }
  return count
}
