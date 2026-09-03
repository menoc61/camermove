// @ts-nocheck
import { prisma } from "@camermove/db"
import { NotFoundError, ForbiddenError, ConflictError, loadEnv } from "@camermove/config"
import type { Prisma } from "@prisma/client"

// ─── Users ──────────────────────────────────────────────────────────────────

export async function listUsers(params: {
  page: number; limit: number; q?: string; role?: string; status?: string;
  dateFrom?: string; dateTo?: string;
}) {
  const env = loadEnv()
  const take = params.limit
  const skip = (params.page - 1) * take
  const where: Prisma.UserWhereInput = {}
  if (params.q) {
    where.OR = [
      { email: { contains: params.q, mode: "insensitive" } },
      { firstName: { contains: params.q, mode: "insensitive" } },
      { lastName: { contains: params.q, mode: "insensitive" } },
      { phone: { contains: params.q, mode: "insensitive" } },
    ]
  }
  if (params.role) where.role = params.role as Prisma.EnumRoleFilter["equals"]
  if (params.status) where.status = params.status
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {}
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom)
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo + "T23:59:59Z")
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, status: true, createdAt: true, _count: { select: { bookings: true } } } }),
    prisma.user.count({ where }),
  ])
  return { items, total, page: params.page, totalPages: Math.ceil(total / take) }
}

export async function getUser(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, include: { transporter: true, _count: { select: { bookings: true, auditLogs: true } } } })
  if (!u) throw new NotFoundError("Utilisateur introuvable")
  return u
}

export async function updateUser(id: string, actorId: string, data: { role?: string; status?: string; firstName?: string | null; lastName?: string | null; phone?: string | null }) {
  const u = await prisma.user.findUnique({ where: { id } })
  if (!u) throw new NotFoundError("Utilisateur introuvable")
  // Prevent demoting the last super_admin
  if (data.role && data.role !== "super_admin") {
    const superAdminCount = await prisma.user.count({ where: { role: "super_admin" } })
    if (u.role === "super_admin" && superAdminCount <= 1) throw new ConflictError("Impossible de retirer le dernier super_admin")
  }
  const updated = await prisma.user.update({ where: { id }, data })
  await prisma.auditLog.create({
    data: { actorId, action: "admin.user.update", entityType: "User", entityId: id, metadata: data as never },
  }).catch(() => {})
  return updated
}

export async function deleteUser(id: string, actorId: string) {
  const u = await prisma.user.findUnique({ where: { id } })
  if (!u) throw new NotFoundError("Utilisateur introuvable")
  if (u.role === "super_admin") throw new ForbiddenError("Impossible de supprimer un super_admin")
  await prisma.auditLog.create({
    data: { actorId, action: "admin.user.delete", entityType: "User", entityId: id },
  }).catch(() => {})
  return prisma.user.delete({ where: { id } })
}

// ─── Transporters ──────────────────────────────────────────────────────────

export async function listTransporters(params: {
  page: number; limit: number; q?: string; status?: string;
  dateFrom?: string; dateTo?: string;
}) {
  const take = params.limit
  const skip = (params.page - 1) * take
  const where: Prisma.TransporterWhereInput = {}
  if (params.q) {
    where.OR = [
      { companyName: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
      { city: { contains: params.q, mode: "insensitive" } },
    ]
  }
  if (params.status) where.status = params.status as Prisma.EnumTransporterStatusFilter["equals"]
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {}
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom)
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo + "T23:59:59Z")
  }

  const [items, total] = await Promise.all([
    prisma.transporter.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      include: { _count: { select: { vehicles: true, routes: true, trips: true, staffUsers: true } } },
    }),
    prisma.transporter.count({ where }),
  ])
  return { items, total, page: params.page, totalPages: Math.ceil(total / take) }
}

export async function getTransporter(id: string) {
  const t = await prisma.transporter.findUnique({
    where: { id },
    include: { vehicles: true, routes: true, trips: { take: 10, orderBy: { departureAt: "desc" } }, documents: true, partnerApplication: true, _count: { select: { staffUsers: true } } },
  })
  if (!t) throw new NotFoundError("Transporteur introuvable")
  return t
}

export async function updateTransporter(id: string, actorId: string, data: { status?: string; vehicleCount?: number }) {
  const t = await prisma.transporter.findUnique({ where: { id } })
  if (!t) throw new NotFoundError("Transporteur introuvable")
  const updated = await prisma.transporter.update({ where: { id }, data })
  await prisma.auditLog.create({
    data: { actorId, action: "admin.transporter.update", entityType: "Transporter", entityId: id, metadata: data as never },
  }).catch(() => {})
  return updated
}

// ─── Partner Applications ──────────────────────────────────────────────────

export async function listPartnerApplications(params: { page: number; limit: number; q?: string; status?: string }) {
  const take = params.limit
  const skip = (params.page - 1) * take
  const where: Prisma.PartnerApplicationWhereInput = {}
  if (params.q) {
    where.OR = [
      { companyName: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
    ]
  }
  if (params.status) where.status = params.status as Prisma.EnumPartnerApplicationStatusFilter["equals"]

  const [items, total] = await Promise.all([
    prisma.partnerApplication.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      include: { documents: true, transporter: true },
    }),
    prisma.partnerApplication.count({ where }),
  ])
  return { items, total, page: params.page, totalPages: Math.ceil(total / take) }
}

