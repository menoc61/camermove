import { buildApp } from "./app"
import { loadEnv } from "@camermove/config"
import { closeRedis } from "./lib/redis"
import { closeOutbox } from "@camermove/events"

const env = loadEnv()
const app = await buildApp()
await app.listen({ port: env.PORT, host: "0.0.0.0" })

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "shutdown signal received")
  try {
    await closeOutbox()
  } catch (err) {
    app.log.warn({ err }, "closeOutbox failed")
  }
  try {
    await closeRedis()
  } catch (err) {
    app.log.warn({ err }, "closeRedis failed")
  }
  try {
    await app.close()
  } catch (err) {
    app.log.warn({ err }, "app.close failed")
  }
  process.exit(0)
}

process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))
