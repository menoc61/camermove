import { pino } from 'pino'
import { loadEnv } from './env'

export function createLogger() {
  let level: string = process.env.LOG_LEVEL ?? 'info'
  try {
    level = loadEnv().LOG_LEVEL ?? level
  } catch {}
  return pino({ level })
}
