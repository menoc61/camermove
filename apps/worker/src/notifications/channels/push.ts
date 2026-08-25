import type { Env } from "@camermove/config"
export async function sendPush(env: Env, msg: { userId: string; title: string; message: string }) {
  if (!env.NTFY_HOST) return
  await fetch(`${env.NTFY_HOST}/camermove_${msg.userId}`, { method: "POST", headers: { Title: msg.title }, body: msg.message })
}
