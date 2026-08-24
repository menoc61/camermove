import { prisma } from "@camermove/db"
import type { Env } from "@camermove/config"
import { sendEmail } from "./channels/email"
import { sendWhatsApp } from "./channels/whatsapp"
import { sendPush } from "./channels/push"
interface SendInput { userId?: string; channel: "email" | "whatsapp" | "push" | "sms"; type: string; payload: Record<string, unknown> }
export function createNotificationService(env: Env) {
  return {
    async send(input: SendInput) {
      const notification = await prisma.notification.create({ data: { userId: input.userId, channel: input.channel as never, type: input.type, payload: input.payload as never } })
      try {
        if (input.channel === "email") await sendEmail(input.payload as { to: string; subject: string; text: string })
        else if (input.channel === "whatsapp") await sendWhatsApp(env, input.payload as { to: string; body: string })
        else if (input.channel === "push") await sendPush(env, input.payload as { userId: string; title: string; message: string })
        await prisma.notification.update({ where: { id: notification.id }, data: { status: "sent", sentAt: new Date() } })
      } catch (err) {
        await prisma.notification.update({ where: { id: notification.id }, data: { status: "failed" } })
        if (env.NODE_ENV !== "production") console.warn("notification failed", err)
      }
    },
  }
}
