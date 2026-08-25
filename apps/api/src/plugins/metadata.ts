import fp from "fastify-plugin"
import type { FastifyInstance, FastifyRequest } from "fastify"

declare module "fastify" {
  interface FastifyRequest {
    meta: {
      ip: string
      userAgent: string
      os: string
      browser: string
      device: string
      referer?: string
      requestId: string
    }
  }
}

function parseUA(ua: string): { os: string; browser: string; device: string } {
  const uaLower = ua.toLowerCase()
  let os = "Unknown"
  if (uaLower.includes("windows")) os = "Windows"
  else if (uaLower.includes("android")) os = "Android"
  else if (uaLower.includes("iphone") || uaLower.includes("ipad")) os = "iOS"
  else if (uaLower.includes("mac os")) os = "macOS"
  else if (uaLower.includes("linux")) os = "Linux"

  let browser = "Unknown"
  if (uaLower.includes("edg")) browser = "Edge"
  else if (uaLower.includes("chrome") && !uaLower.includes("edg")) browser = "Chrome"
  else if (uaLower.includes("firefox")) browser = "Firefox"
  else if (uaLower.includes("safari") && !uaLower.includes("chrome")) browser = "Safari"

  let device = "Desktop"
  if (uaLower.includes("mobile") || uaLower.includes("android") || uaLower.includes("iphone")) device = "Mobile"
  else if (uaLower.includes("tablet") || uaLower.includes("ipad")) device = "Tablet"

  return { os, browser, device }
}

export const metadataPlugin = fp(async (app: FastifyInstance) => {
  app.addHook("onRequest", async (req: FastifyRequest) => {
    const ua = (req.headers["user-agent"] as string) ?? ""
    const { os, browser, device } = parseUA(ua)
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "unknown"
    const requestId = (req.headers["x-request-id"] as string) ?? req.id
    ;(req as unknown as { meta: unknown }).meta = {
      ip,
      userAgent: ua,
      os,
      browser,
      device,
      referer: req.headers.referer as string | undefined,
      requestId,
    }
    req.log.info({ ip, os, browser, device, requestId, url: req.url }, "request meta")
  })
})
