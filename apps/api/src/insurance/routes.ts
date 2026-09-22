import type { FastifyInstance } from "fastify"
import { prisma } from "@camermove/db"
import { loadEnv, NotFoundError } from "@camermove/config"
import { CreatePolicyBody, InsuranceSearchQuery, PolicyParams, PolicyPayBody } from "./schema.js"
import { buildInsuranceWhere, countPolicies, findPolicies, findPolicyById } from "./repository.js"
import { createPolicy, createPolicyPayment, getPolicy, cancelInsurancePolicy } from "./service.js"
import { getCached, setCached, cacheKey } from "../lib/cache.js"
import { parseExportQuery, sendExport } from "../lib/export.js"
import { buildPagination } from "../lib/query.js"
import { observeInsurance } from "@camermove/observability"
import { parseAdminSort } from "../admin/service.js"

const EXPORT_COLUMNS = ["id", "policyNumber", "userId", "destination", "coverageType", "travelers", "premium", "currency", "status", "startDate", "endDate", "createdAt"]
const ORDERABLE_FIELDS = ["createdAt", "premium", "destination", "startDate", "endDate"]

function parseOrderBy(orderBy?: string): Record<string, unknown> | undefined {
  if (!orderBy) return undefined
  const [field, dir] = orderBy.split(",")[0]!.trim().split(".")
  const d = dir === "desc" ? "desc" : "asc"
  if (ORDERABLE_FIELDS.includes(field!)) return { [field!]: d }
  return { createdAt: d }
}

