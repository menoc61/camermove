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

  const createRes = await fetch(`${BASE}/api/v1/parcels`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({
      senderName: "Smoke Sender",
      senderPhone: "+237600000001",
      recipientName: "Smoke Receiver",
      recipientPhone: "+237600000002",
      senderCity: "Yaoundé",
      recipientCity: "Douala",
      parcelType: "standard",
    }),
  });
  console.log(`  ${createRes.status === 201 ? "✓" : "✗"} parcels.create → ${createRes.status}`);
  if (createRes.status !== 201) throw new Error(`parcels.create failed: ${createRes.status}`);
  const created = (await createRes.json()) as { id: string; trackingNumber: string };

  const patchRes = await fetch(`${BASE}/api/v1/parcels/${created.id}`, {
    method: "PATCH",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ recipientPhone: "+237600000003" }),
  });
  console.log(`  ${patchRes.status === 200 ? "✓" : "✗"} parcels.patch → ${patchRes.status}`);
  if (patchRes.status !== 200) throw new Error(`parcels.patch failed: ${patchRes.status}`);

  const trackRes = await fetch(`${BASE}/api/v1/parcels/track/${created.trackingNumber}`);
  console.log(`  ${trackRes.status === 200 ? "✓" : "✗"} parcels.track → ${trackRes.status}`);
  if (trackRes.status !== 200) throw new Error(`parcels.track failed: ${trackRes.status}`);

  const adminList = await fetch(`${BASE}/api/v1/admin/parcels`, { headers: h });
  console.log(`  ${adminList.status === 403 ? "✓" : "✗"} admin.parcels-traveler-403 → ${adminList.status}`);
  if (adminList.status !== 403) throw new Error(`admin.parcels guard failed: ${adminList.status}`);

  const cancelRes = await fetch(`${BASE}/api/v1/parcels/${created.id}/cancel`, { method: "POST", headers: h });
  console.log(`  ${cancelRes.status === 200 ? "✓" : "✗"} parcels.cancel → ${cancelRes.status}`);
  if (cancelRes.status !== 200) throw new Error(`parcels.cancel failed: ${cancelRes.status}`);

  const hotelsRes = await fetch(`${BASE}/api/v1/hotels?perPage=5`, { headers: h });
  check("hotels.list", hotelsRes);
  const hotelsBody = (await hotelsRes.json()) as { items: Array<{ id: string; rooms?: Array<{ id: string }> }> };
  if (!Array.isArray(hotelsBody.items)) throw new Error("hotels.list envelope missing items");

  const withRooms = hotelsBody.items.find((x) => Array.isArray(x.rooms) && x.rooms.length > 0);
  if (!withRooms) {
    console.log("  ○ hotels.booking skipped — no hotel with rooms in seed");
  } else {
    const roomId = withRooms.rooms![0]!.id;
    const hbRes = await fetch(`${BASE}/api/v1/hotels/bookings`, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId: withRooms.id, roomTypeId: roomId, checkIn: "2026-12-01", checkOut: "2026-12-03", guests: 2 }),
    });
    console.log(`  ${hbRes.status === 201 ? "✓" : "✗"} hotels.booking.create → ${hbRes.status}`);
    if (hbRes.status !== 201) throw new Error(`hotels.booking.create failed: ${hbRes.status} ${await hbRes.text()}`);
    const hb = (await hbRes.json()) as { id: string };
    const hbCancel = await fetch(`${BASE}/api/v1/hotels/bookings/${hb.id}/cancel`, { method: "POST", headers: h });
    console.log(`  ${hbCancel.status === 200 ? "✓" : "✗"} hotels.booking.cancel → ${hbCancel.status}`);
    if (hbCancel.status !== 200) throw new Error(`hotels.booking.cancel failed: ${hbCancel.status}`);
  }

  const pHotels = await fetch(`${BASE}/api/v1/partner/hotels`, { headers: h });
  console.log(`  ${pHotels.status === 403 ? "✓" : "✗"} partner.hotels-traveler-403 → ${pHotels.status}`);
  if (pHotels.status !== 403) throw new Error(`partner.hotels guard failed: ${pHotels.status}`);

  const rentalsRes = await fetch(`${BASE}/api/v1/rentals?perPage=5`, { headers: h });
  check("rentals.list", rentalsRes);
  const rentalsBody = (await rentalsRes.json()) as { items: Array<{ id: string }> };
  if (!Array.isArray(rentalsBody.items)) throw new Error("rentals.list envelope missing items");
  const withVehicle = rentalsBody.items[0];
  if (withVehicle) {
    const rbRes = await fetch(`${BASE}/api/v1/rentals/bookings`, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ rentalVehicleId: withVehicle.id, startDate: "2026-12-05", endDate: "2026-12-07", pickupCity: "Douala" }),
    });
    console.log(`  ${rbRes.status === 201 ? "✓" : "✗"} rentals.booking.create → ${rbRes.status}`);
    if (rbRes.status !== 201) throw new Error(`rentals.booking.create failed: ${rbRes.status} ${await rbRes.text()}`);
    const rb = (await rbRes.json()) as { id: string };
    const rbCancel = await fetch(`${BASE}/api/v1/rentals/bookings/${rb.id}/cancel`, { method: "POST", headers: h });
    console.log(`  ${rbCancel.status === 200 ? "✓" : "✗"} rentals.booking.cancel → ${rbCancel.status}`);
    if (rbCancel.status !== 200) throw new Error(`rentals.booking.cancel failed: ${rbCancel.status}`);
  }

  const pRentals = await fetch(`${BASE}/api/v1/partner/rentals`, { headers: h });
  console.log(`  ${pRentals.status === 403 ? "✓" : "✗"} partner.rentals-traveler-403 → ${pRentals.status}`);
  if (pRentals.status !== 403) throw new Error(`partner.rentals guard failed: ${pRentals.status}`);

  const eventsRes = await fetch(`${BASE}/api/v1/events?perPage=5`, { headers: h });
  check("events.list", eventsRes);
  const eventsBody = (await eventsRes.json()) as { items: Array<{ id: string; ticketCategories?: Array<{ id: string }> }> };
  if (!Array.isArray(eventsBody.items)) throw new Error("events.list envelope missing items");

  const withCat = eventsBody.items.find((x) => Array.isArray(x.ticketCategories) && x.ticketCategories.length > 0);
  if (!withCat) {
    console.log("  ○ events.booking skipped — no event with categories in seed");
  } else {
    const ebRes = await fetch(`${BASE}/api/v1/events/bookings`, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: withCat.id, ticketCategoryId: withCat.ticketCategories![0]!.id, quantity: 1 }),
    });
    console.log(`  ${ebRes.status === 201 ? "✓" : "✗"} events.booking.create → ${ebRes.status}`);
    if (ebRes.status !== 201) throw new Error(`events.booking.create failed: ${ebRes.status} ${await ebRes.text()}`);
    const eb = (await ebRes.json()) as { id: string };
    const ebCancel = await fetch(`${BASE}/api/v1/events/bookings/${eb.id}/cancel`, { method: "POST", headers: h });
    console.log(`  ${ebCancel.status === 200 ? "✓" : "✗"} events.booking.cancel → ${ebCancel.status}`);
    if (ebCancel.status !== 200) throw new Error(`events.booking.cancel failed: ${ebCancel.status}`);
  }

  const pEvents2 = await fetch(`${BASE}/api/v1/partner/events`, { headers: h });
  console.log(`  ${pEvents2.status === 403 ? "✓" : "✗"} partner.events-traveler-403 → ${pEvents2.status}`);
  if (pEvents2.status !== 403) throw new Error(`partner.events guard failed: ${pEvents2.status}`);

  const insList = await fetch(`${BASE}/api/v1/insurance/policies?perPage=5`, { headers: h });
  check("insurance.list", insList);
  const insBody = (await insList.json()) as { items: unknown[] };
  if (!Array.isArray(insBody.items)) throw new Error("insurance.list envelope missing items");

  const insCreate = await fetch(`${BASE}/api/v1/insurance/policies`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ destination: "France", startDate: "2026-12-01", endDate: "2026-12-10", travelersCount: 2, coverageType: "standard" }),
  });
  console.log(`  ${insCreate.status === 201 ? "✓" : "✗"} insurance.create → ${insCreate.status}`);
  if (insCreate.status !== 201) throw new Error(`insurance.create failed: ${insCreate.status} ${await insCreate.text()}`);
  const ins = (await insCreate.json()) as { id: string };
  const insCancel = await fetch(`${BASE}/api/v1/insurance/policies/${ins.id}/cancel`, { method: "POST", headers: h });
  console.log(`  ${insCancel.status === 200 ? "✓" : "✗"} insurance.cancel → ${insCancel.status}`);
  if (insCancel.status !== 200) throw new Error(`insurance.cancel failed: ${insCancel.status}`);

  const insAdmin = await fetch(`${BASE}/api/v1/admin/insurance/policies`, { headers: h });
  console.log(`  ${insAdmin.status === 403 ? "✓" : "✗"} admin.insurance-traveler-403 → ${insAdmin.status}`);
  if (insAdmin.status !== 403) throw new Error(`admin.insurance guard failed: ${insAdmin.status}`);

  // Idempotency replay: same key twice → same status+body
  const key = `smoke-${Date.now()}`;
  const payload = { name: "Smoke", email: "s@s.cm", message: "hello smoke replay" };
  const first = await fetch(`${BASE}/api/v1/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(payload),
  });
  const second = await fetch(`${BASE}/api/v1/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(payload),
  });
  const firstText = await first.text();
  const secondText = await second.text();
  console.log(`  ${first.status === second.status && firstText === secondText ? "✓" : "✗"} idempotency.replay → ${first.status}/${second.status}`);
  if (first.status !== second.status || firstText !== secondText) throw new Error("idempotency replay mismatch");

  console.log("✓ verticals smoke passed");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  smokeVerticals().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { smokeVerticals };