export async function reviewPartnerApplication(id: string, actorId: string, data: { status: string; message?: string }) {
  const app = await prisma.partnerApplication.findUnique({ where: { id } })
  if (!app) throw new NotFoundError("Candidature introuvable")

  let transporterId = app.transporterId
  const updateData: Prisma.PartnerApplicationUpdateInput = { status: data.status as never }
  if (data.status === "validated" && !transporterId) {
    // Create the transporter and link staff
    const t = await prisma.transporter.create({
      data: {
        companyName: app.companyName,
        contactName: app.contactName,
        phone: app.phone,
        email: app.email,
        city: app.city ?? undefined,
        transportType: app.transportType ?? undefined,
        vehicleCount: app.vehicleCount ?? 0,
        servedRoutes: app.routesServed,
        status: "approved",
        staffUsers: app.contactName ? { connect: [] } : undefined,
      },
    })
    transporterId = t.id
    updateData.transporter = { connect: { id: t.id } }
  }
  if (data.status === "approved") {
    await prisma.transporter.update({ where: { id: transporterId! }, data: { status: "approved" } }).catch(() => {})
  }
  if (data.status === "rejected") {
    await prisma.transporter.update({ where: { id: transporterId! }, data: { status: "rejected" } }).catch(() => {})
  }

  const updated = await prisma.partnerApplication.update({ where: { id }, data: updateData })
  await prisma.auditLog.create({
    data: { actorId, action: `admin.partner-application.${data.status}`, entityType: "PartnerApplication", entityId: id, metadata: { message: data.message } as never },
  }).catch(() => {})
  return updated
}

// ─── Trips ──────────────────────────────────────────────────────────────────

export async function listTrips(params: {
  page: number; limit: number; q?: string; status?: string;
  transporterId?: string; dateFrom?: string; dateTo?: string;
}) {
  const take = params.limit
  const skip = (params.page - 1) * take
  const where: Prisma.TripWhereInput = {}
  if (params.q) {
    where.OR = [
      { route: { originCity: { contains: params.q, mode: "insensitive" } } },
      { route: { destinationCity: { contains: params.q, mode: "insensitive" } } },
      { vehicleTypeInfo: { contains: params.q, mode: "insensitive" } },
    ]
  }
  if (params.status) where.status = params.status
  if (params.transporterId) where.transportId = params.transporterId
  if (params.dateFrom || params.dateTo) {
    where.departureAt = {}
    if (params.dateFrom) where.departureAt.gte = new Date(params.dateFrom)
    if (params.dateTo) where.departureAt.lte = new Date(params.dateTo + "T23:59:59Z")
  }

  const [items, total] = await Promise.all([
    prisma.trip.findMany({
      where, skip, take, orderBy: { departureAt: "asc" },
      include: { route: true, vehicle: true, transport: { select: { id: true, companyName: true } }, seatAvailability: true, _count: { select: { bookings: true } } },
    }),
    prisma.trip.count({ where }),
  ])
  return { items, total, page: params.page, totalPages: Math.ceil(total / take) }
}

export async function updateTrip(id: string, actorId: string, data: { price?: number; totalSeats?: number; status?: string; departurePointInfo?: string | null; conditions?: string | null; cancellationPolicy?: string | null }) {
  const trip = await prisma.trip.findUnique({ where: { id } })
  if (!trip) throw new NotFoundError("Trajet introuvable")
  const updated = await prisma.trip.update({ where: { id }, data })
  await prisma.auditLog.create({
    data: { actorId, action: "admin.trip.update", entityType: "Trip", entityId: id, metadata: data as never },
  }).catch(() => {})
  return updated
}

export async function deleteTrip(id: string, actorId: string) {
  const trip = await prisma.trip.findUnique({ where: { id } })
  if (!trip) throw new NotFoundError("Trajet introuvable")
  await prisma.auditLog.create({
    data: { actorId, action: "admin.trip.delete", entityType: "Trip", entityId: id },
  }).catch(() => {})
  return prisma.trip.delete({ where: { id } })
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export async function listBookings(params: {
  page: number; limit: number; q?: string; status?: string;
  transporterId?: string; userId?: string; dateFrom?: string; dateTo?: string;
}) {
  const take = params.limit
  const skip = (params.page - 1) * take
  const where: Prisma.BookingWhereInput = {}
  if (params.q) {
    where.OR = [
      { reference: { contains: params.q, mode: "insensitive" } },
      { passengers: { some: { fullName: { contains: params.q, mode: "insensitive" } } } },
    ]
  }
  if (params.status) where.status = params.status as Prisma.EnumBookingStatusFilter["equals"]
  if (params.transporterId) where.trip = { transportId: params.transporterId }
  if (params.userId) where.userId = params.userId
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {}
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom)
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo + "T23:59:59Z")
  }

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      include: { trip: { include: { route: true, transport: { select: { id: true, companyName: true } } } }, user: { select: { id: true, email: true, firstName: true, lastName: true } }, passengers: true, payments: true },
    }),
    prisma.booking.count({ where }),
  ])
  return { items, total, page: params.page, totalPages: Math.ceil(total / take) }
}

