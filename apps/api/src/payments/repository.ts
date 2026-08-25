import { prisma } from "@camermove/db"

export async function findPaymentById(id: string) {
  return prisma.payment.findUnique({ where: { id }, include: { booking: { include: { trip: true } } } })
}

export async function findPaymentByProviderRef(provider: string, providerRef: string) {
  return prisma.payment.findFirst({ where: { provider: provider as never, providerRef } })
}

export async function findPendingPaymentByBookingId(bookingId: string) {
  return prisma.payment.findFirst({
    where: { bookingId, status: { in: ["pending", "processing"] as never } },
  })
}

export async function listPayments(
  where: Record<string, unknown>,
  opts: { skip: number; take: number; orderBy?: Record<string, unknown>[] | Record<string, unknown> },
) {
  const [data, total] = await Promise.all([
    prisma.payment.findMany({ where: where as never, skip: opts.skip, take: opts.take, orderBy: opts.orderBy as never, include: { booking: true } }),
    prisma.payment.count({ where: where as never }),
  ])
  return { data, total }
}

export async function createPaymentRecord(data: {
  bookingId: string
  provider: string
  providerRef?: string | null
  amount: number
  currency?: string
  method?: string
  status?: string
  webhookPayload?: unknown
}) {
  return prisma.payment.create({
    data: {
      bookingId: data.bookingId,
      provider: data.provider as never,
      providerRef: data.providerRef ?? null,
      amount: data.amount,
      currency: data.currency ?? "XAF",
      method: (data.method as never) ?? "mobile_money",
      status: (data.status as never) ?? "pending",
      webhookPayload: data.webhookPayload as never,
    },
  })
}

export async function findPendingPaymentsOlderThan(minutes: number) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000)
  return prisma.payment.findMany({ where: { status: { in: ["pending", "processing"] as never }, createdAt: { lt: cutoff } } })
}
