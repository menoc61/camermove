import { ConflictError, ForbiddenError, UnauthorizedError } from "@camermove/config"
import type { PrismaClient } from "@camermove/db"
import { objectKey, type Storage } from "@camermove/media"
import type { ApplicationInputT, PresignInputT } from "./schema"
import * as repo from "./repository"

function extFor(mimetype: string): string {
  if (mimetype === "application/pdf") return "pdf"
  if (mimetype === "image/png") return "png"
  return "jpg"
}

export function createPartnerApplicationsService(deps: { storage: Storage; prisma: PrismaClient }) {
  return {
    async presignDocument(userId: string, input: PresignInputT) {
      const objectKeyFull = objectKey(`partner-applications/${userId}`, extFor(input.mimetype))
      const uploadUrl = await deps.storage.presignPut(objectKeyFull)
      return { objectKey: objectKeyFull, uploadUrl }
    },

    async submit(userId: string, input: ApplicationInputT): Promise<{ id: string; status: "received" }> {
      const user = await repo.findUserById(deps.prisma, userId)
      if (!user) throw new UnauthorizedError()
      if (user.transporterId)
        throw new ConflictError("Une candidature existe déjà pour ce compte", "APPLICATION_EXISTS")
      const emailTaken = await repo.findTransporterByEmail(deps.prisma, user.email)
      if (emailTaken)
        throw new ConflictError("Un transporteur utilise déjà cet email", "TRANSPORTER_EMAIL_TAKEN")
      const prefix = `partner-applications/${userId}/`
      for (const d of input.documents) {
        if (!d.objectKey.startsWith(prefix))
          throw new ForbiddenError("Document non autorisé", "DOCUMENT_NOT_OWNED")
      }
      return repo.createApplicationWithTransporter(deps.prisma, userId, user.email, input)
    },

    async getMyApplication(userId: string) {
      const user = await repo.findUserById(deps.prisma, userId)
      if (!user?.transporterId) return null
      const row = await repo.findMyApplicationRow(deps.prisma, user.transporterId)
      if (!row) return null
      return {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
        companyName: row.companyName,
        documents: row.documents,
      }
    },

    async listForExport(params: { dateFrom?: string; dateTo?: string; limit: number; transporterId?: string }) {
      return repo.listApplicationsForExport(deps.prisma, params)
    },
  }
}
