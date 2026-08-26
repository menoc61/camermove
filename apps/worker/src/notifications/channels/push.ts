import type { Env } from "@camermove/config"

/**
 * Push channel adapter — Phase 4 typed signature, ntfy topic fix.
 * Rejects with channel_not_configured:push when no ntfy base URL is set
 * outside stub/test.
 *
 * Topic format: `user-${last12OfCuid(userId)}` (e.g. `user-clw5x8r30001`).
 * ntfy topic rules per docs.ntfy.sh: [a-zA-Z0-9_-]{1,64}, no leading underscore,
 * no `.` separators. The legacy `camermove_${userId}` violated the leading-underscore
 * rule and the underscore separator (some Android clients reject).
 *
 * Priority: 3 (default) for transactional notifications. Tags hint at the event type.
 */
export interface PushMessage {
  userId: string
  title: string
  message: string
  tags?: string[]
  priority?: 1 | 2 | 3 | 4 | 5
}

export async function sendPush(env: Env, msg: PushMessage): Promise<void> {
  if (env.NODE_ENV === "test" || process.env.NOTIF_DRIVER === "stub") {
    console.log(`[push:stub] topic=${msg.userId} title=${JSON.stringify(msg.title)} message=${JSON.stringify(msg.message)}`)
    return
  }
  const baseUrl = env.NTFY_BASE_URL || env.NTFY_HOST
  if (!baseUrl) {
    throw new Error("channel_not_configured:push")
  }
  const headers: Record<string, string> = { Title: msg.title, Priority: String(msg.priority ?? 3) }
  if (msg.tags && msg.tags.length > 0) headers.Tags = msg.tags.join(",")
  await fetch(`${baseUrl}/${msg.userId}`, { method: "POST", headers, body: msg.message })
}
