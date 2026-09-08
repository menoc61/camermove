import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "@camermove/db"
import { NotFoundError } from "@camermove/config"
import { observeInsurance } from "@camermove/observability"

const CreateInsuranceSchema = z.object({
  destination: z.string().min(2),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelersCount: z.coerce.number().int().min(1).max(20),
  coverageType: z.enum(["basic", "standard", "premium", "family"]),
})

// Centralized so settings can override without redeploy later (AppSettings)
const COVERAGE_PRICES: Record<string, number> = {
  basic: 2500,
  standard: 5000,
  premium: 10000,
  family: 15000,
}

export async function insuranceRoutes(app: FastifyInstance) {
  app.get("/insurance/policies", { preHandler: app.requireAuth() }, async (req) => {
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, userId: user.id }, "insurance.policies.list")
    return prisma.insurancePolicy.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })
  })

  app.post("/insurance/policies", { preHandler: app.requireAuth() }, async (req, reply) => {
    const body = CreateInsuranceSchema.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const pricePerTraveler = COVERAGE_PRICES[body.coverageType] ?? 2500
    const premium = pricePerTraveler * body.travelersCount
    req.log.info(
      { ...meta, userId: user.id, destination: body.destination, coverageType: body.coverageType, travelers: body.travelersCount, premium },
      "insurance.policy.create",
    )
    const policy = await prisma.insurancePolicy.create({
      data: {
        userId: user.id,
        providerName: "CamerMove Assurance",
        destination: body.destination,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        travelers: body.travelersCount,
        coverageType: body.coverageType as never,
        premium,
        policyNumber: `INS-${Date.now().toString(36).toUpperCase()}`,
      },
    })
    observeInsurance(body.coverageType)
    return reply.code(201).send(policy)
  })

  app.get("/insurance/policies/:id", { preHandler: app.requireAuth() }, async (req) => {
    const { id } = (req as unknown as { params: { id: string } }).params
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, entityId: id, userId: user.id }, "insurance.policy.get")
    const policy = await prisma.insurancePolicy.findFirst({ where: { id, userId: user.id } as never })
    if (!policy) throw new NotFoundError("Police d'assurance introuvable")
    return policy
  })
}
