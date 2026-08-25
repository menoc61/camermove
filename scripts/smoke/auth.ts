const BASE = process.env.API_URL ?? "http://localhost:3000"

async function smokeAuth() {
  const email = `smoke${Date.now()}@camermove.cm`
  const password = "S3cret!123"
  console.log("→ Register", email)
  let res = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName: "Smoke", lastName: "Test" }),
  })
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`)
  const reg = (await res.json()) as { accessToken: string }
  console.log("  ✓ register ok")

  console.log("→ Login")
  res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`)
  const login = (await res.json()) as { accessToken: string }
  console.log("  ✓ login ok")

  console.log("→ Me")
  res = await fetch(`${BASE}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${login.accessToken}` } })
  if (!res.ok) throw new Error(`me failed: ${res.status} ${await res.text()}`)
  console.log("  ✓ me ok")
  console.log("✓ auth smoke passed")
}

if (import.meta.url === `file://${process.argv[1]}`) {
  smokeAuth().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

export { smokeAuth }
