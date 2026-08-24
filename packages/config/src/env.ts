import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'node:path'
import fs from 'node:fs'

// Auto-load .env from repo root (once). Search up from cwd.
try {
  let dir = process.cwd()
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(dir, '.env')
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate })
      break
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  if (!process.env.DATABASE_URL) dotenv.config()
} catch {}

const secret = z.string().min(1)

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: secret,
  REDIS_URL: z.string().default('redis://localhost:6379'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_ACCESS_KEY: secret,
  MINIO_SECRET_KEY: secret,
  MINIO_BUCKET: z.string().default('camermove'),
  JWT_SECRET: secret,
  JWT_REFRESH_SECRET: secret,
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  NOTCHPAY_BASE_URL: z.string().url().default('https://api.notchpay.co'),
  NOTCHPAY_PUBLIC_KEY: secret,
  NOTCHPAY_PRIVATE_KEY: secret,
  NOTCHPAY_HASH_KEY: secret,
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  NTFY_HOST: z.string().default('https://ntfy.sh'),
  METRICS_ENABLED: z.string().optional().default("false").transform((v) => v === "true"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
})

export type Env = z.infer<typeof EnvSchema>

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new ConfigError(`Invalid environment: ${missing}`)
  }
  return parsed.data
}
