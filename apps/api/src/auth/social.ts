import { loadEnv } from "@camermove/config"

export interface SocialAuthProvider {
  getAuthUrl(state: string): string
  exchangeCode(code: string): Promise<{ id_token: string }>
  verifyIdToken(id_token: string): { sub: string; email: string; name?: string }
}

function base64UrlDecode(input: string): string {
  const pad = "=".repeat((4 - (input.length % 4)) % 4)
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad
  return Buffer.from(b64, "base64").toString("utf-8")
}

export const googleProvider: SocialAuthProvider = {
  getAuthUrl(state: string) {
    const env = loadEnv()
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: env.GOOGLE_CALLBACK_URL ?? "",
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  },

  async exchangeCode(code: string) {
    const env = loadEnv()
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID ?? "",
        client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: env.GOOGLE_CALLBACK_URL ?? "",
        grant_type: "authorization_code",
      }),
    })
    if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`)
    return (await res.json()) as { id_token: string }
  },

  verifyIdToken(id_token: string) {
    const env = loadEnv()
    const parts = id_token.split(".")
    if (parts.length !== 3) throw new Error("Invalid id_token format")
    const payload = JSON.parse(base64UrlDecode(parts[1]!)) as {
      iss: string
      aud: string
      sub: string
      email: string
      name?: string
    }
    const validIss =
      payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com"
    if (!validIss) throw new Error(`Invalid iss: ${payload.iss}`)
    if (payload.aud !== env.GOOGLE_CLIENT_ID) throw new Error(`Invalid aud: ${payload.aud}`)
    if (!payload.sub || !payload.email) throw new Error("Missing sub or email in id_token")
    return { sub: payload.sub, email: payload.email, name: payload.name }
  },
}
