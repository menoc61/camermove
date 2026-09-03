import { prisma, Prisma } from "@camermove/db"

export type ParcelWhereInput = Prisma.ParcelWhereInput

export function buildParcelWhere(input: {
  userId?: string
  recipientCity?: string
  status?: string
  q?: string
  dateFrom?: string
  dateTo?: string
}): ParcelWhereInput {
  const where: ParcelWhereInput = {}
  if (input.userId) where.userId = input.userId
  if (input.recipientCity) where.recipientCity = { contains: input.recipientCity, mode: "insensitive" }
  if (input.status) where.status = input.status as never
  if (input.q) {
    where.OR = [
      { senderName: { contains: input.q, mode: "insensitive" } },
      { recipientName: { contains: input.q, mode: "insensitive" } },
      { trackingNumber: { contains: input.q, mode: "insensitive" } },
      { senderCity: { contains: input.q, mode: "insensitive" } },
      { recipientCity: { contains: input.q, mode: "insensitive" } },
      { description: { contains: input.q, mode: "insensitive" } },
    ]
  }
  if (input.dateFrom || input.dateTo) {
    where.createdAt = {}
    if (input.dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(input.dateFrom)
    if (input.dateTo) (where.createdAt as Record<string, Date>).lte = new Date(input.dateTo + "T23:59:59Z")
  }
  return where
}

export async function findParcels(
  where: ParcelWhereInput,
  skip: number,
  take: number,
  orderBy?: Prisma.ParcelOrderByWithRelationInput,
) {
  return prisma.parcel.findMany({
    where,
    include: { statusHistory: { orderBy: { createdAt: "asc" } } },
    skip,
    take,
    orderBy: orderBy ?? { createdAt: "desc" },
  })
}

export async function countParcels(where: ParcelWhereInput) {
  return prisma.parcel.count({ where })
}

export async function findParcelById(id: string) {
  return prisma.parcel.findUnique({
    where: { id },
    include: { statusHistory: { orderBy: { createdAt: "asc" } }, payment: true },
  })
}

export async function findParcelByTrackingNumber(trackingNumber: string) {
  return prisma.parcel.findUnique({
    where: { trackingNumber },
    include: { statusHistory: { orderBy: { createdAt: "asc" } } },
  })
}
