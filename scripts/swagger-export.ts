const BASE = process.env.API_URL ?? "http://localhost:3000"
const out = process.argv[2] ?? "apps/api/openapi.json"
import { writeFile, mkdir } from "node:fs/promises"
import { dirname } from "node:path"

async function main() {
  const res = await fetch(`${BASE}/docs/json`)
  if (!res.ok) throw new Error(`swagger fetch failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(json, null, 2), "utf-8")
  console.log(`OpenAPI written to ${out}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
