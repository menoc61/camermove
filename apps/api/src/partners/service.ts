/**
 * Partner services resolution — a user can be a partner on one service
 * without being a partner on the others (hotel owner ≠ vehicle owner ≠
 * event organizer …). Ownership is derived from the data model:
 *
 *  - transporter : User.transporterId (interurban trips)
 *  - hotels      : Hotel.ownerId
 *  - rentals     : RentalVehicle.ownerId
 *  - parcels     : ParcelOperator.ownerId
 *  - events      : Event.organizerId
 *
 * Insurance has no partner/owner model (platform-provided) and is therefore
 * never listed here.
 *
 * Per AGENTS.md §2: handler logs req.meta + userId. Read-only endpoint — no
 * extra rate limit (global plugin applies), no AuditLog write on reads.
 */
import { prisma } from "@camermove/db"

export type PartnerServiceId = "transporter" | "hotels" | "rentals" | "parcels" | "events"

export interface PartnerServiceKpis {
  entities: number
  bookings?: number
  revenue?: number
  activeTrips?: number
  parcelsInTransit?: number
  parcelsDelivered?: number
}

export interface PartnerService {
  service: PartnerServiceId
  label: string
  href: string
  kpis: PartnerServiceKpis
}

export interface PartnerApplicationView {
  id: string
  status: string
  companyName: string
  createdAt: string
}

export interface PartnerServicesResponse {
  services: PartnerService[]
  application: PartnerApplicationView | null
}

const SERVICE_META: Record<PartnerServiceId, { label: string; href: string }> = {
  transporter: { label: "Transport (trajets)", href: "/transporter/dashboard" },
  hotels: { label: "Hôtels", href: "/partner/hotels" },
  rentals: { label: "Location de véhicules", href: "/partner/rentals" },
  parcels: { label: "Colis", href: "/partner/parcels" },
  events: { label: "Événements", href: "/partner/events" },
}

const ORDER: PartnerServiceId[] = ["transporter", "hotels", "rentals", "parcels", "events"]

export async function getPartnerServices(userId: string): Promise<PartnerServicesResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { transporterId: true },
  })
  if (!user) return { services: [], application: null }

  const [
    transporterStats,
    hotelStats,
    rentalStats,
    parcelOperatorStats,
    eventStats,
    application,
  ] = await Promise.all([
    user.transporterId
      ? prisma.trip
          .aggregate({ where: { transportId: user.transporterId }, _count: { _all: true } })
          .then(async (trips) => {
            const [bookings, revenue, activeTrips] = await Promise.all([
              prisma.booking.count({ where: { trip: { transportId: user.transporterId! }, status: { in: ["confirmed", "pending_payment"] } } }),
              prisma.booking.aggregate({ where: { trip: { transportId: user.transporterId! }, status: "confirmed" }, _sum: { totalAmount: true } }),
              prisma.trip.count({ where: { transportId: user.transporterId!, status: "active" } }),
            ])
            return { entities: trips._count._all, bookings, revenue: revenue._sum.totalAmount ?? 0, activeTrips }
          })
      : null,
    prisma.hotel.count({ where: { ownerId: userId } }).then(async (entities) => {
      if (entities === 0) return null
      const [bookings, revenue] = await Promise.all([
        prisma.hotelBooking.count({ where: { hotel: { ownerId: userId }, status: { in: ["confirmed", "pending_payment"] } } }),
        prisma.hotelBooking.aggregate({ where: { hotel: { ownerId: userId }, status: "confirmed" }, _sum: { totalAmount: true } }),
      ])
      return { entities, bookings, revenue: revenue._sum.totalAmount ?? 0 }
    }),
    prisma.rentalVehicle.count({ where: { ownerId: userId } }).then(async (entities) => {
      if (entities === 0) return null
      const [bookings, revenue] = await Promise.all([
        prisma.rentalBooking.count({ where: { vehicle: { ownerId: userId }, status: { in: ["confirmed", "active", "pending_payment"] } } }),
        prisma.rentalBooking.aggregate({ where: { vehicle: { ownerId: userId }, status: { in: ["confirmed", "active", "completed"] } }, _sum: { totalAmount: true } }),
      ])
      return { entities, bookings, revenue: revenue._sum.totalAmount ?? 0 }
    }),
    prisma.parcelOperator.count({ where: { ownerId: userId } }).then(async (entities) => {
      if (entities === 0) return null
      const [total, inTransit, delivered] = await Promise.all([
        prisma.parcel.count({ where: { operator: { ownerId: userId } } }),
        prisma.parcel.count({ where: { operator: { ownerId: userId }, status: { in: ["registered", "picked_up", "in_transit", "arrived", "available_for_pickup"] } } }),
        prisma.parcel.count({ where: { operator: { ownerId: userId }, status: "delivered" } }),
      ])
      return { entities, bookings: total, parcelsInTransit: inTransit, parcelsDelivered: delivered }
    }),
    prisma.event.count({ where: { organizerId: userId } }).then(async (entities) => {
      if (entities === 0) return null
      const [bookings, revenue] = await Promise.all([
        prisma.eventBooking.count({ where: { event: { organizerId: userId }, status: { in: ["confirmed", "pending_payment"] } } }),
        prisma.eventBooking.aggregate({ where: { event: { organizerId: userId }, status: "confirmed" }, _sum: { totalAmount: true } }),
      ])
      return { entities, bookings, revenue: revenue._sum.totalAmount ?? 0 }
    }),
    prisma.partnerApplication.findFirst({
      where: user.transporterId ? { transporterId: user.transporterId } : { email: (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, companyName: true, createdAt: true },
    }),
  ])

  const kpis: Partial<Record<PartnerServiceId, PartnerServiceKpis>> = {
    transporter: transporterStats ?? undefined,
    hotels: hotelStats ?? undefined,
    rentals: rentalStats ?? undefined,
    parcels: parcelOperatorStats ?? undefined,
    events: eventStats ?? undefined,
  }

  const services: PartnerService[] = ORDER.filter((id) => kpis[id] !== undefined).map((id) => ({
    service: id,
    label: SERVICE_META[id].label,
    href: SERVICE_META[id].href,
    kpis: kpis[id]!,
  }))

  return {
    services,
    application: application
      ? {
          id: application.id,
          status: application.status,
          companyName: application.companyName,
          createdAt: application.createdAt.toISOString(),
        }
      : null,
  }
}
