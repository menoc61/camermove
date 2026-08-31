import { z } from "zod"

export const VehicleInput = z.object({
  type: z.string().min(1).max(100),
  capacity: z.number().int().min(1).max(200),
  plateNumber: z.string().max(20).optional(),
  status: z.enum(["active", "inactive"]).default("active"),
})

export const VehicleUpdateInput = z.object({
  type: z.string().min(1).max(100).optional(),
  capacity: z.number().int().min(1).max(200).optional(),
  plateNumber: z.string().max(20).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
})

export const VehicleParams = z.object({ id: z.string().cuid() })

export const RouteInput = z.object({
  originCity: z.string().min(1).max(100),
  destinationCity: z.string().min(1).max(100),
  active: z.boolean().default(true),
})

export const RouteUpdateInput = z.object({
  originCity: z.string().min(1).max(100).optional(),
  destinationCity: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
})

export const RouteParams = z.object({ id: z.string().cuid() })

export const TripInput = z.object({
  routeId: z.string().cuid(),
  vehicleId: z.string().cuid().optional().nullable(),
  departureAt: z.string().datetime(),
  arrivalEstimateAt: z.string().datetime().optional(),
  durationEstimate: z.number().int().min(1).optional(),
  price: z.number().int().min(1),
  totalSeats: z.number().int().min(1).max(200),
  departurePointInfo: z.string().max(200).optional(),
  vehicleTypeInfo: z.string().max(100).optional(),
  conditions: z.string().max(1000).optional(),
  cancellationPolicy: z.string().max(500).optional(),
  status: z.enum(["active", "inactive"]).default("active"),
})

export const TripUpdateInput = z.object({
  vehicleId: z.string().cuid().optional().nullable(),
  departureAt: z.string().datetime().optional(),
  arrivalEstimateAt: z.string().datetime().optional().nullable(),
  durationEstimate: z.number().int().min(1).optional().nullable(),
  price: z.number().int().min(1).optional(),
  totalSeats: z.number().int().min(1).max(200).optional(),
  departurePointInfo: z.string().max(200).optional().nullable(),
  vehicleTypeInfo: z.string().max(100).optional().nullable(),
  conditions: z.string().max(1000).optional().nullable(),
  cancellationPolicy: z.string().max(500).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
})

export const TripParams = z.object({ id: z.string().cuid() })

export const TransporterProfileUpdate = z.object({
  companyName: z.string().min(1).max(200).optional(),
  contactName: z.string().max(100).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  transportType: z.string().max(50).optional().nullable(),
})

export const TransporterPresignInput = z.object({
  filename: z.string().min(1),
  mimetype: z.string().min(1),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
})
