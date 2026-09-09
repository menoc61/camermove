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

  // ── Hotels & apartments ──────────────────────────────────────────────────
  const hotelsData = [
    {
      name: "Hôtel Mont Febe", city: "Yaoundé", region: "Centre", address: "Route de Nkolbisson",
      starRating: 5, partnerStatus: "approved",
      description: "Hôtel 5 étoiles perché sur les collines de Yaoundé, vue panoramique sur la ville, piscine, spa et trois restaurants.",
      amenities: ["wifi", "pool", "spa", "parking", "restaurant", "gym", "air_conditioning", "bar"],
      photos: [
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80",
        "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80",
        "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80",
      ],
      rooms: [
        { name: "Chambre Standard", capacity: 2, bedType: "Queen", pricePerNight: 45000, quantity: 30, amenities: ["wifi", "tv", "air_conditioning"] },
        { name: "Suite Junior", capacity: 3, bedType: "King", pricePerNight: 85000, quantity: 12, amenities: ["wifi", "tv", "air_conditioning", "balcony", "minibar"] },
        { name: "Suite Présidentielle", capacity: 4, bedType: "King", pricePerNight: 220000, quantity: 3, amenities: ["wifi", "tv", "air_conditioning", "balcony", "minibar", "jacuzzi", "lounge"] },
      ],
    },
    {
      name: "Akwa Palace", city: "Douala", region: "Littoral", address: "Rue Joss, Bonanjo",
      starRating: 5, partnerStatus: "approved",
      description: "Au cœur du quartier d'affaires de Douala, à 5 min de l'aéroport. Chambres insonorisées, business center, salle de conférence.",
      amenities: ["wifi", "pool", "parking", "restaurant", "gym", "air_conditioning", "bar", "business_center"],
      photos: [
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80",
        "https://images.unsplash.com/photo-1455587734955-081b22074882?w=1200&q=80",
      ],
      rooms: [
        { name: "Chambre Business", capacity: 2, bedType: "Queen", pricePerNight: 65000, quantity: 40, amenities: ["wifi", "tv", "air_conditioning", "desk"] },
        { name: "Suite Exécutive", capacity: 2, bedType: "King", pricePerNight: 120000, quantity: 15, amenities: ["wifi", "tv", "air_conditioning", "balcony", "lounge", "desk"] },
      ],
    },
    {
      name: "Residence Bonapriso", city: "Douala", region: "Littoral", address: "Rue Drouot, Bonapriso",
      starRating: 4, partnerStatus: "approved",
      description: "Appartements meublés tout équipés, kitchenette, idéal pour séjours d'affaires prolongés.",
      amenities: ["wifi", "parking", "kitchenette", "air_conditioning", "tv", "workspace"],
      photos: [
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
      ],
      rooms: [
        { name: "Studio", capacity: 2, bedType: "Double", pricePerNight: 28000, quantity: 18, amenities: ["wifi", "kitchenette", "air_conditioning"] },
        { name: "Appartement 2 pièces", capacity: 4, bedType: "Queen + sofa", pricePerNight: 48000, quantity: 10, amenities: ["wifi", "kitchenette", "air_conditioning", "balcony", "washing_machine"] },
        { name: "Appartement 3 pièces", capacity: 6, bedType: "King + Queen", pricePerNight: 75000, quantity: 6, amenities: ["wifi", "kitchenette", "air_conditioning", "balcony", "washing_machine", "parking"] },
      ],
    },
    {
      name: "Hôtel du Centre", city: "Bafoussam", region: "Ouest", address: "Avenue de l'Indépendance",
      starRating: 3, partnerStatus: "approved",
      description: "Hôtel confortable en centre-ville, idéal pour les voyageurs d'affaires. Restaurant local réputé.",
      amenities: ["wifi", "parking", "restaurant", "air_conditioning"],
      photos: [
        "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80",
      ],
      rooms: [
        { name: "Chambre Confort", capacity: 2, bedType: "Double", pricePerNight: 22000, quantity: 25, amenities: ["wifi", "tv", "air_conditioning"] },
        { name: "Suite Familiale", capacity: 4, bedType: "Double + lits simples", pricePerNight: 38000, quantity: 8, amenities: ["wifi", "tv", "air_conditioning", "balcony"] },
      ],
    },
    {
      name: "Sawa Beach Hotel", city: "Limbe", region: "Sud-Ouest", address: "Down Beach",
      starRating: 4, partnerStatus: "approved",
      description: "Face à l'océan Atlantique et au Mont Cameroun, hôtel de charme avec plage privée.",
      amenities: ["wifi", "beach", "pool", "restaurant", "air_conditioning", "parking", "bar"],
      photos: [
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",
        "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80",
      ],
      rooms: [
        { name: "Chambre Vue Mer", capacity: 2, bedType: "King", pricePerNight: 55000, quantity: 20, amenities: ["wifi", "tv", "air_conditioning", "balcony", "sea_view"] },
        { name: "Bungalow Jardin", capacity: 3, bedType: "King", pricePerNight: 95000, quantity: 8, amenities: ["wifi", "tv", "air_conditioning", "terrace", "garden_view"] },
      ],
    },
    {
      name: "Auberge du Mont", city: "Bamenda", region: "Nord-Ouest", address: "Commercial Avenue",
      starRating: 3, partnerStatus: "pending",
      description: "Auberge chaleureuse, point de départ idéal pour explorer les grassfields.",
      amenities: ["wifi", "restaurant", "parking"],
      photos: ["https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80"],
      rooms: [
        { name: "Chambre Standard", capacity: 2, bedType: "Double", pricePerNight: 18000, quantity: 15, amenities: ["wifi"] },
      ],
    },
  ]

  let hotelCount = 0
  let hotelBookingCount = 0
  for (const h of hotelsData) {
    const existing = await prisma.hotel.findFirst({ where: { name: h.name, city: h.city } })
    let hotel = existing
    if (!hotel) {
      hotel = await prisma.hotel.create({
        data: {
          name: h.name, city: h.city, region: h.region, address: h.address, country: "Cameroun",
          starRating: h.starRating, description: h.description, amenities: h.amenities,
          photos: h.photos, status: "active", partnerStatus: h.partnerStatus,
        } as never,
      })
    }
    if (hotel) {
      // Rooms
      const existingRooms = await prisma.hotelRoom.count({ where: { hotelId: hotel.id } })
      if (existingRooms === 0) {
        for (const r of h.rooms) {
          await prisma.hotelRoom.create({
            data: {
              hotelId: hotel.id, name: r.name, capacity: r.capacity, bedType: r.bedType,
              pricePerNight: r.pricePerNight, quantity: r.quantity, amenities: r.amenities, status: "available",
            } as never,
          })
        }
      }
      hotelCount++

      // Sample booking for the traveler
      if (h.partnerStatus === "approved") {
        const room = await prisma.hotelRoom.findFirst({ where: { hotelId: hotel.id } })
        if (room && travelerId) {
          const checkIn = new Date(); checkIn.setDate(checkIn.getDate() + 7); checkIn.setHours(0,0,0,0)
          const checkOut = new Date(checkIn); checkOut.setDate(checkOut.getDate() + 2)
          const nights = 2
          const total = room.pricePerNight * nights
          const existing = await prisma.hotelBooking.findFirst({ where: { userId: travelerId, hotelId: hotel.id } })
          if (!existing) {
            const booking = await prisma.hotelBooking.create({
              data: {
                hotelId: hotel.id, roomTypeId: room.id, userId: travelerId,
                checkInDate: checkIn, checkOutDate: checkOut, guestCount: 2,
                totalAmount: total, currency: "XAF", status: "confirmed",
                guestNames: ["Awa Mbarga", "Hôte"],
              } as never,
            })
            await prisma.payment.create({
              data: { hotelBookingId: booking.id, provider: "notchpay" as never, providerRef: `NP-HT-${booking.id.slice(-6)}`, amount: total, status: "success" as never, method: "mobile_money" as never },
            })
            hotelBookingCount++
          }
        }
      }
    }
  }
  console.log(`  ${hotelCount} hotels (with rooms); ${hotelBookingCount} hotel bookings`)

  // ── Rental vehicles ───────────────────────────────────────────────────────
  const rentalsData = [
    { make: "Toyota", model: "Corolla", year: 2023, category: "sedan", capacity: 5, transmission: "automatic", fuelType: "essence", hasDriver: false, pricePerUnit: 25000, pickupCity: "Douala", pickupAddress: "Aéroport International", amenities: ["air_conditioning", "bluetooth", "gps"] },
    { make: "Toyota", model: "RAV4", year: 2024, category: "suv", capacity: 5, transmission: "automatic", fuelType: "hybride", hasDriver: false, pricePerUnit: 45000, pickupCity: "Yaoundé", pickupAddress: "Hôtel Mont Febe", amenities: ["air_conditioning", "bluetooth", "gps", "4wd", "camera"] },
    { make: "Mercedes", model: "Classe C", year: 2023, category: "luxury", capacity: 5, transmission: "automatic", fuelType: "diesel", hasDriver: true, pricePerUnit: 85000, pickupCity: "Douala", pickupAddress: "Akwa Palace", amenities: ["air_conditioning", "bluetooth", "gps", "leather", "premium_audio"] },
    { make: "Hyundai", model: "H1", year: 2022, category: "minibus", capacity: 9, transmission: "manual", fuelType: "diesel", hasDriver: true, pricePerUnit: 55000, pickupCity: "Yaoundé", pickupAddress: "Carrefour Bastos", amenities: ["air_conditioning", "bluetooth"] },
    { make: "Renault", model: "Logan", year: 2022, category: "sedan", capacity: 5, transmission: "manual", fuelType: "essence", hasDriver: false, pricePerUnit: 18000, pickupCity: "Bafoussam", pickupAddress: "Gare Routière", amenities: ["air_conditioning"] },
    { make: "Toyota", model: "Hilux", year: 2024, category: "pickup", capacity: 5, transmission: "automatic", fuelType: "diesel", hasDriver: false, pricePerUnit: 60000, pickupCity: "Yaoundé", pickupAddress: "Mvan", amenities: ["air_conditioning", "bluetooth", "4wd"] },
    { make: "Peugeot", model: "208", year: 2023, category: "city", capacity: 5, transmission: "manual", fuelType: "essence", hasDriver: false, pricePerUnit: 16000, pickupCity: "Douala", pickupAddress: "Bonapriso", amenities: ["air_conditioning", "bluetooth"] },
    { make: "Toyota", model: "Land Cruiser", year: 2024, category: "suv", capacity: 7, transmission: "automatic", fuelType: "diesel", hasDriver: true, pricePerUnit: 120000, pickupCity: "Yaoundé", pickupAddress: "Nsimeyong", amenities: ["air_conditioning", "bluetooth", "gps", "4wd", "leather"] },
  ]
  const vehiclePhotos = [
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1200&q=80",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80",
    "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200&q=80",
  ]
  let rentalCount = 0
  let rentalBookingCount = 0
  for (let i = 0; i < rentalsData.length; i++) {
    const v = rentalsData[i]!
    const existing = await prisma.rentalVehicle.findFirst({ where: { make: v.make, model: v.model, pickupCity: v.pickupCity } })
    let rv = existing
    if (!rv) {
      rv = await prisma.rentalVehicle.create({
        data: {
          category: v.category, make: v.make, model: v.model, year: v.year,
          licensePlate: `LT-${1000 + i}-CM`,
          capacity: v.capacity, transmission: v.transmission, fuelType: v.fuelType,
          hasDriver: v.hasDriver, pricePerUnit: v.pricePerUnit, durationUnit: "day" as never,
          currency: "XAF", pickupCity: v.pickupCity, pickupAddress: v.pickupAddress,
          photos: [vehiclePhotos[i % vehiclePhotos.length]!],
          amenities: v.amenities, status: "available" as never, partnerStatus: "approved" as never,
        } as never,
      })
    }
    if (rv) {
      rentalCount++
      // Sample rental booking
      if (i < 3 && travelerId) {
        const existing = await prisma.rentalBooking.findFirst({ where: { userId: travelerId, rentalVehicleId: rv.id } })
        if (!existing) {
          const start = new Date(); start.setDate(start.getDate() + 10); start.setHours(9,0,0,0)
          const end = new Date(start); end.setDate(end.getDate() + 2)
          const booking = await prisma.rentalBooking.create({
            data: {
              rentalVehicleId: rv.id, userId: travelerId, startDate: start, endDate: end,
              duration: 2, durationUnit: "day" as never, totalAmount: v.pricePerUnit * 2,
              currency: "XAF", status: "pending_payment" as never,
              pickupCity: v.pickupCity, pickupAddress: v.pickupAddress,
            } as never,
          })
          await prisma.payment.create({
            data: { rentalBookingId: booking.id, provider: "notchpay" as never, providerRef: `NP-RV-${booking.id.slice(-6)}`, amount: v.pricePerUnit * 2, status: "pending" as never, method: "mobile_money" as never },
          })
          rentalBookingCount++
        }
      }
    }
  }
  console.log(`  ${rentalCount} rental vehicles; ${rentalBookingCount} rental bookings`)

  // ── Parcel operators + parcels ───────────────────────────────────────────
  const parcelOps = [
    { companyName: "ColiExpress", email: "coli@camermove.cm", contactName: "Jean Coli", phone: "677001001", citiesServed: ["Yaoundé", "Douala", "Bafoussam", "Bamenda", "Limbe"] },
    { companyName: "CitySend", email: "citysend@camermove.cm", contactName: "Marie Send", phone: "677001002", citiesServed: ["Yaoundé", "Douala", "Limbe"] },
  ]
  for (const op of parcelOps) {
    await prisma.parcelOperator.upsert({
      where: { email: op.email },
      update: {},
      create: { companyName: op.companyName, email: op.email, contactName: op.contactName, phone: op.phone, citiesServed: op.citiesServed, status: "active", partnerStatus: "approved" },
    })
  }
  const allOps = await prisma.parcelOperator.findMany()
  const parcelRoutes: Array<[string, string]> = [
    ["Yaoundé", "Douala"], ["Douala", "Yaoundé"], ["Yaoundé", "Bafoussam"],
    ["Douala", "Limbe"], ["Yaoundé", "Bamenda"], ["Douala", "Bafoussam"],
  ]
  let parcelCount = 0
  for (let i = 0; i < 8 && travelerId; i++) {
    const [origin, dest] = parcelRoutes[i % parcelRoutes.length]!
    const op = allOps[i % allOps.length]!
    const trackingNumber = `CM${Date.now().toString(36).toUpperCase()}${i.toString().padStart(2, "0")}`
    const existing = await prisma.parcel.findUnique({ where: { trackingNumber } })
    if (existing) continue
    const weight = 1 + (i % 8)
    const cost = 1500 + (i % 4) * 500
    const status = i < 4 ? "delivered" : i < 6 ? "in_transit" : i < 7 ? "picked_up" : "registered"
    const parcel = await prisma.parcel.create({
      data: {
        trackingNumber, operatorId: op.id, userId: travelerId,
        senderName: "Awa Mbarga", senderPhone: "699000100", senderCity: origin,
        recipientName: `Destinataire ${i + 1}`, recipientPhone: `69900020${i}`,
        recipientCity: dest, recipientAddress: `Quartier Central, ${dest}`,
        parcelType: i % 3 === 0 ? "documents" : i % 3 === 1 ? "vetements" : "electronique",
        weightKg: weight, dimensionsCm: "30x20x15", declaredValue: 5000 + i * 1000,
        shippingCost: cost, currency: "XAF", status: status as never,
        currentLocation: status === "delivered" ? dest : status === "in_transit" ? "En route" : origin,
      } as never,
    })
    // Status history
    const sequence: Array<{ status: string; location: string; note: string }> = [
      { status: "registered", location: origin, note: "Colis enregistré" },
      { status: "picked_up", location: origin, note: "Pris en charge par le transporteur" },
      { status: "in_transit", location: "En route", note: "En cours de livraison" },
      { status: "arrived", location: dest, note: "Arrivé au centre de tri" },
      { status: "available", location: dest, note: "Disponible au point de retrait" },
      { status: "delivered", location: dest, note: "Remis au destinataire" },
    ]
    const stopAt = status === "delivered" ? 6 : status === "in_transit" ? 3 : status === "picked_up" ? 2 : 1
    for (let s = 0; s < stopAt; s++) {
      const step = sequence[s]!
      await prisma.parcelStatusLog.create({
        data: { parcelId: parcel.id, status: step.status as never, location: step.location, note: step.note, createdAt: new Date(Date.now() - (stopAt - s) * 3600 * 1000) } as never,
      })
    }
    parcelCount++
  }
  console.log(`  ${allOps.length} parcel operators; ${parcelCount} parcels`)

  // ── Insurance policies ────────────────────────────────────────────────────
  const insuranceDestinations = ["Europe", "Asie", "Amérique du Nord", "Afrique de l'Ouest", "Moyen-Orient"]
  let insuranceCount = 0
  for (let i = 0; i < 5 && travelerId; i++) {
    const existing = await prisma.insurancePolicy.findFirst({ where: { userId: travelerId, destination: insuranceDestinations[i] } })
    if (existing) continue
    const start = new Date(); start.setDate(start.getDate() + 30)
    const end = new Date(start); end.setDate(end.getDate() + 14)
    const premium = 25000 + i * 8000
    await prisma.insurancePolicy.create({
      data: {
        userId: travelerId, providerName: i % 2 === 0 ? "AXA Cameroun" : "Allianz Africa",
        coverageType: (i % 2 === 0 ? "basic" : "premium") as never,
        destination: insuranceDestinations[i]!,
        startDate: start, endDate: end, travelers: 1 + (i % 3),
        premium, currency: "XAF", status: i < 2 ? "confirmed" : "pending_payment",
        policyNumber: `POL-${Date.now().toString(36).toUpperCase()}-${i}`,
      } as never,
    })
    insuranceCount++
  }
  console.log(`  ${insuranceCount} insurance policies`)

  // ── Events + ticket categories + bookings ─────────────────────────────────
  const eventsData = [
    {
      name: "Festival MASA 2026", eventType: "festival" as const,
      description: "Marché des Arts du Spectacle Africain — six jours de danse, musique, théâtre, conte et arts visuels.",
      venue: "Palais des Sports", city: "Yaoundé",
      startOffsetDays: 45, durationDays: 6,
      ticketCategories: [
        { name: "Pass 1 jour", price: 8000, quantity: 2000, sold: 1240 },
        { name: "Pass Festival 6 jours", price: 35000, quantity: 500, sold: 380 },
        { name: "VIP", price: 75000, quantity: 100, sold: 92 },
      ],
    },
    {
      name: "Concert Magic System", eventType: "concert" as const,
      description: "Le groupe ivoirien débarque à Douala pour un concert exceptionnel.",
      venue: "Stade de la Réunification", city: "Douala",
      startOffsetDays: 20, durationDays: 1,
      ticketCategories: [
        { name: "Carré Or", price: 25000, quantity: 1000, sold: 850 },
        { name: "Tribune", price: 15000, quantity: 3000, sold: 2400 },
        { name: "Pelouse", price: 5000, quantity: 5000, sold: 4100 },
      ],
    },
    {
      name: "Cameroun vs Nigeria — Éliminatoires CAN", eventType: "sport" as const,
      description: "Match décisif des éliminatoires de la Coupe d'Afrique des Nations.",
      venue: "Stade Omnisports Ahmadou Ahidjo", city: "Yaoundé",
      startOffsetDays: 14, durationDays: 1,
      ticketCategories: [
        { name: "Catégorie 1", price: 10000, quantity: 5000, sold: 4800 },
        { name: "Catégorie 2", price: 5000, quantity: 10000, sold: 7200 },
        { name: "Catégorie 3", price: 2000, quantity: 25000, sold: 22000 },
      ],
    },
    {
      name: "Salon International de l'Artisanat de Yaoundé", eventType: "exhibition" as const,
      description: "Plus de 300 exposants venus de toute l'Afrique centrale.",
      venue: "Palais des Congrès", city: "Yaoundé",
      startOffsetDays: 60, durationDays: 10,
      ticketCategories: [
        { name: "Entrée journée", price: 3000, quantity: 5000, sold: 1200 },
        { name: "Pass Pro 10 jours", price: 25000, quantity: 500, sold: 180 },
      ],
    },
    {
      name: "Conférence TEDx Yaoundé", eventType: "conference" as const,
      description: "Une journée de talks inspirants autour du thème 'Réinventer l'Afrique'.",
      venue: "Hôtel Hilton", city: "Yaoundé",
      startOffsetDays: 30, durationDays: 1,
      ticketCategories: [
        { name: "Early Bird", price: 15000, quantity: 200, sold: 200 },
        { name: "Standard", price: 25000, quantity: 300, sold: 240 },
        { name: "Patron", price: 100000, quantity: 30, sold: 22 },
      ],
    },
  ]
  let eventCount = 0
  let eventBookingCount = 0
  for (const e of eventsData) {
    const start = new Date(); start.setDate(start.getDate() + e.startOffsetDays); start.setHours(19,0,0,0)
    const end = e.durationDays > 1 ? new Date(start.getTime() + e.durationDays * 86400000) : null
    const existing = await prisma.event.findFirst({ where: { name: e.name } })
    let ev = existing
    if (!ev) {
      ev = await prisma.event.create({
        data: {
          name: e.name, description: e.description, eventType: e.eventType as never,
          venue: e.venue, city: e.city, startDate: start, endDate: end,
          status: "on_sale" as never, partnerStatus: "approved" as never,
          posterUrl: `https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80`,
        } as never,
      })
    }
    if (ev) {
      eventCount++
      const existingCats = await prisma.ticketCategory.count({ where: { eventId: ev.id } })
      if (existingCats === 0) {
        for (const c of e.ticketCategories) {
          await prisma.ticketCategory.create({
            data: { eventId: ev.id, name: c.name, price: c.price, quantity: c.quantity, sold: c.sold, currency: "XAF", status: "on_sale" as never } as never,
          })
        }
      }
      // Sample booking
      if (travelerId) {
        const cats = await prisma.ticketCategory.findMany({ where: { eventId: ev.id }, orderBy: { price: "asc" } })
        const cat = cats[0]
        if (cat) {
          const existing = await prisma.eventBooking.findFirst({ where: { userId: travelerId, eventId: ev.id } })
          if (!existing) {
            const qty = 2
            const booking = await prisma.eventBooking.create({
              data: {
                eventId: ev.id, ticketCategoryId: cat.id, userId: travelerId,
                quantity: qty, totalAmount: cat.price * qty, currency: "XAF",
                status: "confirmed" as never, ticketNumber: `TIX-${Date.now().toString(36).toUpperCase()}`,
                qrCode: `TIX-${Date.now().toString(36).toUpperCase()}`,
              } as never,
            })
            await prisma.payment.create({
              data: { eventBookingId: booking.id, provider: "notchpay" as never, providerRef: `NP-EV-${booking.id.slice(-6)}`, amount: cat.price * qty, status: "success" as never, method: "mobile_money" as never },
            })
            eventBookingCount++
          }
        }
      }
    }
  }
  console.log(`  ${eventCount} events; ${eventBookingCount} event bookings`)

  console.log("✅ Rich seed complete")
  console.log(`  Accounts: traveler@ / admin@ / super@ / partner@  → password: motdepasse123`)
}

main().catch(e=>{console.error(e); process.exit(1)}).finally(async()=>{await prisma.$disconnect()})
