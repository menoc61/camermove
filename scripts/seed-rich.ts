/**
 * Rich multi-service seed for CamerMove — IDEMPOTENT (safe to re-run).
 *
 * Run: `pnpm seed:rich`  (pnpm --filter @camermove/api exec tsx ../../scripts/seed-rich.ts)
 * Verify: `pnpm seed:verify`
 *
 * Every record is created behind an upsert / findFirst guard keyed on a
 * unique field (emails, plates, tracking numbers, policy numbers, event
 * names, booking references...). A second run changes nothing.
 */
import * as argon2 from "argon2"
import { prisma } from "@camermove/db"

const U = "https://images.unsplash.com"

async function ensureUser(email: string, password: string, firstName: string, lastName: string, role: "admin" | "traveler" | "transporter_staff" | "super_admin") {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing
  return prisma.user.create({
    data: { email, passwordHash: await argon2.hash(password), firstName, lastName, role: role as never, emailVerified: true },
  })
}

async function ensureTransporter(email: string, companyName: string, city: string, commissionPercent: number) {
  return prisma.transporter.upsert({
    where: { email },
    update: { companyName, city, commissionPercent, status: "approved" },
    create: {
      companyName, contactName: "Direction", email, city,
      transportType: "bus", status: "approved", commissionPercent,
      servedRoutes: ["Yaoundé-Douala", "Douala-Yaoundé", "Yaoundé-Bafoussam"],
    },
  })
}

async function ensureVehicle(transporterId: string, plateNumber: string, type: string, capacity: number) {
  const existing = await prisma.vehicle.findFirst({ where: { plateNumber } })
  if (existing) return existing
  return prisma.vehicle.create({ data: { type, capacity, plateNumber, status: "active", transporterId } })
}

async function ensureRoute(transporterId: string, originCity: string, destinationCity: string) {
  const existing = await prisma.route.findFirst({ where: { transporterId, originCity, destinationCity } })
  if (existing) return existing
  return prisma.route.create({ data: { originCity, destinationCity, active: true, transporterId } })
}

