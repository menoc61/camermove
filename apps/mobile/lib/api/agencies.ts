import { request } from "./resource";

// Local copies of the @camermove/shared registry types (apps/mobile does not
// depend on @camermove/shared; values mirror packages/shared/src/agencies.ts).
export type AgencyCategory = "interurban" | "urban" | "mixed" | "parcel" | "rental" | "vip";
export type VehicleAmenity =
  | "wifi"
  | "ac"
  | "toilet"
  | "usb"
  | "tv"
  | "hostess"
  | "vip-seat"
  | "snacks"
  | "cctv"
  | "seatbelt"
  | "gps-tracker";
export type AgencyClassType = "Standard" | "VIP" | "Premium" | "Classic" | "Business";

export interface AgencyListItem {
  id: string;
  dbId: string | null;
  companyName: string;
  tagline: string;
  city: string | null;
  lat: number | null;
  lon: number | null;
  yearFounded: number;
  fleetCount: number;
  category: AgencyCategory;
  brand: { primary: string; soft: string; onPrimary: string; icon: string };
  routes: { origin: string; destination: string; duration: string; priceFromXaf: number }[];
  amenities: VehicleAmenity[];
  ratingAvg: number | null;
  ratingCount: number;
  serviceClasses: string[];
  activeDeparturesToday: number;
  servedCities: string[];
  phone: string;
  email: string;
}

/**
 * Backward-compat alias — some older components (AgencyMap) still import
 * `Agency`. Keep the type alive so they don't break while we migrate.
 */
export type Agency = AgencyListItem;

export interface AgencyDetail extends AgencyListItem {
  description: string;
  headquartersAddress: string;
  branchCities: string[];
  routesDetailed: Array<{
    origin: string;
    destination: string;
    classType: AgencyClassType;
    basePriceXaf: number;
    durationMinutes: number;
    dailyDepartures: number;
  }>;
  reviews: {
    items: Array<{
      id: string;
      rating: number;
      punctuality: number | null;
      comfort: number | null;
      cleanliness: number | null;
      service: number | null;
      comment: string | null;
      createdAt: string;
      author: { firstName: string | null; lastName: string | null };
    }>;
    ratingAvg: number | null;
    ratingCount: number;
    total: number;
  };
}

export interface AgenciesQuery {
  city?: string;
  category?: AgencyCategory;
  q?: string;
}

export async function fetchAgenciesList(
  params: AgenciesQuery = {},
): Promise<{ items: AgencyListItem[]; total: number }> {
  const res = await request<{ items: AgencyListItem[]; total: number }>("/api/v1/agencies", {
    params: {
      ...(params.city ? { city: params.city } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.q ? { q: params.q } : {}),
    },
  });
  return res;
}

export async function fetchAgency(slug: string): Promise<AgencyDetail | null> {
  try {
    return await request<AgencyDetail>(`/api/v1/agencies/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}
