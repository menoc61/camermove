import jwt from "jsonwebtoken"
import type { Env } from "@camermove/config"
import { UnauthorizedError } from "@camermove/config"

interface UserClaims {
  sub: string
  role: string
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
