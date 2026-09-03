import { prisma, Prisma } from "@camermove/db"

export type HotelSearchWhereInput = Prisma.HotelWhereInput

export function buildHotelWhere(input: {
  city?: string
  minPrice?: number
  maxPrice?: number
  q?: string
  status?: string
}): HotelSearchWhereInput {
  const where: HotelSearchWhereInput = {}
  if (input.status) where.status = input.status
  else where.status = "active"
  if (input.city) where.city = { contains: input.city, mode: "insensitive" }
  if (input.q) {
    where.OR = [
      { name: { contains: input.q, mode: "insensitive" } },
      { description: { contains: input.q, mode: "insensitive" } },
      { city: { contains: input.q, mode: "insensitive" } },
    ]
  }
  if (input.minPrice != null || input.maxPrice != null) {
    where.rooms = {
      some: {
        pricePerNight: {
          ...(input.minPrice != null ? { gte: input.minPrice } : {}),
          ...(input.maxPrice != null ? { lte: input.maxPrice } : {}),
        },
      },
    }
  }
  return where
}

export async function findHotels(where: HotelSearchWhereInput, skip: number, take: number, orderBy?: Prisma.HotelOrderByWithRelationInput) {
  return prisma.hotel.findMany({
    where,
    include: {
      rooms: { select: { id: true, name: true, pricePerNight: true, capacity: true, amenities: true, quantity: true, status: true } },
    },
    skip,
    take,
    orderBy: orderBy ?? { createdAt: "desc" },
  })
}

export async function countHotels(where: HotelSearchWhereInput) {
  return prisma.hotel.count({ where })
}

export async function findHotelById(id: string) {
  return prisma.hotel.findUnique({
    where: { id },
    include: { rooms: true },
  })
}
