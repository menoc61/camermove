import { randomUUID } from "node:crypto"
import { Client } from "minio"
import { loadEnv, type Env } from "@camermove/config"

export function objectKey(prefix: string, extension: string): string {
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)
  const name = `${randomUUID()}.${safeExt}`
  return `${prefix.replace(/^\/+|\/+$/g, "")}/${name}`
}

export function createStorage(env: Env) {
  const client = new Client({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: false,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
  })

  return {
    getClient: () => client,
    async ensureBucket() {
      const exists = await client.bucketExists(env.MINIO_BUCKET)
      if (!exists) await client.makeBucket(env.MINIO_BUCKET)
    },
    presignPut(objectName: string) {
      return client.presignedPutObject(env.MINIO_BUCKET, objectName, 15 * 60)
    },
    presignGet(objectName: string) {
      return client.presignedGetObject(env.MINIO_BUCKET, objectName, 5 * 60)
    },
    removeObject(objectName: string) {
      return client.removeObject(env.MINIO_BUCKET, objectName)
    },
  }
}

export type Storage = ReturnType<typeof createStorage>

let storageSingleton: Storage | undefined

// Per-process singleton. loadEnv() is memoized in @camermove/config, so this
// is cheap after the first call.
export function getStorage(): Storage {
  if (!storageSingleton) storageSingleton = createStorage(loadEnv())
  return storageSingleton
}
