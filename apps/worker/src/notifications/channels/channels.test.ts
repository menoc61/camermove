import { describe, it, expect } from "vitest"
import { sendWhatsApp } from "./whatsapp"
import { sendPush } from "./push"

const envStub = { NODE_ENV: "development" } as never

describe("notification channels config honesty", () => {
  it("sendWhatsApp rejects when Twilio env missing outside stub/test", async () => {
    await expect(sendWhatsApp(envStub, { to: "whatsapp:+237600000001", body: "x" })).rejects.toThrow(
      /channel_not_configured:whatsapp/,
    )
  })
  it("sendPush rejects when ntfy base missing outside stub/test", async () => {
    await expect(sendPush(envStub, { userId: "u1", title: "t", message: "m" })).rejects.toThrow(
      /channel_not_configured:push/,
    )
  })
  it("stub mode still resolves silently", async () => {
    process.env.NOTIF_DRIVER = "stub"
    await expect(
      sendWhatsApp(envStub, { to: "whatsapp:+237600000001", body: "x" }),
    ).resolves.toBeUndefined()
    delete process.env.NOTIF_DRIVER
  })
})