export async function insuranceRoutes(app: FastifyInstance) {
  const env = loadEnv()
  const auth = (app as unknown as { requireAuth: (role?: string) => unknown }).requireAuth

  // GET /insurance/policies — owner list, paginated, cached 60s
  app.get("/insurance/policies", { preHandler: auth() as never }, async (req) => {
    const q = InsuranceSearchQuery.parse(req.query)
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const user = (req as unknown as { user: { id: string } }).user
    const pagination = buildPagination({ page: q.page, perPage: q.perPage, limit: q.limit, offset: q.offset })
    req.log.info(
      { ...meta, q: q.q, coverageType: q.coverageType, dateFrom: q.dateFrom, dateTo: q.dateTo, page: q.page, limit: q.perPage, userId: user.id },
      "insurance.policies.list",
    )
    const where = buildInsuranceWhere({ userId: user.id, coverageType: q.coverageType, q: q.q, dateFrom: q.dateFrom, dateTo: q.dateTo })

    const key = cacheKey("insurance-policies", {
      userId: user.id,
      q: q.q ?? "",
      coverageType: q.coverageType ?? "",
      dateFrom: q.dateFrom ?? "",
      dateTo: q.dateTo ?? "",
      page: String(pagination.page ?? q.page),
      perPage: String(pagination.take),
      orderBy: q.orderBy ?? "",
    })
    const cached = await getCached<{ items: unknown[]; total: number; page: number; perPage: number; totalPages: number }>(key)
    if (cached) return { ...cached, meta: { cached: true } }

    const skip = pagination.skip
    const take = pagination.take
    const [items, total] = await Promise.all([findPolicies(where, skip, take, parseOrderBy(q.orderBy) as never), countPolicies(where)])
    const page = pagination.page ?? q.page
    const perPage = pagination.take
    const result = { items, total, page, perPage, totalPages: Math.ceil(total / perPage), meta: { cached: false } }
    await setCached(key, { items, total, page, perPage, totalPages: result.totalPages } as unknown as Record<string, unknown>, 60).catch(() => {})
    return result
  })

  // GET /insurance/policies/export — owner (admin sees all), streamed csv/json
  app.get("/insurance/policies/export", { preHandler: auth() as never }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const query = req.query as Record<string, unknown>
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, userId: user.id, dateFrom, dateTo, format }, "insurance.policies.export")
    const isAdmin = user.role === "admin" || user.role === "super_admin"
    const where = buildInsuranceWhere({
      userId: isAdmin ? undefined : user.id,
      coverageType: query.coverageType as string | undefined,
      q: query.q as string | undefined,
      dateFrom,
      dateTo,
    })
    const rows = await prisma.insurancePolicy.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" } /* stable export order */ })
    return sendExport(reply, "insurance-policies", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], EXPORT_COLUMNS)
  })

  // POST /insurance/policies — 201
  app.post("/insurance/policies", { preHandler: auth() as never }, async (req, reply) => {
    const body = CreatePolicyBody.parse(req.body)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info(
      { ...meta, userId: user.id, destination: body.destination, coverageType: body.coverageType, travelers: body.travelersCount },
      "insurance.policy.create",
    )
    const policy = await createPolicy({
      userId: user.id,
      destination: body.destination,
      startDate: body.startDate,
      endDate: body.endDate,
      travelersCount: body.travelersCount,
      coverageType: body.coverageType,
      meta: { ip: meta.ip, os: meta.os, browser: meta.browser, device: meta.device, userId: user.id } as Record<string, unknown>,
    })
    observeInsurance(body.coverageType)
    return reply.code(201).send(policy)
  })

  // POST /insurance/policies/:id/pay — owner pay flow
  app.post("/insurance/policies/:id/pay", { preHandler: auth() as never }, async (req) => {
    const { id } = PolicyParams.parse(req.params)
    const body = PolicyPayBody.parse((req.body ?? {}) as unknown)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, policyId: id, provider: body.provider, userId: user.id }, "insurance.policy.pay")
    return createPolicyPayment({ policyId: id, userId: user.id, provider: body.provider, phone: body.phone, email: body.email, method: body.method, meta: meta as Record<string, unknown> })
  })

  // POST /insurance/policies/:id/cancel — owner or admin, pending_payment only
  app.post("/insurance/policies/:id/cancel", { preHandler: auth() as never }, async (req) => {
    const { id } = PolicyParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, entityId: id, userId: user.id }, "insurance.policy.cancel")
    await cancelInsurancePolicy(id, user.id, user.role)
    return { id, status: "cancelled" }
  })

  // GET /insurance/policies/:id — owner-scoped
  app.get("/insurance/policies/:id", { preHandler: auth() as never }, async (req) => {
    const { id } = PolicyParams.parse(req.params)
    const user = (req as unknown as { user: { id: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, entityId: id, userId: user.id }, "insurance.policy.get")
    return getPolicy(id, user.id)
  })

  // GET /admin/insurance/policies — admin list, paginated
  app.get("/admin/insurance/policies", { preHandler: auth("admin") as never }, async (req) => {
    const q = InsuranceSearchQuery.parse(req.query)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    const pagination = buildPagination({ page: q.page, perPage: q.perPage, limit: q.limit, offset: q.offset })
    req.log.info(
      { ...meta, actorId: user.id, role: user.role, q: q.q, coverageType: q.coverageType, dateFrom: q.dateFrom, dateTo: q.dateTo, page: q.page, limit: q.perPage },
      "insurance.admin.list",
    )
    const where = buildInsuranceWhere({ coverageType: q.coverageType, q: q.q, dateFrom: q.dateFrom, dateTo: q.dateTo })
    const skip = pagination.skip
    const take = pagination.take
    const orderBy = q.sort
      ? parseAdminSort(q.sort, ["createdAt", "premium", "destination", "startDate", "endDate", "status"], { createdAt: "desc" })
      : parseOrderBy(q.orderBy)
    const [items, total] = await Promise.all([findPolicies(where, skip, take, orderBy as never), countPolicies(where)])
    const page = pagination.page ?? q.page
    const perPage = pagination.take
    return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) }
  })

  // GET /admin/insurance/policies/export — admin export over all policies
  app.get("/admin/insurance/policies/export", { preHandler: auth("admin") as never }, async (req, reply) => {
    const { dateFrom, dateTo, format } = parseExportQuery(req.query as Record<string, unknown>)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const query = req.query as Record<string, unknown>
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, actorId: user.id, role: user.role, dateFrom, dateTo, format }, "insurance.admin.export")
    const where = buildInsuranceWhere({
      coverageType: query.coverageType as string | undefined,
      q: query.q as string | undefined,
      dateFrom,
      dateTo,
    })
    const rows = await prisma.insurancePolicy.findMany({ where: where as never, take: env.SEARCH_MAX_LIMIT, orderBy: { createdAt: "desc" } /* stable export order */ })
    return sendExport(reply, "insurance-policies", dateFrom, dateTo, format, rows as unknown as Record<string, unknown>[], EXPORT_COLUMNS)
  })

  // GET /admin/insurance/policies/:id — admin single-policy view
  app.get("/admin/insurance/policies/:id", { preHandler: auth("admin") as never }, async (req) => {
    const { id } = PolicyParams.parse(req.params)
    const user = (req as unknown as { user: { id: string; role: string } }).user
    const meta = (req as unknown as { meta: Record<string, unknown> }).meta ?? {}
    req.log.info({ ...meta, actorId: user.id, role: user.role, entityId: id }, "insurance.admin.get")
    const policy = await findPolicyById(id)
    if (!policy) throw new NotFoundError("Police d'assurance introuvable")
    return policy
  })
}