async function main() {
  // ---------- Users ----------
  const traveler = await ensureUser("user@camermove.cm", "User123!", "Jean", "Voyageur", "traveler")
  await ensureUser("partner@camermove.cm", "Partner123!", "Paul", "Partenaire", "transporter_staff")
  await ensureUser("admin@camermove.cm", "Admin123!", "Admin", "CamerMove", "admin") // KEEP role if exists
  await ensureUser("super@camermove.cm", "Super123!", "Super", "Admin", "super_admin")

  // ---------- Transport ----------
  const transporterDefs = [
    { code: "CME", email: "express@camermove.cm", name: "CamerMove Express Douala", city: "Douala", commission: 10, plates: ["CE-1001-CM", "CE-1002-CM"] },
    { code: "GAR", email: "garanti@camermove.cm", name: "Garanti Express Yaoundé", city: "Yaoundé", commission: 8, plates: ["CE-2001-CM", "CE-2002-CM"] },
    { code: "GEN", email: "general-edea@camermove.cm", name: "Général Edéa", city: "Edéa", commission: 9, plates: ["CE-3001-CM", "CE-3002-CM"] },
  ]
  const routePairs: Array<[string, string]> = [["Yaoundé", "Douala"], ["Douala", "Yaoundé"], ["Yaoundé", "Bafoussam"]]
  const allRoutes: Array<{ id: string; code: string; origin: string; dest: string; transporterId: string }> = []

  for (const t of transporterDefs) {
    const tr = await ensureTransporter(t.email, t.name, t.city, t.commission)
    await ensureVehicle(tr.id, t.plates[0], "Autocar 55 places", 55)
    await ensureVehicle(tr.id, t.plates[1], "Autocar VIP 40 places", 40)
    for (const [o, d] of routePairs) {
      const r = await ensureRoute(tr.id, o, d)
      allRoutes.push({ id: r.id, code: t.code, origin: o, dest: d, transporterId: tr.id })
    }
  }
  // Link partner user to first transporter if not linked
  const firstTr = await prisma.transporter.findUnique({ where: { email: "express@camermove.cm" } })
  const partnerRow = await prisma.user.findUnique({ where: { email: "partner@camermove.cm" } })
  if (firstTr && partnerRow && !partnerRow.transporterId) {
    await prisma.user.update({ where: { id: partnerRow.id }, data: { transporterId: firstTr.id } })
  }

  // ---------- Trips: 14 days x 3/day per route ----------
  const midnight = new Date()
  midnight.setUTCHours(0, 0, 0, 0)
  let tripSeq = 0
  const tripRefs: Array<{ id: string; ref: string; transporterId: string; price: number }> = []
  for (const r of allRoutes) {
    for (let day = 1; day <= 14; day++) {
      for (const hour of [7, 13, 18]) {
        tripSeq++
        const departureAt = new Date(midnight.getTime() + day * 86400000)
        departureAt.setUTCHours(hour, 0, 0, 0)
        const inactive = tripSeq % 20 === 0 // ~5% inactive
        const status = inactive ? "inactive" : "active"
        const price = 5000 + day * 100 + (hour === 18 ? 500 : 0)
        const existing = await prisma.trip.findFirst({ where: { routeId: r.id, departureAt } })
        const trip = existing ?? (await prisma.trip.create({
          data: {
            routeId: r.id, transportId: r.transporterId, departureAt,
            arrivalEstimateAt: new Date(departureAt.getTime() + 4 * 3600000),
            durationEstimate: 240, price, totalSeats: 55,
            departurePointInfo: `${r.origin} — Gare centrale`, vehicleTypeInfo: "Autocar",
            status, seatAvailability: { create: { seatsAvailable: 55, seatsHeld: 0, seatsBooked: 0 } },
          },
        }))
        if (trip.status === "active") {
          const dstr = departureAt.toISOString().slice(0, 10).replace(/-/g, "")
          const ref = `CMR-${r.code}-${r.origin.slice(0, 3).toUpperCase()}-${dstr}-${hour}`
          tripRefs.push({ id: trip.id, ref, transporterId: r.transporterId, price: trip.price })
        }
      }
    }
  }

  // ---------- Traveler bookings on first 12 active trips ----------
  const statusCycle = ["confirmed", "confirmed", "pending_payment", "cancelled", "confirmed", "expired"] as const
  const bookingTargets = tripRefs.slice(0, 12)
  let bi = 0
  for (const t of bookingTargets) {
    const status = statusCycle[bi % statusCycle.length]
    const seatCount = (bi % 3) + 1
    const reference = `${t.ref}-B${bi + 1}`
    bi++
    let booking = await prisma.booking.findUnique({ where: { reference } })
    if (!booking) {
      const totalAmount = t.price * seatCount
      booking = await prisma.booking.create({
        data: {
          reference, tripId: t.id, userId: traveler.id, seatCount, totalAmount,
          status: status as never,
          holdExpiresAt: status === "pending_payment" ? new Date(Date.now() + 15 * 60 * 1000) : null,
          passengers: { create: Array.from({ length: seatCount }, (_, i) => ({ fullName: `Passager ${bi}-${i + 1}`, phone: `+2376900000${String(bi * 3 + i).padStart(2, "0").slice(-2)}` })) },
        },
      })
      // seat decrements (only on first creation → idempotent)
      const avail = await prisma.seatAvailability.findUnique({ where: { tripId: t.id } })
      if (avail) {
        if (status === "confirmed") {
          await prisma.seatAvailability.update({ where: { tripId: t.id }, data: { seatsAvailable: avail.seatsAvailable - seatCount, seatsBooked: avail.seatsBooked + seatCount } })
        } else if (status === "pending_payment") {
          await prisma.seatAvailability.update({ where: { tripId: t.id }, data: { seatsAvailable: avail.seatsAvailable - seatCount, seatsHeld: avail.seatsHeld + seatCount } })
        }
      }
      // payment (notchpay)
      const payStatus = status === "confirmed" ? "success" : status === "pending_payment" ? "pending" : status === "cancelled" ? "refunded" : "expired"
      await prisma.payment.create({
        data: {
          bookingId: booking.id, provider: "notchpay", providerRef: `seed-${reference}`,
          amount: totalAmount, currency: "XAF", method: "mobile_money", status: payStatus as never,
          webhookPayload: { seed: true, reference },
        },
      })
      // 10% commission + ticket for confirmed
      if (status === "confirmed") {
        const fee = Math.round(totalAmount * 0.1)
        await prisma.commission.create({ data: { bookingId: booking.id, grossAmount: totalAmount, commissionAmount: fee, netAmount: totalAmount - fee, percentApplied: 10 } })
        await prisma.ticket.create({ data: { bookingId: booking.id, qrCode: `QR-${reference}`, verificationCode: `VRF-${reference}`, status: "valid" } })
      }
      // notification + audit log (guarded: created only with the booking)
      await prisma.notification.create({
        data: { userId: traveler.id, channel: "email", type: `booking.${status}`, status: "sent", payload: { bookingId: booking.id, reference }, sentAt: new Date() },
      })
      await prisma.auditLog.create({
        data: {
          actorId: traveler.id, action: "booking.create", entityType: "Booking", entityId: booking.id,
          metadata: { tripId: t.id, seatCount, totalAmount, reference, ip: "127.0.0.1", os: "seed", browser: "seed", device: "seed", userId: traveler.id },
        },
      })
    }
  }

  // ---------- Hotels ----------
  const hotelDefs = [
    { name: "Mont Fébé Yaoundé", city: "Yaoundé", stars: 5, status: "approved", rooms: [["Chambre Classique", 45000], ["Suite Panoramique", 120000], ["Chambre Deluxe", 75000]] },
    { name: "Akwa Palace Douala", city: "Douala", stars: 5, status: "approved", rooms: [["Chambre Standard", 55000], ["Suite Exécutive", 150000], ["Chambre Familiale", 95000]] },
    { name: "Résidence Bonapriso Douala", city: "Douala", stars: 4, status: "approved", rooms: [["Studio", 35000], ["Appartement 2 chambres", 80000]] },
    { name: "Hôtel du Centre Bafoussam", city: "Bafoussam", stars: 3, status: "approved", rooms: [["Chambre Simple", 18000], ["Chambre Double", 28000]] },
    { name: "Sawa Beach Limbé", city: "Limbé", stars: 4, status: "approved", rooms: [["Chambre Vue Mer", 60000], ["Bungalow Plage", 110000], ["Chambre Jardin", 40000]] },
    { name: "Auberge du Mont Bamenda", city: "Bamenda", stars: 3, status: "pending", rooms: [["Chambre Simple", 20000], ["Chambre Double", 32000]] },
  ]
  for (const h of hotelDefs) {
    let hotel = await prisma.hotel.findFirst({ where: { name: h.name } })
    if (!hotel) {
      hotel = await prisma.hotel.create({
        data: {
          name: h.name, description: `${h.name} — établissement partenaire CamerMove.`, address: "Centre-ville",
          city: h.city, region: h.city, country: "Cameroun", starRating: h.stars,
          amenities: ["wifi", "piscine", "restaurant", "parking"], photos: [`${U}/photo-1566073771259-6a8506099945?w=800`],
          status: "active", partnerStatus: h.status,
        },
      })
    }
    for (const [roomName, price] of h.rooms as Array<[string, number]>) {
      const existingRoom = await prisma.hotelRoom.findFirst({ where: { hotelId: hotel.id, name: roomName } })
      if (!existingRoom) {
        await prisma.hotelRoom.create({
          data: {
            hotelId: hotel.id, name: roomName, description: `${roomName} — ${h.name}`, capacity: 2,
            bedType: "double", amenities: ["wifi", "climatisation", "tv"], photos: [`${U}/photo-1611892440504-42a792e24d32?w=800`],
            pricePerNight: price, currency: "XAF", quantity: 5, status: "available",
          },
        })
      }
    }
    // 1 confirmed booking per approved hotel
    if (h.status === "approved") {
      const room = await prisma.hotelRoom.findFirst({ where: { hotelId: hotel.id }, orderBy: { pricePerNight: "asc" } })
      if (room) {
        const checkIn = new Date(midnight.getTime() + 7 * 86400000)
        const checkOut = new Date(midnight.getTime() + 9 * 86400000)
        const existingB = await prisma.hotelBooking.findFirst({ where: { hotelId: hotel.id, userId: traveler.id, checkInDate: checkIn } })
        if (!existingB) {
          const total = room.pricePerNight * 2
          const pay = await prisma.payment.create({
            data: { provider: "notchpay", providerRef: `seed-hotel-${hotel.id.slice(-6)}`, amount: total, currency: "XAF", method: "mobile_money", status: "success", webhookPayload: { seed: true, hotel: h.name } },
          })
          await prisma.hotelBooking.create({
            data: {
              hotelId: hotel.id, roomTypeId: room.id, userId: traveler.id,
              checkInDate: checkIn, checkOutDate: checkOut, guestCount: 2,
              totalAmount: total, currency: "XAF", status: "confirmed",
              guestNames: ["Jean Voyageur", "Marie Voyageur"], paymentId: pay.id,
            },
          })
        }
      }
    }
  }

  // ---------- Rentals: 8 vehicles ----------
  const rentalDefs = [
    { plate: "LT-0101-CM", cat: "citadine", make: "Toyota", model: "Yaris", city: "Douala", price: 16000, driver: false },
    { plate: "LT-0102-CM", cat: "berline", make: "Toyota", model: "Corolla", city: "Douala", price: 25000, driver: true },
    { plate: "LT-0103-CM", cat: "SUV", make: "Toyota", model: "RAV4", city: "Yaoundé", price: 45000, driver: true },
    { plate: "LT-0104-CM", cat: "SUV", make: "Nissan", model: "Patrol", city: "Yaoundé", price: 60000, driver: true },
    { plate: "LT-0105-CM", cat: "minibus", make: "Toyota", model: "Hiace", city: "Yaoundé", price: 55000, driver: true },
    { plate: "LT-0106-CM", cat: "pickup", make: "Ford", model: "Ranger", city: "Bafoussam", price: 50000, driver: false },
    { plate: "LT-0107-CM", cat: "berline", make: "Honda", model: "Accord", city: "Douala", price: 35000, driver: false },
    { plate: "LT-0108-CM", cat: "SUV", make: "Range Rover", model: "Evoque", city: "Douala", price: 120000, driver: true },
  ]
  const rentalVehicles: Array<{ id: string; price: number }> = []
  for (const v of rentalDefs) {
    const existing = await prisma.rentalVehicle.findUnique({ where: { licensePlate: v.plate } })
    const rv = existing ?? (await prisma.rentalVehicle.create({
      data: {
        category: v.cat, make: v.make, model: v.model, year: 2022, licensePlate: v.plate,
        capacity: v.cat === "minibus" ? 14 : 5, transmission: "automatique", fuelType: "diesel",
        hasDriver: v.driver, pricePerUnit: v.price, durationUnit: "day", currency: "XAF",
        pickupCity: v.city, pickupAddress: "Agence centrale", photos: [`${U}/photo-1503376780353-7e6692767b70?w=800`],
        amenities: ["climatisation", "gps"], status: "available", partnerStatus: "approved",
      },
    }))
    rentalVehicles.push({ id: rv.id, price: rv.pricePerUnit })
  }
  // 3 pending_payment bookings on first 3
  for (let i = 0; i < 3; i++) {
    const rv = rentalVehicles[i]
    const start = new Date(midnight.getTime() + (i + 2) * 86400000)
    const end = new Date(midnight.getTime() + (i + 4) * 86400000)
    const existingB = await prisma.rentalBooking.findFirst({ where: { rentalVehicleId: rv.id, userId: traveler.id, startDate: start } })
    if (!existingB) {
      const total = rv.price * 2
      const pay = await prisma.payment.create({
        data: { provider: "notchpay", providerRef: `seed-rental-${i}`, amount: total, currency: "XAF", method: "mobile_money", status: "pending", webhookPayload: { seed: true } },
      })
      await prisma.rentalBooking.create({
        data: {
          rentalVehicleId: rv.id, userId: traveler.id, startDate: start, endDate: end,
          duration: 2, durationUnit: "day", totalAmount: total, currency: "XAF",
          status: "pending_payment", pickupCity: rentalDefs[i].city, paymentId: pay.id,
        },
      })
    }
  }

  // ---------- Parcels: 2 operators, 8 parcels ----------
  const opA = await prisma.parcelOperator.upsert({
    where: { email: "colis@coliexpress.cm" },
    update: { citiesServed: ["Yaoundé", "Douala", "Bafoussam", "Bamenda", "Limbé"] },
    create: { companyName: "ColiExpress", contactName: "Service Colis", email: "colis@coliexpress.cm", citiesServed: ["Yaoundé", "Douala", "Bafoussam", "Bamenda", "Limbé"], status: "active", partnerStatus: "approved" },
  })
  const opB = await prisma.parcelOperator.upsert({
    where: { email: "contact@citysend.cm" },
    update: { citiesServed: ["Yaoundé", "Douala", "Kribi"] },
    create: { companyName: "CitySend", contactName: "Service Envois", email: "contact@citysend.cm", citiesServed: ["Yaoundé", "Douala", "Kribi"], status: "active", partnerStatus: "approved" },
  })
  const parcelDefs: Array<{ tn: string; op: string; from: string; to: string; weight: number; cost: number; status: "delivered" | "in_transit" | "picked_up" | "registered" }> = [
    { tn: "CM-2026-0001", op: opA.id, from: "Yaoundé", to: "Douala", weight: 2.5, cost: 3000, status: "delivered" },
    { tn: "CM-2026-0002", op: opA.id, from: "Douala", to: "Yaoundé", weight: 5.0, cost: 5000, status: "delivered" },
    { tn: "CM-2026-0003", op: opA.id, from: "Yaoundé", to: "Bafoussam", weight: 1.2, cost: 2500, status: "delivered" },
    { tn: "CM-2026-0004", op: opB.id, from: "Bamenda", to: "Yaoundé", weight: 3.0, cost: 4000, status: "delivered" },
    { tn: "CM-2026-0005", op: opA.id, from: "Yaoundé", to: "Douala", weight: 0.8, cost: 2000, status: "in_transit" },
    { tn: "CM-2026-0006", op: opB.id, from: "Douala", to: "Limbé", weight: 4.5, cost: 3500, status: "in_transit" },
    { tn: "CM-2026-0007", op: opA.id, from: "Bafoussam", to: "Douala", weight: 2.0, cost: 3000, status: "picked_up" },
    { tn: "CM-2026-0008", op: opB.id, from: "Yaoundé", to: "Bamenda", weight: 1.5, cost: 4500, status: "registered" },
  ]
  const fullChain = ["registered", "picked_up", "in_transit", "arrived", "available_for_pickup", "delivered"] as const
  for (const p of parcelDefs) {
    let parcel = await prisma.parcel.findUnique({ where: { trackingNumber: p.tn } })
    if (!parcel) {
      parcel = await prisma.parcel.create({
        data: {
          trackingNumber: p.tn, operatorId: p.op, userId: traveler.id,
          senderName: "Jean Voyageur", senderPhone: "+237690000001", senderCity: p.from,
          recipientName: "Marie Voyageur", recipientPhone: "+237690000002", recipientCity: p.to,
          parcelType: "colis", weightKg: p.weight, description: `Colis ${p.tn}`,
          shippingCost: p.cost, currency: "XAF", status: p.status as never, currentLocation: p.status === "delivered" ? p.to : p.from,
        },
      })
    }
    const logCount = await prisma.parcelStatusLog.count({ where: { parcelId: parcel.id } })
    if (logCount === 0) {
      const chain = p.status === "delivered" ? fullChain : p.status === "in_transit" ? (["registered", "picked_up", "in_transit"] as const) : p.status === "picked_up" ? (["registered", "picked_up"] as const) : (["registered"] as const)
      for (const s of chain) {
        await prisma.parcelStatusLog.create({ data: { parcelId: parcel.id, status: s as never, location: s === "registered" ? p.from : undefined, note: `seed: ${s}` } })
      }
    }
  }

  // ---------- Insurance: 5 policies ----------
  const policyDefs = [
    { num: "POL-2026-0001", dest: "Europe", cov: "premium", premium: 75000, status: "confirmed" },
    { num: "POL-2026-0002", dest: "Asie", cov: "standard", premium: 45000, status: "confirmed" },
    { num: "POL-2026-0003", dest: "Amérique du Nord", cov: "premium", premium: 85000, status: "pending_payment" },
    { num: "POL-2026-0004", dest: "Afrique de l'Ouest", cov: "basic", premium: 15000, status: "pending_payment" },
    { num: "POL-2026-0005", dest: "Moyen-Orient", cov: "standard", premium: 50000, status: "pending_payment" },
  ]
  for (const p of policyDefs) {
    const existing = await prisma.insurancePolicy.findUnique({ where: { policyNumber: p.num } })
    if (!existing) {
      const pay = await prisma.payment.create({
        data: { provider: "notchpay", providerRef: `seed-${p.num}`, amount: p.premium, currency: "XAF", method: "mobile_money", status: p.status === "confirmed" ? "success" : "pending", webhookPayload: { seed: true } },
      })
      await prisma.insurancePolicy.create({
        data: {
          userId: traveler.id, providerName: "CamerMove Assurance", coverageType: p.cov as never,
          destination: p.dest, startDate: new Date(midnight.getTime() + 10 * 86400000),
          endDate: new Date(midnight.getTime() + 40 * 86400000), travelers: 2,
          premium: p.premium, currency: "XAF", status: p.status as never, policyNumber: p.num, paymentId: pay.id,
        },
      })
    }
  }

  // ---------- Events: 5 events, 2-3 categories each, 1 confirmed booking each ----------
  const eventDefs = [
    { name: "Concert Makossa Night", type: "concert", city: "Douala", venue: "Palais des Sports", inDays: 20, durDays: 1, cats: [["Standard", 5000, 500], ["VIP", 25000, 100], ["VVIP", 75000, 20]] as Array<[string, number, number]> },
    { name: "Match Coton Sport vs Canon", type: "sport", city: "Yaoundé", venue: "Stade Ahmadou Ahidjo", inDays: 14, durDays: 1, cats: [["Tribune", 2000, 1000], ["VIP", 15000, 200]] as Array<[string, number, number]> },
    { name: "Conférence Tech Yaoundé", type: "conference", city: "Yaoundé", venue: "Palais des Congrès", inDays: 30, durDays: 2, cats: [["Early Bird", 10000, 300], ["Régulier", 20000, 500]] as Array<[string, number, number]> },
    { name: "Festival Ngondo", type: "festival", city: "Douala", venue: "Berges du Wouri", inDays: 45, durDays: 6, cats: [["Pass Jour", 3000, 2000], ["Pass Festival", 12000, 800], ["Premium", 30000, 150]] as Array<[string, number, number]> },
    { name: "Salon Promote", type: "other", city: "Yaoundé", venue: "Parc des Expositions", inDays: 60, durDays: 10, cats: [["Visiteur", 2500, 5000], ["Exposant", 50000, 300]] as Array<[string, number, number]> },
  ]
  for (const e of eventDefs) {
    let event = await prisma.event.findFirst({ where: { name: e.name } })
    if (!event) {
      event = await prisma.event.create({
        data: {
          name: e.name, description: `${e.name} — événement partenaire CamerMove.`,
          eventType: e.type as never, posterUrl: `${U}/photo-1470229722913-7c0e2dbbafd3?w=800`,
          venue: e.venue, city: e.city,
          startDate: new Date(midnight.getTime() + e.inDays * 86400000),
          endDate: new Date(midnight.getTime() + (e.inDays + e.durDays) * 86400000),
          status: "on_sale", partnerStatus: "approved",
        },
      })
    }
    for (const [catName, price, qty] of e.cats) {
      const existingCat = await prisma.ticketCategory.findFirst({ where: { eventId: event.id, name: catName } })
      if (!existingCat) {
        await prisma.ticketCategory.create({
          data: { eventId: event.id, name: catName, description: `${catName} — ${e.name}`, price, currency: "XAF", quantity: qty, sold: Math.min(10, Math.floor(qty / 10)), status: "on_sale" },
        })
      }
    }
    // 1 confirmed booking: cheapest category x2
    const cheapest = await prisma.ticketCategory.findFirst({ where: { eventId: event.id }, orderBy: { price: "asc" } })
    if (cheapest) {
      const ticketNumber = `EVT-${event.id.slice(-6).toUpperCase()}-01`
      const existingB = await prisma.eventBooking.findUnique({ where: { ticketNumber } })
      if (!existingB) {
        const total = cheapest.price * 2
        const pay = await prisma.payment.create({
          data: { provider: "notchpay", providerRef: `seed-${ticketNumber}`, amount: total, currency: "XAF", method: "mobile_money", status: "success", webhookPayload: { seed: true } },
        })
        await prisma.eventBooking.create({
          data: {
            eventId: event.id, ticketCategoryId: cheapest.id, userId: traveler.id,
            quantity: 2, totalAmount: total, currency: "XAF", status: "confirmed",
            ticketNumber, qrCode: `QR-${ticketNumber}`, paymentId: pay.id,
          },
        })
      }
    }
  }

  // ---------- PartnerApplications: 3 ----------
  const appDefs = [
    { email: "candidat1@transport.cm", company: "Trans Ouest", status: "received" },
    { email: "candidat2@transport.cm", company: "Sahel Voyages", status: "reviewing" },
    { email: "candidat3@transport.cm", company: "Forêt Express", status: "rejected" },
  ]
  for (const a of appDefs) {
    const existing = await prisma.partnerApplication.findFirst({ where: { email: a.email } })
    if (!existing) {
      await prisma.partnerApplication.create({
        data: {
          companyName: a.company, contactName: "Candidat", phone: "+237690000010",
          email: a.email, city: "Yaoundé", transportType: "bus", vehicleCount: 3,
          routesServed: ["Yaoundé-Douala"], message: "Candidature seed", status: a.status as never,
        },
      })
    }
  }

  // ---------- AppSettings ----------
  await prisma.appSettings.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global", commissionPercent: 10, holdExpiryMinutes: 15,
      cancellationPolicy: "Annulation possible jusqu'à 1h avant le départ. Remboursement sous 72h.",
    },
  })

  const counts = {
    users: await prisma.user.count(),
    transporters: await prisma.transporter.count(),
    trips: await prisma.trip.count(),
    bookings: await prisma.booking.count(),
    hotels: await prisma.hotel.count(),
    hotelRooms: await prisma.hotelRoom.count(),
    rentalVehicles: await prisma.rentalVehicle.count(),
    parcels: await prisma.parcel.count(),
    policies: await prisma.insurancePolicy.count(),
    events: await prisma.event.count(),
    ticketCategories: await prisma.ticketCategory.count(),
    payments: await prisma.payment.count(),
  }
  console.log("seed:rich complete", JSON.stringify(counts))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
