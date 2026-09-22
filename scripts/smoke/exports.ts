const BASE = process.env.API_URL ?? "http://localhost:3000";

const EXPORTS = [
  "/api/v1/bookings/export?format=json",
  "/api/v1/payments/export?format=json",
  "/api/v1/hotels/bookings/export?format=json",
  "/api/v1/rentals/bookings/export?format=json",
  "/api/v1/parcels/export?format=json",
  "/api/v1/insurance/policies/export?format=json",
  "/api/v1/events/bookings/export?format=json",
  "/api/v1/me/notifications/export?format=json",
];

async function smokeExports() {
  const email = `smoke${Date.now()}@camermove.cm`;
  const password = "S3cret!123";
  let res = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName: "Smoke", lastName: "Exp" }),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const { accessToken } = (await res.json()) as { accessToken: string };
  const h = { Authorization: `Bearer ${accessToken}` };

  for (const path of EXPORTS) {
    const r = await fetch(`${BASE}${path}&dateFrom=2025-01-01&dateTo=2026-12-31`, { headers: h });
    const cd = r.headers.get("content-disposition") ?? "";
    const ok = r.ok && (cd.includes("attachment") || (r.headers.get("content-type") ?? "").includes("json"));
    console.log(`  ${ok ? "✓" : "✗"} ${path} → ${r.status} ${cd}`);
    if (!ok) throw new Error(`export failed: ${path} → ${r.status}`);
  }
  console.log("✓ exports smoke passed");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  smokeExports().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { smokeExports };