// ─── Payments ───────────────────────────────────────────────────────────────

export async function listPayments(params: {
  page: number; limit: number; q?: string; status?: string;
  provider?: string; dateFrom?: string; dateTo?: string;
}) {
  const take = params.limit
  const skip = (params.page - 1) * take
  const where: Prisma.PaymentWhereInput = {}
  if (params.q) {
    where.OR = [
      { providerRef: { contains: params.q, mode: "insensitive" } },
      { booking: { reference: { contains: params.q, mode: "insensitive" } } },
    ]
  }
  if (params.status) where.status = params.status as Prisma.EnumPaymentStatusFilter["equals"]
  if (params.provider) where.provider = params.provider as Prisma.EnumPaymentProviderFilter["equals"]
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {}
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom)
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo + "T23:59:59Z")
  }

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      include: { booking: { select: { id: true, reference: true, totalAmount: true, user: { select: { email: true } } } } },
    }),
    prisma.payment.count({ where }),
  ])
  return { items, total, page: params.page, totalPages: Math.ceil(total / take) }
}

// ─── Commissions ────────────────────────────────────────────────────────────

export async function listCommissions(params: { page: number; limit: number; transporterId?: string; payoutStatus?: string; dateFrom?: string; dateTo?: string }) {
  const take = params.limit
  const skip = (params.page - 1) * take
  const where: Prisma.CommissionWhereInput = {}
  if (params.transporterId) where.booking = { trip: { transportId: params.transporterId } }
  if (params.payoutStatus) where.payoutStatus = params.payoutStatus
  if (params.dateFrom || params.dateTo) {
    where.booking = { ...(where.booking ?? {}), createdAt: {} }
    if (params.dateFrom) (where.booking as Prisma.BookingWhereInput).createdAt!.gte = new Date(params.dateFrom)
    if (params.dateTo) (where.booking as Prisma.BookingWhereInput).createdAt!.lte = new Date(params.dateTo + "T23:59:59Z")
  }

  const [items, total, sumResult] = await Promise.all([
    prisma.commission.findMany({
      where, skip, take, orderBy: { id: "desc" },
      include: { booking: { include: { trip: { include: { transport: { select: { id: true, companyName: true } } } } } } },
    }),
    prisma.commission.count({ where }),
    prisma.commission.aggregate({ where, _sum: { commissionAmount: true, netAmount: true } }),
  ])
  return { items, total, page: params.page, totalPages: Math.ceil(total / take), totals: { commission: sumResult._sum.commissionAmount ?? 0, net: sumResult._sum.netAmount ?? 0 } }
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export async function listAuditLogs(params: { page: number; limit: number; q?: string; actorId?: string; action?: string; dateFrom?: string; dateTo?: string }) {
  const take = params.limit
  const skip = (params.page - 1) * take
  const where: Prisma.AuditLogWhereInput = {}
  if (params.q) {
    where.OR = [
      { actor: { email: { contains: params.q, mode: "insensitive" } } },
      { entityId: { contains: params.q, mode: "insensitive" } },
      { action: { contains: params.q, mode: "insensitive" } },
    ]
  }
  if (params.actorId) where.actorId = params.actorId
  if (params.action) where.action = { contains: params.action, mode: "insensitive" }
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {}
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom)
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo + "T23:59:59Z")
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, email: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ])
  return { items, total, page: params.page, totalPages: Math.ceil(total / take) }
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getAdminStats() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

  const [
    totalUsers, newUsersToday, totalTransporters, approvedTransporters,
    pendingApplications, totalTrips, activeTrips, totalBookings,
    todayBookings, confirmedToday, pendingPayments,
    totalRevenue, totalCommissions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.transporter.count(),
    prisma.transporter.count({ where: { status: "approved" } }),
    prisma.partnerApplication.count({ where: { status: { in: ["received", "reviewing"] } } }),
    prisma.trip.count(),
    prisma.trip.count({ where: { status: "active" } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.booking.count({ where: { status: "confirmed", createdAt: { gte: today, lt: tomorrow } } }),
    prisma.payment.count({ where: { status: { in: ["pending", "processing"] } } }),
    prisma.booking.aggregate({ where: { status: "confirmed" }, _sum: { totalAmount: true } }),
    prisma.commission.aggregate({ where: {}, _sum: { commissionAmount: true } }),
  ])

  return {
    totalUsers,
    newUsersToday,
    totalTransporters,
    approvedTransporters,
    pendingApplications,
    totalTrips,
    activeTrips,
    totalBookings,
    todayBookings,
    confirmedToday,
    pendingPayments,
    totalRevenue: totalRevenue._sum.totalAmount ?? 0,
    totalCommissions: totalCommissions._sum.commissionAmount ?? 0,
  }
}
