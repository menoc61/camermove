import { request } from "./resource";

export interface UrbanLine {
  origin: string;
  dest: string;
  price: number;
  transporterId: string;
  companyName: string;
  tripCountToday: number;
}

export interface UrbanTrip {
  id: string;
  origin: string;
  dest: string;
  departureAt: string;
  arrivalAt: string | null;
  price: number;
  seatsAvailable: number;
  totalSeats: number;
  line: string;
  vehicleTypeInfo: string | null;
  isUrban: boolean;
  validUntil: string;
}

export function fetchUrbanLines(): Promise<UrbanLine[]> {
  return request<UrbanLine[]>("/api/v1/intraurban/lines");
}

export function fetchUrbanSchedule(params: {
  origin?: string;
  dest?: string;
  date: string;
  pax?: number;
}): Promise<UrbanTrip[]> {
  return request<UrbanTrip[]>("/api/v1/intraurban/schedule", {
    params: { date: params.date, origin: params.origin, dest: params.dest, ...(params.pax ? { pax: params.pax } : {}) },
  });
}