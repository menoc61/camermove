import { prisma } from "../prisma"

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } })
}

export async function createUser(data: {
  email: string
  passwordHash?: string | null
  firstName?: string | null
  lastName?: string | null
  role?: string
}) {
  return prisma.user.create({
    data: {
      email: data.email,
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role as never,
    },
  })
}

export async function findOrCreateSocialUser(input: {
  email: string
  provider: string
  providerUserId: string
  name?: string
}) {
  const existingSocial = await prisma.socialAccount.findUnique({
    where: { providerUserId: input.providerUserId },
    include: { user: true },
  })
  if (existingSocial) return existingSocial.user

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } })
  if (existingUser) {
    await prisma.socialAccount.create({
      data: {
        provider: input.provider,
        providerUserId: input.providerUserId,
        email: input.email,
        userId: existingUser.id,
      },
    })
    return existingUser
  }

  const [firstName, ...rest] = (input.name ?? input.email).split(" ")
  const lastName = rest.join(" ") || null
  const user = await prisma.user.create({
    data: {
      email: input.email,
      firstName,
      lastName,
      emailVerified: true,
      role: "traveler",
      socialAccounts: {
        create: {
          provider: input.provider,
          providerUserId: input.providerUserId,
          email: input.email,
        },
      },
    },
  })
  return user
}
