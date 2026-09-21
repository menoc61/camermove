const BASE = process.env.API_URL ?? "http://localhost:3000";

function check(name: string, res: Response) {
  console.log(`  ${res.ok ? "✓" : "✗"} ${name} → ${res.status}`);
  if (!res.ok) throw new Error(`${name} failed: ${res.status}`);
}

async function authed(): Promise<string> {
  const email = `smoke${Date.now()}@camermove.cm`;
  const password = "S3cret!123";
  let res = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName: "Smoke", lastName: "Vert" }),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const reg = (await res.json()) as { accessToken: string };
  return reg.accessToken;
}

async function smokeVerticals() {
  const token = await authed();
  const h = { Authorization: `Bearer ${token}` };

  check("hotels.list", await fetch(`${BASE}/api/v1/hotels`, { headers: h }));
  check("rentals.list", await fetch(`${BASE}/api/v1/rentals`, { headers: h }));
  check("parcels.quote", await fetch(`${BASE}/api/v1/parcels/quote?weightKg=2&distanceKm=10`, { headers: h }));
  check("events.list", await fetch(`${BASE}/api/v1/events`, { headers: h }));
  check("insurance.list", await fetch(`${BASE}/api/v1/insurance/policies`, { headers: h }));
  check("payments.list", await fetch(`${BASE}/api/v1/payments`, { headers: h }));
  check("notifications.list", await fetch(`${BASE}/api/v1/me/notifications`, { headers: h }));
  check("dashboard.me", await fetch(`${BASE}/api/v1/me/dashboard`, { headers: h }));
  check("profile.get", await fetch(`${BASE}/api/v1/me/profile`, { headers: h }));
  const tripsRes = await fetch(`${BASE}/api/v1/trips?perPage=5`, { headers: h });
  check("trips.list", tripsRes);
  const tripsBody = (await tripsRes.json()) as { items: unknown[] };
  if (!Array.isArray(tripsBody.items)) throw new Error("trips.list envelope missing items");

  const revRes = await fetch(`${BASE}/api/v1/reviews/c000000000000000000000001`, { headers: h });
  console.log(`  ${revRes.status === 404 ? "✓" : "✗"} reviews.missing-404 → ${revRes.status}`);
  if (revRes.status !== 404) throw new Error(`reviews.missing-404 failed: ${revRes.status}`);

  const trComm = await fetch(`${BASE}/api/v1/transporter/commissions`, { headers: h });
  console.log(`  ${trComm.status === 403 ? "✓" : "✗"} transporter.commissions-traveler-403 → ${trComm.status}`);
  if (trComm.status !== 403) throw new Error(`transporter.commissions guard failed: ${trComm.status}`);

  const pEvents = await fetch(`${BASE}/api/v1/partner/events`, { headers: h });
  console.log(`  ${pEvents.status === 403 ? "✓" : "✗"} partner.events-traveler-403 → ${pEvents.status}`);
  if (pEvents.status !== 403) throw new Error(`partner.events guard failed: ${pEvents.status}`);

  // Idempotency replay: same key twice → same status+body
  const key = `smoke-${Date.now()}`;
  const payload = { reason: "smoke-replay" };
  const first = await fetch(`${BASE}/api/v1/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ name: "Smoke", email: "s@s.cm", message: "hello smoke replay" }),
  });
  const second = await fetch(`${BASE}/api/v1/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(payload),
  });
  console.log(`  ${first.status === second.status ? "✓" : "✗"} idempotency.replay → ${first.status}/${second.status}`);
  if (first.status !== second.status) throw new Error("idempotency replay mismatch");

  console.log("✓ verticals smoke passed");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  smokeVerticals().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { smokeVerticals };
