import { defineConfig, env } from "prisma/config"

let databaseUrl: string
try {
  databaseUrl = env("DATABASE_URL")
} catch {
  databaseUrl = "postgresql://camermove:camermove@localhost:5432/camermove"
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl },
})
