import jwt from "jsonwebtoken"
import { randomUUID } from "node:crypto"
import type { Env } from "@camermove/config"
import { UnauthorizedError } from "@camermove/config"
import { getRedis } from "../lib/redis"

interface UserClaims {
  sub: string
  role: string
}

interface RefreshClaims {
  sub: string
  jti: string
}

// Refresh JWT "30d" expiry mirrored as Redis TTL so rotation records die with the token.
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60

const refreshKey = (jti: string) => `auth:refresh:${jti}`
const deniedKey = (jti: string) => `auth:refresh:denied:${jti}`
const rotatedKey = (jti: string) => `auth:refresh:rotated:${jti}`
const familyKey = (userId: string) => `auth:family:${userId}`

// In-memory fallback for dev without Redis (mirrors idempotency.ts Map pattern).
const memRefresh = new Map<string, { userId: string; expiresAt: number }>()
const memDenied = new Map<string, number>()
const memRotated = new Map<string, { userId: string; expiresAt: number }>()
const memFamily = new Map<string, Set<string>>()

function memGetRefresh(jti: string): string | null {
  const rec = memRefresh.get(jti)
  if (!rec) return null
  if (Date.now() > rec.expiresAt) {
    memRefresh.delete(jti)
    return null
  }
  return rec.userId
}

export function signTokens(user: { id: string; role: string }, env: Env) {
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: "15m" })
  const refreshToken = jwt.sign({ sub: user.id }, env.JWT_REFRESH_SECRET, { expiresIn: "30d" })
  return { accessToken, refreshToken }
}

export function verifyAccessToken(token: string, env: Env): UserClaims {
  try {
    return jwt.verify(token, env.JWT_SECRET) as UserClaims
  } catch {
    throw new UnauthorizedError()
  }
}

export function verifyRefreshToken(token: string, env: Env): RefreshClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as Partial<RefreshClaims>
    if (typeof decoded.sub !== "string" || typeof decoded.jti !== "string") throw new UnauthorizedError()
    return { sub: decoded.sub, jti: decoded.jti }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err
    throw new UnauthorizedError()
  }
}

/** Issue a stored access+refresh pair: refresh jti is recorded with TTL + tracked in the user family. */
export async function issueTokenPair(user: { id: string; role: string }, env: Env) {
  const jti = randomUUID()
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: "15m" })
  const refreshToken = jwt.sign({ sub: user.id, jti }, env.JWT_REFRESH_SECRET, { expiresIn: "30d" })
  await storeRefreshRecord(jti, user.id)
  return { accessToken, refreshToken }
}

/** Consume a refresh jti during rotation: delete the record, leave a rotated marker for reuse detection. */
export async function consumeRefreshRecord(jti: string, userId: string): Promise<void> {
  await deleteRefreshRecord(jti)
  await markRefreshRotated(jti, userId)
}

export async function storeRefreshRecord(jti: string, userId: string): Promise<void> {
  try {
    const redis = getRedis()
    await redis.setex(refreshKey(jti), REFRESH_TTL_SECONDS, userId)
    await redis.sadd(familyKey(userId), jti)
    await redis.expire(familyKey(userId), REFRESH_TTL_SECONDS)
  } catch {
    memRefresh.set(jti, { userId, expiresAt: Date.now() + REFRESH_TTL_SECONDS * 1000 })
    let fam = memFamily.get(userId)
    if (!fam) {
      fam = new Set()
      memFamily.set(userId, fam)
    }
    fam.add(jti)
  }
}

export async function getRefreshRecord(jti: string): Promise<string | null> {
  try {
    return await getRedis().get(refreshKey(jti))
  } catch {
    return memGetRefresh(jti)
  }
}

export async function deleteRefreshRecord(jti: string): Promise<void> {
  try {
    await getRedis().del(refreshKey(jti))
  } catch {
    memRefresh.delete(jti)
  }
}

export async function markRefreshRotated(jti: string, userId: string): Promise<void> {
  try {
    await getRedis().setex(rotatedKey(jti), REFRESH_TTL_SECONDS, userId)
  } catch {
    memRotated.set(jti, { userId, expiresAt: Date.now() + REFRESH_TTL_SECONDS * 1000 })
  }
}

export async function isRefreshRotated(jti: string): Promise<string | null> {
  try {
    return await getRedis().get(rotatedKey(jti))
  } catch {
    const rec = memRotated.get(jti)
    if (!rec) return null
    if (Date.now() > rec.expiresAt) {
      memRotated.delete(jti)
      return null
    }
    return rec.userId
  }
}

/** Logout: denylist the jti for the refresh TTL window + delete its rotation record. */
export async function denyRefreshJti(jti: string): Promise<void> {
  try {
    const redis = getRedis()
    await redis.setex(deniedKey(jti), REFRESH_TTL_SECONDS, "1")
    await redis.del(refreshKey(jti))
  } catch {
    memDenied.set(jti, Date.now() + REFRESH_TTL_SECONDS * 1000)
    memRefresh.delete(jti)
  }
}

export async function isRefreshDenied(jti: string): Promise<boolean> {
  try {
    return (await getRedis().get(deniedKey(jti))) !== null
  } catch {
    const exp = memDenied.get(jti)
    if (exp === undefined) return false
    if (Date.now() > exp) {
      memDenied.delete(jti)
      return false
    }
    return true
  }
}

/** Theft response: delete every live rotation record of the user family. */
export async function revokeTokenFamily(userId: string): Promise<void> {
  try {
    const redis = getRedis()
    const members = await redis.smembers(familyKey(userId))
    if (members.length > 0) {
      await redis.del(...members.map((jti) => refreshKey(jti)), familyKey(userId))
    } else {
      await redis.del(familyKey(userId))
    }
  } catch {
    const fam = memFamily.get(userId)
    if (fam) {
      for (const jti of fam) {
        memRefresh.delete(jti)
        memRotated.delete(jti)
      }
      memFamily.delete(userId)
    }
  }
}
