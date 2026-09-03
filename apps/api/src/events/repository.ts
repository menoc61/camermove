import { prisma, Prisma } from "@camermove/db"

export type EventSearchWhereInput = Prisma.EventWhereInput

export function buildEventWhere(input: {
  search?: string
  city?: string
  eventType?: string
  dateFrom?: string
  dateTo?: string
  q?: string
}): EventSearchWhereInput {
  const where: EventSearchWhereInput = {}

  // Only published events: status on_sale/limited and partnerStatus approved (admin seul publie)
  where.status = { in: ["on_sale", "limited"] as never }
  where.partnerStatus = "approved"

  if (input.search) {
    where.name = { contains: input.search, mode: "insensitive" }
  }

  if (input.q) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND as never] : []),
      {
        OR: [
          { name: { contains: input.q, mode: "insensitive" } },
          { description: { contains: input.q, mode: "insensitive" } },
          { city: { contains: input.q, mode: "insensitive" } },
          { venue: { contains: input.q, mode: "insensitive" } },
        ],
      } as never,
    ] as never
  }

  if (input.city) {
    where.city = { contains: input.city, mode: "insensitive" }
  }

  if (input.eventType) {
    where.eventType = input.eventType as never
  }

  if (input.dateFrom || input.dateTo) {
    const startDate: Record<string, Date> = {}
    if (input.dateFrom) {
      const d = new Date(input.dateFrom)
      if (!Number.isNaN(d.getTime())) startDate.gte = d
    }
    if (input.dateTo) {
      const d = new Date(input.dateTo)
      if (!Number.isNaN(d.getTime())) {
        // include whole day
        const end = new Date(d)
        end.setHours(23, 59, 59, 999)
        startDate.lte = end
      }
    }
    if (Object.keys(startDate).length > 0) where.startDate = startDate as never
  }

  return where
}

export async function findEvents(
  where: EventSearchWhereInput,
  skip: number,
  take: number,
  orderBy?: Prisma.EventOrderByWithRelationInput,
) {
  return prisma.event.findMany({
    where,
    include: {
      ticketCategories: { select: { id: true, eventId: true, name: true, price: true, currency: true, quantity: true, sold: true, status: true } },
    },
    skip,
    take,
    orderBy: orderBy ?? { startDate: "asc" },
  })
}

export async function countEvents(where: EventSearchWhereInput) {
  return prisma.event.count({ where })
}

export async function findEventById(id: string) {
  return prisma.event.findUnique({
    where: { id },
    include: { ticketCategories: true },
  })
}

export async function findTicketCategoryById(id: string) {
  return prisma.ticketCategory.findUnique({ where: { id } })
}
