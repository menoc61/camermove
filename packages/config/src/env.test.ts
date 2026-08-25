import { describe, it, expect, beforeEach } from 'vitest'
import { loadEnv } from './env'

beforeEach(() => {
  delete process.env.NODE_ENV
  delete process.env.DATABASE_URL
  delete process.env.JWT_SECRET
  delete process.env.JWT_REFRESH_SECRET
  delete process.env.MINIO_ACCESS_KEY
  delete process.env.MINIO_SECRET_KEY
  delete process.env.NOTCHPAY_PUBLIC_KEY
  delete process.env.NOTCHPAY_PRIVATE_KEY
  delete process.env.NOTCHPAY_HASH_KEY
})

describe('loadEnv', () => {
  it('parses a valid env and defaults NODE_ENV and PORT', () => {
    process.env.DATABASE_URL = 'postgres://u:p@localhost:5432/camermove'
    process.env.JWT_SECRET = 'x'.repeat(64)
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(64)
    process.env.MINIO_ACCESS_KEY = 'minioadmin'
    process.env.MINIO_SECRET_KEY = 'minioadmin'
    process.env.NOTCHPAY_PUBLIC_KEY = 'np_public'
    process.env.NOTCHPAY_PRIVATE_KEY = 'np_private'
    process.env.NOTCHPAY_HASH_KEY = 'np_hash'
    const env = loadEnv()
    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3000)
    expect(env.DATABASE_URL).toBe('postgres://u:p@localhost:5432/camermove')
  })

  it('throws ConfigError when a required secret is missing', () => {
    process.env.DATABASE_URL = ''
    expect(() => loadEnv()).toThrow(/DATABASE_URL/)
  })
})
