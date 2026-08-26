import { describe, it, expect, beforeAll } from "vitest"
import { loadEnv } from "@camermove/config"
import { createStorage } from "@camermove/media"
import { createPartnerApplicationsService } from "./service"

const env = loadEnv()
const realStorage = createStorage(env)
const svc = createPartnerApplicationsService({ env, storage: realStorage })

beforeAll(async () => {
  // presignedPutObject does a bucket region lookup — ensure the bucket exists (idempotent)
  await realStorage.ensureBucket()
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
