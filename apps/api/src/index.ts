import { buildApp } from "./app"
import { loadEnv } from "@camermove/config"

const env = loadEnv()
const app = await buildApp()
await app.listen({ port: env.PORT, host: "0.0.0.0" })
process.on("SIGTERM", async () => {
  await app.close()
  process.exit(0)
})
