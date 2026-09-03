// @ts-nocheck
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"

const CreateInsuranceSchema = z.object({
  destination: z.string().min(2),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelersCount: z.coerce.number().int().min(1).max(20),
  coverageType: z.enum(["basic", "standard", "premium", "family"]),
})

const COVERAGE_PRICES: Record<string, number> = {
  basic: 2500,
  standard: 5000,
  premium: 10000,
  family: 15000,
}

export async function insuranceRoutes(app: FastifyInstance) {
  app.get("/insurance/policies", { preHandler: app.requireAuth() }, async (req) => {
    const userId = (req as unknown as { user: { id: string } }).user.id
    return prisma.insurancePolicy.findMany({
      where: { userId } as never,
      orderBy: { createdAt: "desc" },
    })
  })

  app.post("/insurance/policies", { preHandler: app.requireAuth() }, async (req, reply) => {
    const body = CreateInsuranceSchema.parse(req.body)
    const userId = (req as unknown as { user: { id: string } }).user.id
    const pricePerTraveler = COVERAGE_PRICES[body.coverageType] ?? 2500
    const premium = pricePerTraveler * body.travelersCount
    const policy = await prisma.insurancePolicy.create({
      data: {
        userId,
        providerName: "CamerMove Assurance",
        destination: body.destination,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        travelers: body.travelersCount,
        coverageType: body.coverageType as never,
        premium,
        policyNumber: `INS-${Date.now().toString(36).toUpperCase()}`,
      } as never,
    })
    return reply.code(201).send(policy)
  })

  app.get("/insurance/policies/:id", { preHandler: app.requireAuth() }, async (req) => {
    const { id } = req.params as { id: string }
    const userId = (req as unknown as { user: { id: string } }).user.id
    const policy = await prisma.insurancePolicy.findFirst({ where: { id, userId } as never })
    if (!policy) {
      const { NotFoundError } = await import("@camermove/config")
      throw new NotFoundError("Police d'assurance introuvable")
    }
    return policy
  })
}
