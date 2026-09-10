import { prisma } from "@camermove/db"

export async function findApprovedTransportersByCity(city: string) {
  return prisma.transporter.findMany({
    where: {
      status: "approved",
      trips: {
        some: {
          route: {
            originCity: { equals: city, mode: "insensitive" },
          },
        },
      },
    },
    include: {
      trips: {
        where: {
          route: {
            originCity: { equals: city, mode: "insensitive" },
          },
          status: "active",
        },
        select: {
          departurePointInfo: true,
          route: { select: { originCity: true } },
        },
        take: 1,
      },
    },
  })
}
