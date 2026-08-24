const BASE = process.env.API_URL ?? "http://localhost:3000"

async function smokeSearch() {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  console.log(`→ Search Yaoundé→Douala ${tomorrow}`)
  let res = await fetch(`${BASE}/api/v1/search?origin=Yaoundé&destination=Douala&date=${tomorrow}&pax=1&sortBy=price_asc`)
  if (!res.ok) throw new Error(`search failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { items: Array<{ id: string }>; pagination: unknown }
  console.log(`  ✓ search ok (${data.items.length} items)`)
  if (data.items.length > 0) {
    const id = data.items[0]!.id
    console.log(`→ Trip detail ${id}`)
    res = await fetch(`${BASE}/api/v1/trips/${id}`)
    if (!res.ok) throw new Error(`trip detail failed: ${res.status} ${await res.text()}`)
    console.log("  ✓ trip detail ok")
  }
  console.log("✓ search smoke passed")
}

if (import.meta.url === `file://${process.argv[1]}`) {
  smokeSearch().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

export { smokeSearch }
