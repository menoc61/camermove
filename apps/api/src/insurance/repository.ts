import { prisma, Prisma } from "@camermove/db"

export type InsuranceWhereInput = Prisma.InsurancePolicyWhereInput

export function buildInsuranceWhere(input: {
  userId?: string
  coverageType?: string
  q?: string
  dateFrom?: string
  dateTo?: string
}): InsuranceWhereInput {
  const where: InsuranceWhereInput = {}
  if (input.userId) where.userId = input.userId
  if (input.coverageType) where.coverageType = input.coverageType as never
  if (input.q) {
    where.OR = [
      { destination: { contains: input.q, mode: "insensitive" } },
      { policyNumber: { contains: input.q, mode: "insensitive" } },
      { providerName: { contains: input.q, mode: "insensitive" } },
    ]
  }
  if (input.dateFrom || input.dateTo) {
    where.createdAt = {}
    if (input.dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(input.dateFrom)
    if (input.dateTo) (where.createdAt as Record<string, Date>).lte = new Date(input.dateTo + "T23:59:59Z")
  }
  return where
}

export async function findPolicies(
  where: InsuranceWhereInput,
  skip: number,
  take: number,
  orderBy?: Prisma.InsurancePolicyOrderByWithRelationInput,
) {
  return prisma.insurancePolicy.findMany({
    where,
    include: { payment: true },
    skip,
    take,
    orderBy: orderBy ?? { createdAt: "desc" },
  })
}

export async function countPolicies(where: InsuranceWhereInput) {
  return prisma.insurancePolicy.count({ where })
}

export async function findPolicyByIdForUser(id: string, userId: string) {
  return prisma.insurancePolicy.findFirst({
    where: { id, userId } as never,
    include: { payment: true },
  })
}

export async function findPolicyById(id: string) {
  return prisma.insurancePolicy.findUnique({
    where: { id },
    include: { payment: true },
  })
}
