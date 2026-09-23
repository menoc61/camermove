import { request } from "./resource";

export interface TripDetail {
  id: string;
  departureAt: string;
  arrivalEstimateAt: string | null;
  price: number;
  totalSeats: number;
  vehicleTypeInfo: string | null;
  status: string;
  route: { originCity: string; destinationCity: string } | null;
  transport: { companyName: string } | null;
  seatAvailability?: { seatsAvailable: number; seatsHeld: number; seatsBooked: number } | null;
}

export function getTrip(id: string): Promise<TripDetail> {
  return request<TripDetail>(`/api/v1/trips/${encodeURIComponent(id)}`, { errorLabel: "trip failed" });
}
