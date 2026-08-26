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
  CINETPAY_APIKEY: z.string().optional(),
  CINETPAY_SITE_ID: z.string().optional(),
  CINETPAY_SECRET_KEY: secret.optional(),
  CINETPAY_BASE_URL: z.string().url().default('https://api-checkout.cinetpay.com'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  NTFY_BASE_URL: z.string().default('http://localhost:8090'),
  NTFY_HOST: z.string().default('https://ntfy.sh'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('no-reply@camermove.cm'),
  SMTP_SECURE: z.string().optional().default("false").transform((v) => v === "true"),
  METRICS_ENABLED: z.string().optional().default("false").transform((v) => v === "true"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  // System maxima — all tunable via .env (no hardcoded limits)
  RATE_LIMIT_IP_GENERAL_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_IP_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_IP_SEARCH_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_IP_TICKETS_LOOKUP_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_APP_GENERAL_MAX: z.coerce.number().int().positive().default(5000),
  RATE_LIMIT_APP_AUTH_MAX: z.coerce.number().int().positive().default(500),
  RATE_LIMIT_APP_SEARCH_MAX: z.coerce.number().int().positive().default(1000),
  RATE_LIMIT_APP_TICKETS_LOOKUP_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  PAGINATION_MAX_PER_PAGE: z.coerce.number().int().positive().default(100),
  PAGINATION_DEFAULT_PER_PAGE: z.coerce.number().int().positive().default(20),
  BULK_MAX_IDS: z.coerce.number().int().positive().default(100),
  SEARCH_MAX_LIMIT: z.coerce.number().int().positive().default(100),
  SEARCH_DEFAULT_LIMIT: z.coerce.number().int().positive().default(20),
})

export type Env = z.infer<typeof EnvSchema>

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

// Per-process singleton: parse once, freeze, return the same instance.
// Tests that mutate process.env and expect fresh parses must call
// __resetEnvCacheForTests() (documented escape hatch) in their beforeEach.
let cachedEnv: Env | undefined

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (!cachedEnv) {
    const parsed = EnvSchema.safeParse(source)
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
      throw new ConfigError(`Invalid environment: ${missing}`)
    }
    cachedEnv = Object.freeze(parsed.data)
  }
  return cachedEnv
}

export function __resetEnvCacheForTests(): void {
  cachedEnv = undefined
}
