import { ConflictError, ForbiddenError, UnauthorizedError } from "@camermove/config"
import type { PrismaClient } from "@camermove/db"
import { objectKey, type Storage } from "@camermove/media"
import type { ApplicationInputT, PresignInputT } from "./schema"

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
      const user = await deps.prisma.user.findUnique({ where: { id: userId } })
      if (!user) throw new UnauthorizedError()
      if (user.transporterId)
        throw new ConflictError("Une candidature existe déjà pour ce compte", "APPLICATION_EXISTS")
      const emailTaken = await deps.prisma.transporter.findUnique({ where: { email: user.email } })
      if (emailTaken)
        throw new ConflictError("Un transporteur utilise déjà cet email", "TRANSPORTER_EMAIL_TAKEN")
      const prefix = `partner-applications/${userId}/`
      for (const d of input.documents) {
        if (!d.objectKey.startsWith(prefix))
          throw new ForbiddenError("Document non autorisé", "DOCUMENT_NOT_OWNED")
      }
      return deps.prisma.$transaction(async (tx) => {
        const transporter = await tx.transporter.create({
          data: {
            companyName: input.companyName,
            contactName: input.contactName,
            phone: input.phone,
            email: user.email,
            city: input.city,
            transportType: input.transportType,
            vehicleCount: input.vehicleCount ?? 0,
            servedRoutes: input.routesServed,
            status: "pending",
          },
        })
        const created = await tx.partnerApplication.create({
          data: {
            companyName: input.companyName,
            contactName: input.contactName,
            phone: input.phone,
            email: user.email,
            city: input.city,
            transportType: input.transportType,
            vehicleCount: input.vehicleCount,
            routesServed: input.routesServed,
            message: input.message,
            status: "received",
            transporterId: transporter.id,
          },
        })
        await tx.document.createMany({
          data: input.documents.map((d) => ({
            type: d.type,
            objectKey: d.objectKey,
            mimetype: d.mimetype,
            size: d.size,
            transporterId: transporter.id,
            partnerApplicationId: created.id,
          })),
        })
        await tx.user.update({ where: { id: userId }, data: { transporterId: transporter.id } })
        return { id: created.id, status: created.status as "received" }
      })
    },

    async getMyApplication(userId: string) {
      const user = await deps.prisma.user.findUnique({ where: { id: userId } })
      if (!user?.transporterId) return null
      const row = await deps.prisma.partnerApplication.findFirst({
        where: { transporterId: user.transporterId },
        orderBy: { createdAt: "desc" },
        include: { documents: { select: { type: true, size: true, mimetype: true, createdAt: true } } },
      })
      if (!row) return null
      return {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
        companyName: row.companyName,
        documents: row.documents,
      }
    },
  }
}
