const BASE = process.env.API_URL ?? "http://localhost:3000"
import { writeFile, mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { existsSync } from "node:fs"

// When invoked via pnpm --filter, cwd may be apps/api. Walk up to find repo root.
function findRepoRoot(start: string): string {
  let cur = start
  for (let i = 0; i < 5; i++) {
    if (existsSync(`${cur}/.git`) || existsSync(`${cur}/apps/api`)) return cur
    const parent = dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  return start
}
const repoRoot = findRepoRoot(process.cwd())
const out = process.argv[2] ?? resolve(repoRoot, "apps/api/openapi.json")

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
