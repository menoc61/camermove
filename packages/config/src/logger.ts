import { pino } from 'pino'
import { loadEnv } from './env'

export function createLogger() {
  // Single source of truth via loadEnv(); LOG_LEVEL has a schema default ('info')
  // so this is safe even if env validation fails (pino defaults to 'info').
  let level = 'info'
  try {
    level = loadEnv().LOG_LEVEL
  } catch {
    // Fall through to the pino default if env isn't loadable yet (e.g. very
    // early bootstrap). No process.env reads here.
  }
  return pino({ level })
}