import type { PrismaClient } from "@camermove/db"
import type { ApplicationInputT } from "./schema"

type DbClient = PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export async function findUserById(db: DbClient, userId: string) {
  return (db as PrismaClient).user.findUnique({ where: { id: userId } })
}

export async function findTransporterByEmail(db: DbClient, email: string) {
  return (db as PrismaClient).transporter.findUnique({ where: { email } })
}

export async function createApplicationWithTransporter(
  db: PrismaClient,
  userId: string,
  userEmail: string,
  input: ApplicationInputT,
): Promise<{ id: string; status: "received" }> {
  return db.$transaction(async (tx) => {
    const transporter = await tx.transporter.create({
      data: {
        companyName: input.companyName,
        contactName: input.contactName,
        phone: input.phone,
        email: userEmail,
        city: input.city,
        transportType: input.transportType,
        vehicleCount: input.vehicleCount ?? 0,
        servedRoutes: input.routesServed,
        status: "pending",
      },
    })
    const created = await tx.partnerApplication.create({
      data: {
        companyName: input.companyName,
        contactName: input.contactName,
        phone: input.phone,
        email: userEmail,
        city: input.city,
        transportType: input.transportType,
        vehicleCount: input.vehicleCount,
        routesServed: input.routesServed,
        message: input.message,
        status: "received",
        transporterId: transporter.id,
      },
    })
    await tx.document.createMany({
      data: input.documents.map((d) => ({
        type: d.type,
        objectKey: d.objectKey,
        mimetype: d.mimetype,
        size: d.size,
        transporterId: transporter.id,
        partnerApplicationId: created.id,
      })),
    })
    await tx.user.update({ where: { id: userId }, data: { transporterId: transporter.id } })
    return { id: created.id, status: created.status as "received" }
  })
}

export async function findMyApplicationRow(db: DbClient, transporterId: string) {
  return (db as PrismaClient).partnerApplication.findFirst({
    where: { transporterId },
    orderBy: { createdAt: "desc" },
    include: { documents: { select: { type: true, size: true, mimetype: true, createdAt: true } } },
  })
}

export async function listApplicationsForExport(
  db: DbClient,
  params: { dateFrom?: string; dateTo?: string; limit: number; transporterId?: string },
) {
  const where: Record<string, unknown> = {}
  if (params.transporterId) where.transporterId = params.transporterId
  if (params.dateFrom || params.dateTo) {
    const createdAt: Record<string, Date> = {}
    if (params.dateFrom) createdAt.gte = new Date(params.dateFrom)
    if (params.dateTo) createdAt.lte = new Date(params.dateTo + "T23:59:59Z")
    where.createdAt = createdAt
  }
  return (db as PrismaClient).partnerApplication.findMany({
    where: where as never,
    take: params.limit,
    orderBy: { createdAt: "desc" },
  })
}
