import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { FastifyInstance } from "fastify"
import { buildApp } from "../app"
import { loadEnv } from "@camermove/config"
import { signTokens } from "../auth/tokens"

let app: FastifyInstance
beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })

const MISSING = "c000000000000000000000001"

describe("rental deletes", () => {
  it("DELETE /partner/rentals/:id rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/rentals/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("DELETE /partner/rentals/:id route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/partner/rentals/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })

  it("authenticated traveler DELETE missing id returns 404 (NotFound before owner-check)", async () => {
    const { accessToken } = signTokens({ id: "no-such-user", role: "traveler" }, loadEnv())
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/partner/rentals/${MISSING}`,
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty("message", expect.stringContaining("Véhicule introuvable"))
  })
})

describe("DELETE /admin/rentals/:id", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/admin/rentals/${MISSING}` })
    expect(res.statusCode).toBe(401)
  })

  it("route exists", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/v1/admin/rentals/${MISSING}` })
    expect(res.json()).not.toHaveProperty("message", expect.stringContaining("not found"))
  })
})

describe("rental delete guards (authenticated)", () => {
  const createdUserIds: string[] = []
  const createdVehicleIds: string[] = []

  async function createStaff(prefix: string): Promise<{ id: string; token: string }> {
    const env = loadEnv()
    const { prisma } = await import("@camermove/db")
    const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.cm`
    const created = await prisma.user.create({
      data: { email, passwordHash: "x", role: "transporter_staff" },
    })
    createdUserIds.push(created.id)
    const { accessToken } = signTokens({ id: created.id, role: "transporter_staff" }, env)
    return { id: created.id, token: accessToken }
  }

  function vehicleBody() {
    return { make: "Toyota", model: "Hiace", category: "van", capacity: 14, pricePerUnit: 50000, pickupCity: "Douala" }
  }

  afterAll(async () => {
    const { prisma } = await import("@camermove/db")
    for (const vid of createdVehicleIds) {
      await prisma.rentalBooking.deleteMany({ where: { rentalVehicleId: vid } }).catch(() => {})
      await prisma.auditLog.deleteMany({ where: { entityId: vid } }).catch(() => {})
      await prisma.rentalVehicle.delete({ where: { id: vid } }).catch(() => {})
    }
    for (const uid of createdUserIds) {
      await prisma.auditLog.deleteMany({ where: { actorId: uid } }).catch(() => {})
      await prisma.user.delete({ where: { id: uid } }).catch(() => {})
    }
  })

  it("owner deletes own vehicle → 200 {deleted:true}", async () => {
    const { token } = await createStaff("rental-owner")
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/partner/rentals",
      headers: { authorization: `Bearer ${token}` },
      payload: vehicleBody(),
    })
    expect(created.statusCode).toBe(201)
    const vehicle = created.json() as { id: string }
    createdVehicleIds.push(vehicle.id)
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/partner/rentals/${vehicle.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ deleted: true })
  })

  it("non-owner staff → 403", async () => {
    const a = await createStaff("rental-ownera")
    const b = await createStaff("rental-ownerb")
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/partner/rentals",
      headers: { authorization: `Bearer ${a.token}` },
      payload: vehicleBody(),
    })
    expect(created.statusCode).toBe(201)
    const vehicle = created.json() as { id: string }
    createdVehicleIds.push(vehicle.id)
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/partner/rentals/${vehicle.id}`,
      headers: { authorization: `Bearer ${b.token}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it("missing id with staff token → 404", async () => {
    const { token } = await createStaff("rental-missing")
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/partner/rentals/${MISSING}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty("message", expect.stringContaining("Véhicule introuvable"))
  })
})
