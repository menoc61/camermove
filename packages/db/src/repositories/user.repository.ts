import { prisma } from "../prisma"

/**
 * Public projection of a User — excludes `passwordHash` (and any future
 * secrets). Callers that need to verify a password MUST read the hash via a
 * dedicated repository function (see auth workers), not via findUserByEmail.
 * Defined here so every public finder is a single typed surface.
 */
export type PublicUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  phone: string | null
  emailVerified: boolean
  transporterId: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  phone: true,
  emailVerified: true,
  transporterId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function findUserByEmail(email: string): Promise<PublicUser | null> {
  // `as never` keeps the Prisma select result structurally assignable to
  // PublicUser without re-narrowing nullable fields manually.
  return (await prisma.user.findUnique({
    where: { email },
    select: PUBLIC_USER_SELECT,
  })) as PublicUser | null
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  return (await prisma.user.findUnique({
    where: { id },
    select: PUBLIC_USER_SELECT,
  })) as PublicUser | null
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

/**
 * Look up a user by social provider identity, creating the link (and user, if
 * needed) atomically. Wrapped in a Prisma transaction with a row lock on the
 * SocialAccount row matching `provider+providerUserId` to eliminate the
 * TOCTOU race where two concurrent first-login flows for the same provider
 * user could each create their own SocialAccount + User pair.
 */
export async function findOrCreateSocialUser(input: {
  email: string
  provider: string
  providerUserId: string
  name?: string
}) {
  return prisma.$transaction(async (tx) => {
    // Lock any existing SocialAccount row for this provider+providerUserId.
    // If the row already exists, the lock serializes subsequent callers and
    // the findUnique below returns the cached socialAccount → user. If the
    // row does not yet exist, FOR UPDATE on an empty result set is a no-op
    // and the unique constraint on providerUserId still catches a concurrent
    // first-login race (the loser's INSERT fails with P2002).
    await tx.$queryRaw`
      SELECT id FROM "SocialAccount"
      WHERE "provider" = ${input.provider} AND "providerUserId" = ${input.providerUserId}
      FOR UPDATE
    `

    const existingSocial = await tx.socialAccount.findUnique({
      where: { providerUserId: input.providerUserId },
      include: { user: true },
    })
    if (existingSocial) return existingSocial.user

    const existingUser = await tx.user.findUnique({ where: { email: input.email } })
    if (existingUser) {
      await tx.socialAccount.create({
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
    const user = await tx.user.create({
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
  })
}