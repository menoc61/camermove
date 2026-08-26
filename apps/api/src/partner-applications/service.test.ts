import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { loadEnv } from "@camermove/config"
import { createStorage } from "@camermove/media"
import { prisma } from "@camermove/db"
import { createPartnerApplicationsService } from "./service"

const env = loadEnv()
const realStorage = createStorage(env)
const svc = createPartnerApplicationsService({ storage: realStorage, prisma })
const createdUserIds: string[] = []
const createdEmails: string[] = []

beforeAll(async () => {
  // presignedPutObject does a bucket region lookup - ensure the bucket exists (idempotent)
  await realStorage.ensureBucket()
})

afterAll(async () => {
  // Track exact rows created here: User->Transporter and Transporter->PartnerApplication
  // are onDelete: SetNull, and other suites also use @test.cm emails (some with bookings),
  // so delete by id/email in dependency order; Document cascades from Transporter.
  await prisma.partnerApplication.deleteMany({ where: { email: { in: createdEmails } } })
  await prisma.transporter.deleteMany({ where: { email: { in: createdEmails } } })
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
})

describe("presignDocument", () => {
  it("returns uploadUrl containing bucket + objectKey under the caller prefix", async () => {
    const out = await svc.presignDocument("user_presign_1", {
      type: "business_registration",
      mimetype: "application/pdf",
      size: 1024,
    })
    expect(out.objectKey).toMatch(/^partner-applications\/user_presign_1\/[0-9a-f-]{36}\.pdf$/)
    expect(out.uploadUrl).toContain(env.MINIO_BUCKET)
    // MinIO leaves "/" unencoded in presigned URLs, so match the raw objectKey
    expect(out.uploadUrl).toContain(out.objectKey)
    // presigned PUT URLs carry X-Amz- signature params
    expect(out.uploadUrl).toContain("X-Amz-Signature=")
  })

  it("maps image mimetypes to jpg/png extensions", async () => {
    const jpg = await svc.presignDocument("u", { type: "id_document", mimetype: "image/jpeg", size: 10 })
    const png = await svc.presignDocument("u", { type: "id_document", mimetype: "image/png", size: 10 })
    expect(jpg.objectKey.endsWith(".jpg")).toBe(true)
    expect(png.objectKey.endsWith(".png")).toBe(true)
  })
})

async function testUser(email: string) {
  const u = await prisma.user.create({
    data: { email, passwordHash: "x", role: "traveler" },
  })
  createdUserIds.push(u.id)
  createdEmails.push(email)
  return u
}

describe("submit", () => {
  let userId: string
  beforeAll(async () => {
    const u = await testUser(`plan1-submit-${Date.now()}@test.cm`)
    userId = u.id
  })

  const baseInput = {
    companyName: "Agence Test Voyages",
    contactName: "Jean Test",
    phone: "+237600000001",
    routesServed: ["Yaounde-Douala"],
    documents: [
      {
        type: "business_registration" as const,
        objectKey: "",
        mimetype: "application/pdf" as const,
        size: 2048,
      },
    ],
  }

  it("creates pending Transporter + received application + documents, links user", async () => {
    const input = {
      ...baseInput,
      documents: [{ ...baseInput.documents[0], objectKey: `partner-applications/${userId}/doc.pdf` }],
    }
    const out = await svc.submit(userId, input as never)
    expect(out.status).toBe("received")

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.transporterId).toBeTruthy()
    const appRow = await prisma.partnerApplication.findUniqueOrThrow({
      where: { id: out.id },
      include: { documents: true },
    })
    expect(appRow.transporterId).toBe(user.transporterId)
    expect(appRow.documents).toHaveLength(1)
    const tr = await prisma.transporter.findUniqueOrThrow({ where: { id: user.transporterId! } })
    expect(tr.status).toBe("pending")
    expect(tr.email).toBe(user.email)
  })

  it("rejects a second application by the same user with 409", async () => {
    await expect(svc.submit(userId, baseInput as never)).rejects.toMatchObject({ status: 409 })
  })

  it("rejects documents outside the caller's presigned prefix with 403", async () => {
    const u2 = await testUser(`plan1-foreign-${Date.now()}@test.cm`)
    await expect(
      svc.submit(u2.id, {
        ...baseInput,
        documents: [{ ...baseInput.documents[0], objectKey: "partner-applications/someone-else/x.pdf" }],
      } as never),
    ).rejects.toMatchObject({ status: 403 })
  })
})
