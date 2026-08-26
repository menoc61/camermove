import { loadEnv, type Env } from "@camermove/config"
import { objectKey, type Storage } from "@camermove/media"
import type { PresignInputT } from "./schema"

function extFor(mimetype: string): string {
  if (mimetype === "application/pdf") return "pdf"
  if (mimetype === "image/png") return "png"
  return "jpg"
}

export function createPartnerApplicationsService(deps: { env?: Env; storage: Storage }) {
  const env = deps.env ?? loadEnv()
  return {
    async presignDocument(userId: string, input: PresignInputT) {
      const objectKeyFull = objectKey(`partner-applications/${userId}`, extFor(input.mimetype))
      const uploadUrl = await deps.storage.presignPut(objectKeyFull)
      return { objectKey: objectKeyFull, uploadUrl }
    },
  }
}
