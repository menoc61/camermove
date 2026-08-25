import { z } from "zod"
import { ForbiddenError, NotFoundError } from "@camermove/config"

export const TripStatusActionSchema = z.object({ action: z.enum(["pause", "close", "reopen"]) })

// Server-side whitelist: clients supply an action enum, never a raw status string
export const TRIP_ACTION_TO_STATUS = {
  pause: "paused",
  close: "closed",
  reopen: "active",
} as const

export type TripStatusAction = keyof typeof TRIP_ACTION_TO_STATUS

export async function setTripStatus(input: {
  tripId: string
  action: TripStatusAction
  actor: { id: string; role: string }
}) {
  const { prisma } = await import("@camermove/db")
  const trip = await prisma.trip.findUnique({ where: { id: input.tripId } })
  if (!trip) throw new NotFoundError("Trajet introuvable")

  if (input.actor.role === "transporter_staff") {
    // Ownership enforcement: staff may only mutate trips of their own transporter
    const user = await prisma.user.findUnique({
      where: { id: input.actor.id },
      select: { transporterId: true },
    })
    if (!user?.transporterId || user.transporterId !== trip.transportId) throw new ForbiddenError("Accès refusé")
  } else if (input.actor.role !== "admin" && input.actor.role !== "super_admin") {
    throw new ForbiddenError("Accès refusé")
  }

  const from = trip.status
  const to = TRIP_ACTION_TO_STATUS[input.action]
  const updated = await prisma.trip.update({ where: { id: trip.id }, data: { status: to } })

  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor.id,
        action: "trip.status",
        entityType: "Trip",
        entityId: trip.id,
        metadata: { from, to, actorId: input.actor.id, role: input.actor.role } as never,
      },
    })
  } catch {}

  return { id: updated.id, status: updated.status }
}
