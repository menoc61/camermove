/**
 * Local copy of the static agency metadata (cities + amenity labels) so the
 * mobile app does not need to depend on @camermove/shared. Mirrors
 * packages/shared/src/agencies.ts (CITIES, AMENITY_LABEL) and must be updated
 * when the shared registry changes. Single source of truth for screens.
 */
import type { VehicleAmenity } from "@/lib/api/agencies";

export interface CityOption {
  readonly id: string;
  readonly label: string;
}

export const CITIES: readonly CityOption[] = [
  { id: "yaounde", label: "Yaoundé" },
  { id: "douala", label: "Douala" },
  { id: "bafoussam", label: "Bafoussam" },
  { id: "bamenda", label: "Bamenda" },
  { id: "garoua", label: "Garoua" },
  { id: "maroua", label: "Maroua" },
  { id: "bertoua", label: "Bertoua" },
  { id: "ebolowa", label: "Ebolowa" },
  { id: "kribi", label: "Kribi" },
  { id: "limbe", label: "Limbe" },
  { id: "ngaoundere", label: "Ngaoundéré" },
  { id: "kousseri", label: "Kousséri" },
  { id: "yagoua", label: "Yagoua" },
  { id: "meiganga", label: "Meiganga" },
  { id: "nkongsamba", label: "Nkongsamba" },
  { id: "abongmbang", label: "Abong-Mbang" },
  { id: "dschang", label: "Dschang" },
  { id: "mbouda", label: "Mbouda" },
  { id: "sangmelima", label: "Sangmélima" },
];

export const AMENITY_LABEL: Record<VehicleAmenity, string> = {
  wifi: "Wi-Fi gratuit",
  ac: "Climatisation",
  toilet: "Toilettes à bord",
  usb: "Ports USB",
  tv: "Divertissement vidéo",
  hostess: "Hôtesse à bord",
  "vip-seat": "Sièges VIP inclinables",
  snacks: "Collation servie",
  cctv: "Vidéosurveillance",
  seatbelt: "Ceinture obligatoire",
  "gps-tracker": "Suivi GPS en direct",
};

export type AgencyCategoryKey =
  | "interurban"
  | "urban"
  | "mixed"
  | "parcel"
  | "rental"
  | "vip";

export const CATEGORY_LABEL: Record<AgencyCategoryKey, string> = {
  interurban: "Interurbain",
  urban: "Intra-urbain",
  mixed: "Mixte",
  parcel: "Colis",
  rental: "Location",
  vip: "VIP",
};
