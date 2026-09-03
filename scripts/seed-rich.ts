import { prisma } from "../packages/db/src/prisma"
import { seedCorridorStops } from "../packages/db/prisma/corridor-stops"
import { hashPassword } from "../apps/api/src/auth/password"

async function main() {
  console.log("🌱 Rich seed start")

  // ── Users (ensure deterministic demo accounts) ──────────────────────────
  const demoUsers = [
    { email: "traveler@camermove.cm", role: "traveler", firstName: "Awa", lastName: "Mbarga" },
    { email: "admin@camermove.cm", role: "admin", firstName: "Admin", lastName: "CamerMove" },
    { email: "super@camermove.cm", role: "super_admin", firstName: "Super", lastName: "Admin" },
    { email: "partner@camermove.cm", role: "transporter_staff", firstName: "Paul", lastName: "Talla" },
  ] as const

  const passwordHash = await hashPassword("motdepasse123")
  const userMap: Record<string, string> = {}

  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role as never, passwordHash, firstName: u.firstName, lastName: u.lastName, status: "active" },
      create: { email: u.email, role: u.role as never, passwordHash, firstName: u.firstName, lastName: u.lastName, status: "active" },
    })
    userMap[u.email] = user.id
    console.log(`  user ${u.email} -> ${user.id} (${u.role})`)
  }

  // ── Transporters (4) ─────────────────────────────────────────────────────
  const transportersData = [
    { companyName: "CamerMove Express", email: "express@camermove.cm", city: "Douala", transportType: "bus", status: "approved" as const, commissionPercent: 10 },
    { companyName: "Garanti Express", email: "garanti@camermove.cm", city: "Yaoundé", transportType: "bus", status: "approved" as const, commissionPercent: 8 },
    { companyName: "Buca Voyages", email: "buca@camermove.cm", city: "Douala", transportType: "bus", status: "pending" as const },
    { companyName: "Central Voyages", email: "central@camermove.cm", city: "Bafoussam", transportType: "minibus", status: "reviewing" as const },
  ]

  const transporters: Array<{ id: string; companyName: string; email: string }> = []
  for (const t of transportersData) {
    const tr = await prisma.transporter.upsert({
      where: { email: t.email },
      update: { companyName: t.companyName, city: t.city, transportType: t.transportType, status: t.status as never, commissionPercent: t.commissionPercent as never },
      create: { companyName: t.companyName, email: t.email, city: t.city, transportType: t.transportType, status: t.status as never, commissionPercent: t.commissionPercent as never },
    })
    transporters.push(tr as never)
    // link partner user to first transporter
    if (t.email === "express@camermove.cm" && userMap["partner@camermove.cm"]) {
      await prisma.user.update({ where: { id: userMap["partner@camermove.cm"] }, data: { transporterId: tr.id } }).catch(()=>{})
    }
    // vehicles
    const vCount = await prisma.vehicle.count({ where: { transporterId: tr.id } })
    if (vCount === 0) {
      for (let i=1;i<=2;i++) {
        await prisma.vehicle.create({
          data: { transporterId: tr.id, type: i===1 ? "Autocar 55 places" : "Minibus 30 places", capacity: i===1 ? 55 : 30, plateNumber: `CE-${100+i}-${tr.companyName.slice(0,2).toUpperCase()}`, status: "active" as never },
        })
      }
    }
  }
  console.log(`  ${transporters.length} transporters`)

  // ── Routes ───────────────────────────────────────────────────────────────
  const routesDef = [
    { originCity: "Yaoundé", destinationCity: "Douala" },
    { originCity: "Douala", destinationCity: "Yaoundé" },
    { originCity: "Yaoundé", destinationCity: "Bafoussam" },
    { originCity: "Douala", destinationCity: "Limbe" },
    { originCity: "Yaoundé", destinationCity: "Bamenda" },
  ]
  const allRoutes: Array<{ id: string; originCity: string; destinationCity: string; transporterId: string }> = []
  for (const tr of transporters) {
    // each transporter gets 2 routes round-robin
    const picks = routesDef.slice(0,2)
    for (const r of picks) {
      const existing = await prisma.route.findFirst({ where: { originCity: r.originCity, destinationCity: r.destinationCity, transporterId: tr.id } })
      const route = existing ?? await prisma.route.create({ data: { originCity: r.originCity, destinationCity: r.destinationCity, transporterId: tr.id, active: true } })
      allRoutes.push(route as never)
    }
  }
  console.log(`  ${allRoutes.length} routes`)

  // ── Trips (next 14 days, 3 per day per route, priced by transporter) ─────
  const start = new Date(); start.setHours(0,0,0,0)
  let tripCount = 0
  for (const route of allRoutes) {
    const tr = transporters.find(x=>x.id===route.transporterId)!
    const basePrice = tr.companyName.includes("Garanti") ? 6500 : tr.companyName.includes("Buca") ? 5500 : 7000
    for (let day=1; day<=14; day++) {
      for (const hour of [7,13,18]) {
        const departureAt = new Date(start.getTime() + day*86400000)
        departureAt.setUTCHours(hour,0,0,0)
        const exists = await prisma.trip.findFirst({ where: { routeId: route.id, departureAt } })
        if (exists) continue
        const vehicle = await prisma.vehicle.findFirst({ where: { transporterId: route.transporterId } })
        await prisma.trip.create({
          data: {
            routeId: route.id,
            transportId: route.transporterId,
            vehicleId: vehicle?.id,
            departureAt,
            arrivalEstimateAt: new Date(departureAt.getTime()+4*3600000),
            durationEstimate: 240,
            price: basePrice + (day%3)*500 + (hour===7?0:hour===13?300:500),
            totalSeats: 55,
            departurePointInfo: route.originCity + " Gare routière",
            vehicleTypeInfo: "Autocar climatisé",
            conditions: "Bagage 20kg inclus",
            cancellationPolicy: "Annulation jusqu'à 1h avant départ",
            status: Math.random() < 0.05 ? "inactive" : "active",
            seatAvailability: { create: { seatsAvailable: 55, seatsHeld: 0, seatsBooked: 0 } },
          }
        })
        tripCount++
      }
    }
  }
  console.log(`  +${tripCount} trips (total ${await prisma.trip.count()})`)

  // ── Bookings + Payments + Tickets + Commissions ─────────────────────────
  const travelerId = userMap["traveler@camermove.cm"]!
  const trips = await prisma.trip.findMany({ where: { status: "active", departureAt: { gt: new Date() } }, take: 20, include: { seatAvailability: true } })
  let bookingCount = 0
  for (let i=0;i<trips.length && i<12;i++) {
    const trip = trips[i]!
    const seatCount = (i%3)+1
    const ref = `CM-RICH-${Date.now().toString(36).toUpperCase()}-${i}`
    const status = i<4 ? "confirmed" : i<8 ? "pending_payment" : i<10 ? "cancelled" : "expired"
    // skip if already booked same trip by traveler
    const exists = await prisma.booking.findFirst({ where: { tripId: trip.id, userId: travelerId, seatCount } })
    if (exists) continue
    // ensure seats
    if ((trip.seatAvailability?.seatsAvailable ?? 55) < seatCount) continue

    const booking = await prisma.booking.create({
      data: {
        reference: ref,
        tripId: trip.id,
        userId: travelerId,
        seatCount,
        totalAmount: trip.price * seatCount,
        status: status as never,
        passengers: { create: Array.from({length: seatCount}).map((_,idx)=>({ fullName: `Passager ${idx+1} Rich`, phone: `69900000${i}${idx}` })) },
        holdExpiresAt: status==="pending_payment" ? new Date(Date.now()+15*60000) : null,
      }
    })
    // update seat availability
    if (status==="confirmed") {
      await prisma.seatAvailability.update({ where: { tripId: trip.id }, data: { seatsAvailable: { decrement: seatCount }, seatsBooked: { increment: seatCount } } }).catch(()=>{})
    } else if (status==="pending_payment") {
      await prisma.seatAvailability.update({ where: { tripId: trip.id }, data: { seatsAvailable: { decrement: seatCount }, seatsHeld: { increment: seatCount } } }).catch(()=>{})
    }

    if (status==="confirmed" || status==="pending_payment") {
      const payStatus = status==="confirmed" ? "success" : "pending"
      const payment = await prisma.payment.create({
        data: { bookingId: booking.id, provider: "notchpay" as never, providerRef: `NP-${ref}`, amount: booking.totalAmount, status: payStatus as never, method: "mobile_money" as never },
      })
      if (status==="confirmed") {
        const pct = 10
        const commissionAmount = Math.round(booking.totalAmount * pct / 100)
        await prisma.commission.create({
          data: { bookingId: booking.id, grossAmount: booking.totalAmount, commissionAmount, netAmount: booking.totalAmount - commissionAmount, percentApplied: pct, payoutStatus: i%2===0 ? "pending" : "paid" },
        }).catch(()=>{})
        const verificationCode = `VK-${ref.slice(-6)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`
        await prisma.ticket.create({
          data: { bookingId: booking.id, verificationCode, qrCode: verificationCode, status: "valid" as never, qrDataUrl: `data:image/png;base64,${Buffer.from(verificationCode).toString('base64')}` },
        }).catch(()=>{})
        // notification
        await prisma.notification.create({
          data: { userId: travelerId, channel: "email" as never, type: "booking.confirmed", status: "sent" as never, payload: { reference: ref, bookingId: booking.id } as never, sentAt: new Date() },
        }).catch(()=>{})
      }
    }
    // audit log
    await prisma.auditLog.create({
      data: { actorId: travelerId, action: "booking.create", entityType: "Booking", entityId: booking.id, metadata: { tripId: trip.id, seatCount, status } as never },
    }).catch(()=>{})
    bookingCount++
  }
  console.log(`  ${bookingCount} bookings created`)

  // ── Partner applications (various statuses) ──────────────────────────────
  const apps = [
    { companyName: "Save Express", email: "save@demo.cm", city: "Douala", status: "received" as const, contactName: "Jean Save", phone: "677000001", routesServed: ["Yaoundé-Douala"] },
    { companyName: "Touristique Express", email: "touristique@demo.cm", city: "Yaoundé", status: "reviewing" as const, contactName: "Marie Touri", phone: "677000002", routesServed: ["Yaoundé-Bafoussam","Douala-Limbe"] },
    { companyName: "Alliance Voyages", email: "alliance@demo.cm", city: "Bafoussam", status: "rejected" as const, contactName: "Pierre Alliance", phone: "677000003", routesServed: ["Yaoundé-Bamenda"] },
  ]
  for (const a of apps) {
    const exists = await prisma.partnerApplication.findFirst({ where: { companyName: a.companyName } })
    if (exists) continue
    await prisma.partnerApplication.create({
      data: { companyName: a.companyName, contactName: a.contactName, phone: a.phone, email: a.email, city: a.city, status: a.status as never, routesServed: a.routesServed, message: `Candidature démo ${a.status}` },
    })
  }
  console.log(`  partner applications seeded`)

  // ── AppSettings ensure ───────────────────────────────────────────────────
  await prisma.appSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", commissionPercent: 10, holdExpiryMinutes: 15, cancellationPolicy: "Annulation jusqu'à 1h avant départ", smtpFrom: "no-reply@camermove.cm" },
  })

  // Corridor stops for the Yaoundé ⇄ Douala axis (terminus Mimboman + en-route dépôts)
  const stopCount = await seedCorridorStops(prisma)
  console.log(`  Corridor stops upserted: ${stopCount}`)

  console.log("✅ Rich seed complete")
  console.log(`  Accounts: traveler / admin / super@ / partner@  → password: motdepasse123`)
}

main().catch(e=>{console.error(e); process.exit(1)}).finally(async()=>{await prisma.$disconnect()})
