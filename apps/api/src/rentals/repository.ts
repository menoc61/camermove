import { prisma, Prisma } from "@camermove/db"

export type RentalVehicleWhereInput = Prisma.RentalVehicleWhereInput

export function buildRentalWhere(input: {
  pickupCity?: string
  category?: string
  hasDriver?: boolean
  minPrice?: number
  maxPrice?: number
  q?: string
  status?: string
}): RentalVehicleWhereInput {
  const where: RentalVehicleWhereInput = {}
  if (input.status) where.status = input.status as never
  else where.status = "available" as never
  if (input.pickupCity) where.pickupCity = { contains: input.pickupCity, mode: "insensitive" }
  if (input.category) where.category = { contains: input.category, mode: "insensitive" }
  if (input.hasDriver !== undefined) where.hasDriver = input.hasDriver
  if (input.q) {
    where.OR = [
      { make: { contains: input.q, mode: "insensitive" } },
      { model: { contains: input.q, mode: "insensitive" } },
      { category: { contains: input.q, mode: "insensitive" } },
      { pickupCity: { contains: input.q, mode: "insensitive" } },
    ]
  }
  if (input.minPrice != null || input.maxPrice != null) {
    where.pricePerUnit = {
      ...(input.minPrice != null ? { gte: input.minPrice } : {}),
      ...(input.maxPrice != null ? { lte: input.maxPrice } : {}),
    }
  }
  return where
}

export async function findRentals(
  where: RentalVehicleWhereInput,
  skip: number,
  take: number,
  orderBy?: Prisma.RentalVehicleOrderByWithRelationInput,
) {
  return prisma.rentalVehicle.findMany({
    where,
    skip,
    take,
    orderBy: orderBy ?? { createdAt: "desc" },
  })
}

export async function countRentals(where: RentalVehicleWhereInput) {
  return prisma.rentalVehicle.count({ where })
}

export async function findRentalById(id: string) {
  return prisma.rentalVehicle.findUnique({ where: { id } })
}
