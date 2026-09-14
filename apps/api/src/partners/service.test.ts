import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@camermove/db"
import { getPartnerServices } from "../partners/service"
import { reviewPartnerApplication } from "../admin/service"

// Fixture rows: User (traveler) -> PartnerApplication -> Transporter.
// Transporter has onDelete: SetNull from User; PartnerApplication is deleted
// first, then the transporter, then users (same order as partner-applications suite).
const createdUserIds: string[] = []
const createdEmails: string[] = []
const createdTransporterIds: string[] = []

afterAll(async () => {
  await prisma.partnerApplication.deleteMany({ where: { email: { in: createdEmails } } })
  await prisma.hotel.deleteMany({ where: { ownerId: { in: createdUserIds } } })
  await prisma.transporter.deleteMany({ where: { id: { in: createdTransporterIds } } })
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
})

async function testUser(email: string, role = "traveler") {
  const u = await prisma.user.create({ data: { email, passwordHash: "x", role: role as never } })
  createdUserIds.push(u.id)
  createdEmails.push(email)
  return u
}

describe("partner role promotion on reviewPartnerApplication", () => {
  it("promotes the applicant to transporter_staff when validated", async () => {
    const u = await testUser(`promo1-${Date.now()}@test.cm`)
    // Mirror the production flow (submit): Transporter is created and linked
    // to the applicant BEFORE admin validation.
    const tr = await prisma.transporter.create({
      data: { companyName: "Promotion SARL", contactName: "Paul Test", phone: "+237600000010", email: u.email, status: "pending" },
    })
    createdTransporterIds.push(tr.id)
    await prisma.user.update({ where: { id: u.id }, data: { transporterId: tr.id } })
    const app = await prisma.partnerApplication.create({
      data: {
        companyName: "Promotion SARL",
        contactName: "Paul Test",
        phone: "+237600000010",
        email: u.email,
        transporterId: tr.id,
        status: "received",
      },
    })

    await reviewPartnerApplication(app.id, "admin-test", {
      status: "validated",
    })

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: u.id } })
    expect(fresh.role).toBe("transporter_staff")
  })
})

describe("getPartnerServices — per-service scoping", () => {
  it("returns only the services the user actually partners on (transporter + hotels, no rentals/parcels/events)", async () => {
    const u = await testUser(`scope1-${Date.now()}@test.cm`)
    const tr = await prisma.transporter.create({
      data: { companyName: "Scope Co", email: u.email },
    })
    createdTransporterIds.push(tr.id)
    await prisma.user.update({ where: { id: u.id }, data: { transporterId: tr.id, role: "transporter_staff" } })
    await prisma.hotel.create({
      data: { ownerId: u.id, name: "Hotel Scope", city: "Douala", partnerStatus: "approved", status: "active" },
    })

    const out = await getPartnerServices(u.id)
    const services = out.services.map((s) => s.service)
    expect(services).toContain("transporter")
    expect(services).toContain("hotels")
    expect(services).not.toContain("rentals")
    expect(services).not.toContain("parcels")
    expect(services).not.toContain("events")
    // Insured: transporter KPIs carry trip counts, hotels carry entity counts
    const trSvc = out.services.find((s) => s.service === "transporter")!
    expect(trSvc.kpis.entities).toBe(0)
    const hotelSvc = out.services.find((s) => s.service === "hotels")!
    expect(hotelSvc.kpis.entities).toBeGreaterThanOrEqual(1)
  })

  it("returns an empty service list for a plain traveler (no ownership anywhere)", async () => {
    const u = await testUser(`scope2-${Date.now()}@test.cm`)
    const out = await getPartnerServices(u.id)
    expect(out.services).toEqual([])
  })
})
