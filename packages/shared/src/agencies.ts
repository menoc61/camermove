/**
 * Central Single Source of Truth (SSOT) for agencies & intra-urban transit.
 *
 * Per AGENTS.md §4 ("Scalable & Maintainable") and the user's directive —
 * "ensure to have true source of data and single point of data management for
 * all the services" — every agency profile, fleet/amenity tag, served-route
 * list, urban line, urban stop and urban fare band is defined HERE ONCE and
 * shared by:
 *
 *   • packages/db/prisma/seed.ts              → seeds Transporters, Routes, Trips
 *   • apps/api/src/agencies                   → list/detail endpoints
 *   • apps/api/src/landing                    → stats / hero reel
 *   • apps/api/src/intraurban                 → urban lines, schedule, fare bands
 *   • apps/web/app/agencies                   → directory, filter, ratings
 *   • apps/web/components/landing/AgencyMap   → pins + filters
 *   • apps/web/components/tickets/TicketDetail→ branding strip
 *
 * Changing an amenity, a route label, a phone number or a fare band happens
 * HERE only — never duplicate per consumer. All consumers import from
 * "@camermove/shared" and never write their own copy.
 *
 * Names are derived from public Cameroon transport operators (Buca Voyages,
 * General Express Voyages, Touristique Express, Princesse Voyages, Finexs
 * Voyages, Musango, STECY / Le Bus successor) per AETIC listings and the
 * operators' own sites — see docs/research/AGENCIES.md for sources.
 */

import { priceXaf } from "./money"

// ────────────────────────────────────────────────────────────────────────────
//  Brand palette — single set of agency brand tokens used everywhere
//  (Hero reel accent, agency map pin, ticket header, agency chip).
//  Tweak here once, every consumer picks it up.
// ────────────────────────────────────────────────────────────────────────────
export type BrandHue = {
  /** Primary brand color (used on logo dot, pin marker, ticket header band). */
  primary: string
  /** Soft background tint behind brand elements. */
  soft: string
  /** Ink color for text on top of primary. */
  onPrimary: string
}

export const BRAND_HUES: Record<string, BrandHue> = {
  buca:           { primary: "#C2772A", soft: "#FBE9CF", onPrimary: "#FFFFFF" },
  general:        { primary: "#1F3A5F", soft: "#D9E2F1", onPrimary: "#FFFFFF" },
  touristique:    { primary: "#0E7C66", soft: "#C9EBE0", onPrimary: "#FFFFFF" },
  princesse:      { primary: "#7E1B86", soft: "#EAD2EE", onPrimary: "#FFFFFF" },
  finexs:         { primary: "#B8242A", soft: "#F7D4D6", onPrimary: "#FFFFFF" },
  musango:        { primary: "#264B8B", soft: "#D2DCF1", onPrimary: "#FFFFFF" },
  camermove:      { primary: "#0E0E0E", soft: "#E4E1D9", onPrimary: "#FFFFFF" },
  stecy:          { primary: "#0E5C40", soft: "#CFE6DC", onPrimary: "#FFFFFF" },
  transyaounde:   { primary: "#0E5C40", soft: "#CFE6DC", onPrimary: "#FFFFFF" },
  pmud:           { primary: "#0E5C40", soft: "#CFE6DC", onPrimary: "#FFFFFF" },
}

// ────────────────────────────────────────────────────────────────────────────
//  City coordinates (used by every map and "villes desservies" picker)
// ────────────────────────────────────────────────────────────────────────────
export type CityId =
  | "yaounde"
  | "douala"
  | "bafoussam"
  | "bamenda"
  | "garoua"
  | "maroua"
  | "bertoua"
  | "ebolowa"
  | "kribi"
  | "limbe"
  | "ngaoundere"
  | "kousseri"
  | "yagoua"
  | "meiganga"
  | "nkongsamba"
  | "abongmbang"
  | "dschang"
  | "mbouda"
  | "sangmelima"
  | "brazzaville"

export interface CityRecord {
  id: CityId
  label: string          // "Yaoundé"
  ascii: string[]        // search aliases
  lat: number
  lon: number
  /** True if the city has intra-urban transit (BRT / Le Bus / STECY). */
  hasUrbanTransit: boolean
}

export const CITIES: Record<CityId, CityRecord> = {
  yaounde:      { id: "yaounde",      label: "Yaoundé",      ascii: ["yaounde", "yaoundé"],         lat: 3.848, lon: 11.498, hasUrbanTransit: true  },
  douala:       { id: "douala",       label: "Douala",       ascii: ["douala"],                      lat: 4.051, lon: 9.767,  hasUrbanTransit: true  },
  bafoussam:    { id: "bafoussam",    label: "Bafoussam",    ascii: ["bafoussam"],                   lat: 5.476, lon: 10.418, hasUrbanTransit: false },
  bamenda:      { id: "bamenda",      label: "Bamenda",      ascii: ["bamenda"],                     lat: 5.963, lon: 10.159, hasUrbanTransit: false },
  garoua:       { id: "garoua",       label: "Garoua",       ascii: ["garoua"],                      lat: 9.301, lon: 13.397, hasUrbanTransit: false },
  maroua:       { id: "maroua",       label: "Maroua",       ascii: ["maroua"],                      lat: 10.591, lon: 14.315, hasUrbanTransit: false },
  bertoua:      { id: "bertoua",      label: "Bertoua",      ascii: ["bertoua"],                     lat: 4.577, lon: 13.684, hasUrbanTransit: false },
  ebolowa:      { id: "ebolowa",      label: "Ebolowa",      ascii: ["ebolowa"],                     lat: 2.900, lon: 11.150, hasUrbanTransit: false },
  kribi:        { id: "kribi",        label: "Kribi",        ascii: ["kribi"],                       lat: 2.933, lon: 9.983,  hasUrbanTransit: false },
  limbe:        { id: "limbe",        label: "Limbe",        ascii: ["limbe"],                       lat: 4.023, lon: 9.206,  hasUrbanTransit: false },
  ngaoundere:   { id: "ngaoundere",   label: "Ngaoundéré",   ascii: ["ngaoundere", "ngaoundéré"],    lat: 7.327, lon: 13.584, hasUrbanTransit: false },
  kousseri:     { id: "kousseri",     label: "Kousséri",     ascii: ["kousseri", "kousséri"],        lat: 12.078, lon: 15.030, hasUrbanTransit: false },
  yagoua:       { id: "yagoua",       label: "Yagoua",       ascii: ["yagoua"],                      lat: 10.343, lon: 15.241, hasUrbanTransit: false },
  meiganga:     { id: "meiganga",     label: "Meiganga",     ascii: ["meiganga"],                    lat: 6.517, lon: 14.300, hasUrbanTransit: false },
  nkongsamba:   { id: "nkongsamba",   label: "Nkongsamba",   ascii: ["nkongsamba"],                  lat: 4.954, lon: 9.940,  hasUrbanTransit: false },
  abongmbang:   { id: "abongmbang",   label: "Abong-Mbang",  ascii: ["abongmbang", "abong-mbang"],   lat: 3.983, lon: 13.183, hasUrbanTransit: false },
  dschang:      { id: "dschang",      label: "Dschang",      ascii: ["dschang"],                     lat: 5.450, lon: 10.067, hasUrbanTransit: false },
  mbouda:       { id: "mbouda",       label: "Mbouda",       ascii: ["mbouda"],                      lat: 5.626, lon: 10.255, hasUrbanTransit: false },
  sangmelima:   { id: "sangmelima",   label: "Sangmélima",   ascii: ["sangmelima", "sangmelima"],    lat: 2.933, lon: 11.983, hasUrbanTransit: false },
  brazzaville:  { id: "brazzaville",  label: "Brazzaville",  ascii: ["brazzaville"],                 lat: -4.263, lon: 15.242, hasUrbanTransit: false },
}

/** Reverse lookup: label/alias → CityRecord. */
export function findCity(input: string): CityRecord | null {
  const norm = input.trim().toLowerCase()
  if (!norm) return null
  for (const c of Object.values(CITIES)) {
    if (c.label.toLowerCase() === norm) return c
    if (c.ascii.includes(norm)) return c
  }
  return null
}

/** Best-effort coords for a free-text city name. Returns null on miss. */
export function cityCoords(input: string): { lat: number; lon: number } | null {
  const c = findCity(input)
  return c ? { lat: c.lat, lon: c.lon } : null
}

// ────────────────────────────────────────────────────────────────────────────
//  Agency registry
// ────────────────────────────────────────────────────────────────────────────

export type AgencyCategory = "interurban" | "urban" | "mixed" | "parcel" | "rental" | "vip"
export type AgencyStatus = "approved" | "pending" | "suspended"
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
  | "gps-tracker"

export interface AgencyRoute {
  /** Coords are looked up from CITIES so we never duplicate lat/lon. */
  origin: CityId
  destination: CityId
  /** "Standard" | "VIP" | "Premium" | "Classic". Free-form for now. */
  classType: "Standard" | "VIP" | "Premium" | "Classic" | "Business"
  /** Round-trip price baseline (XAF integer). Seed only — final price per
   *  departure can differ from this; the route is the canonical reference. */
  basePriceXaf: number
  /** Approximate duration. Seed-only. */
  durationMinutes: number
  /** Daily departure count typical for this route. */
  dailyDepartures: number
}

export interface AgencyRecord {
  /** Stable slug used everywhere — primary key for the registry. */
  slug: string
  /** Display name on cards, ticket headers, search results. */
  displayName: string
  /** Short marketing tagline (used on cards + landing reel). */
  tagline: string
  /** Long-form description (used on agency detail page). */
  description: string
  /** Registry-only brand slug → BRAND_HUES lookup. */
  brandKey: keyof typeof BRAND_HUES
  /** Email used in seed (kept lowercase). */
  email: string
  /** Phone — main reservation line. */
  phone: string
  /** City HQ (looked up via CITIES, not duplicated). */
  headquartersCity: CityId
  /** Other cities where the agency operates (branches). */
  branchCities: CityId[]
  /** Address of the HQ branch (free-form human label). */
  headquartersAddress: string
  /** Founding year (free-form). */
  yearFounded: number
  /** Fleet count (typical — for cards and detail). */
  fleetCount: number
  /** "interurban" / "urban" / "mixed" — drives filters. */
  category: AgencyCategory
  /** Set of route profiles (origin → destination + class + price). */
  routes: AgencyRoute[]
  /** Free-form amenities (canonical strings, no free duplication). */
  amenities: VehicleAmenity[]
  /** Brand accent emoji or icon label (single source). */
  accentGlyph: string
  /** Service-class labels offered. */
  serviceClasses: string[]
  /** Status in registry — seed maps to TransporterStatus. */
  status: AgencyStatus
  /** Agency-defined commission % (overrides platform default in seed). */
  commissionPercent?: number
  /** Hex logo color used as fallback when no logoUrl is provided. */
  logoColor: string
}

// ────────────────────────────────────────────────────────────────────────────
//  Agency profiles — THE single source of truth.
//  Profiles derived from public Cameroon transport operator listings,
//  operator websites, AETIC directory, and PagesJaunes reviews.
// ────────────────────────────────────────────────────────────────────────────

export const AGENCIES: AgencyRecord[] = [
  // ── Buca Voyages ────────────────────────────────────────────────────────
  {
    slug: "buca-voyages",
    displayName: "Buca Voyages",
    tagline: "Le transporteur du présent et du futur — depuis 2004",
    description:
      "BUCA Voyages est l'une des meilleures agences de transport interurbain au Cameroun, " +
      "reconnue pour sa ponctualité, son confort et son professionnalisme. " +
      "Service VIP haut-de-gamme avec toilettes à bord, hôtesses, et programmation maîtrisée des départs.",
    brandKey: "buca",
    email: "contact@buca-voyages.cm",
    phone: "+237 693 98 57 85",
    headquartersCity: "yaounde",
    branchCities: ["douala", "sangmelima", "ebolowa"],
    headquartersAddress: "Quartier Mvan, BP 567, Yaoundé",
    yearFounded: 2004,
    fleetCount: 32,
    category: "interurban",
    routes: [
      { origin: "yaounde", destination: "douala",     classType: "VIP",      basePriceXaf: 6000, durationMinutes: 270, dailyDepartures: 9 },
      { origin: "yaounde", destination: "douala",     classType: "Standard", basePriceXaf: 5000, durationMinutes: 300, dailyDepartures: 6 },
      { origin: "douala",  destination: "yaounde",    classType: "VIP",      basePriceXaf: 6000, durationMinutes: 270, dailyDepartures: 9 },
      { origin: "yaounde", destination: "sangmelima", classType: "VIP",      basePriceXaf: 3500, durationMinutes: 150, dailyDepartures: 5 },
      { origin: "yaounde", destination: "ebolowa",    classType: "VIP",      basePriceXaf: 4000, durationMinutes: 180, dailyDepartures: 4 },
      { origin: "yaounde", destination: "brazzaville",classType: "VIP",      basePriceXaf: 18000,durationMinutes: 720, dailyDepartures: 2 },
    ],
    amenities: ["wifi", "ac", "toilet", "usb", "vip-seat", "snacks", "cctv", "seatbelt", "hostess", "gps-tracker"],
    accentGlyph: "🚌",
    serviceClasses: ["VIP", "Standard"],
    status: "approved",
    commissionPercent: 8,
    logoColor: BRAND_HUES.buca!.primary,
  },

  // ── General Express Voyages ─────────────────────────────────────────────
  {
    slug: "general-express",
    displayName: "General Express Voyages",
    tagline: "30 ans de transport au Cameroun — 19 agences, 8 villes",
    description:
      "GENERAL EXPRESS VOYAGES est une société citoyenne de notoriété connue, employant " +
      "quelques centaines de personnes. Ses axes principaux sont Bafoussam-Douala, " +
      "Bafoussam-Yaoundé, Mbouda-Douala, Mbouda-Yaoundé, Douala-Yaoundé. " +
      "Trois services complémentaires : transport passagers Standard et VIP, " +
      "expédition sécurisée de colis entre agences, location de bus pour groupes et événements.",
    brandKey: "general",
    email: "yaounde@general-express.cm",
    phone: "+237 233 14 71 13",
    headquartersCity: "bafoussam",
    branchCities: ["yaounde", "douala", "mbouda", "dschang"],
    headquartersAddress: "Ndiangdam, Bafoussam",
    yearFounded: 1993,
    fleetCount: 50,
    category: "interurban",
    routes: [
      { origin: "douala",    destination: "yaounde",   classType: "VIP",      basePriceXaf: 6500, durationMinutes: 300, dailyDepartures: 12 },
      { origin: "douala",    destination: "yaounde",   classType: "Standard", basePriceXaf: 5000, durationMinutes: 330, dailyDepartures: 10 },
      { origin: "yaounde",   destination: "bafoussam", classType: "VIP",      basePriceXaf: 5500, durationMinutes: 240, dailyDepartures: 8 },
      { origin: "douala",    destination: "bafoussam", classType: "VIP",      basePriceXaf: 6000, durationMinutes: 360, dailyDepartures: 8 },
      { origin: "mbouda",    destination: "douala",    classType: "Standard", basePriceXaf: 5000, durationMinutes: 360, dailyDepartures: 4 },
      { origin: "mbouda",    destination: "yaounde",   classType: "Standard", basePriceXaf: 5500, durationMinutes: 300, dailyDepartures: 3 },
      { origin: "dschang",   destination: "yaounde",   classType: "Standard", basePriceXaf: 5500, durationMinutes: 300, dailyDepartures: 2 },
      { origin: "dschang",   destination: "douala",    classType: "Standard", basePriceXaf: 6500, durationMinutes: 360, dailyDepartures: 2 },
    ],
    amenities: ["wifi", "ac", "usb", "cctv", "seatbelt", "gps-tracker", "vip-seat"],
    accentGlyph: "🛣️",
    serviceClasses: ["VIP", "Standard"],
    status: "approved",
    commissionPercent: 8,
    logoColor: BRAND_HUES.general!.primary,
  },

  // ── Touristique Express ─────────────────────────────────────────────────
  {
    slug: "touristique-express",
    displayName: "Touristique Express",
    tagline: "Une autre vision du transport ! — depuis 1999",
    description:
      "TOURISTIQUE EXPRESS réorganise l'industrie au plan sécuritaire, technologique et de confort. " +
      "Bus climatisés avec toilettes, hôtesses à bord distribuant collation (croissants, café, jus), " +
      "programme vidéo local, bagages étiquetés avant mise en soute, contrôle des talons à la remise.",
    brandKey: "touristique",
    email: "yaounde@touristique.cm",
    phone: "+237 242 46 25 65",
    headquartersCity: "yaounde",
    branchCities: ["douala", "ngaoundere", "garoua", "maroua", "bertoua", "kousseri", "yagoua", "meiganga", "nkongsamba", "abongmbang"],
    headquartersAddress: "Carrefour Bastos, Yaoundé",
    yearFounded: 1999,
    fleetCount: 65,
    category: "interurban",
    routes: [
      { origin: "yaounde",     destination: "douala",      classType: "VIP",      basePriceXaf: 6000, durationMinutes: 270, dailyDepartures: 16 },
      { origin: "douala",      destination: "yaounde",     classType: "VIP",      basePriceXaf: 6000, durationMinutes: 270, dailyDepartures: 16 },
      { origin: "yaounde",     destination: "ngaoundere",  classType: "VIP",      basePriceXaf: 12000, durationMinutes: 600, dailyDepartures: 4 },
      { origin: "yaounde",     destination: "garoua",      classType: "VIP",      basePriceXaf: 14000, durationMinutes: 720, dailyDepartures: 3 },
      { origin: "yaounde",     destination: "maroua",      classType: "VIP",      basePriceXaf: 16000, durationMinutes: 900, dailyDepartures: 2 },
      { origin: "yaounde",     destination: "bertoua",     classType: "Standard", basePriceXaf: 5500, durationMinutes: 360, dailyDepartures: 4 },
      { origin: "yaounde",     destination: "kousseri",    classType: "VIP",      basePriceXaf: 18000, durationMinutes: 1080,dailyDepartures: 1 },
      { origin: "yaounde",     destination: "nkongsamba",  classType: "Standard", basePriceXaf: 4500, durationMinutes: 300, dailyDepartures: 3 },
      { origin: "yaounde",     destination: "abongmbang",  classType: "Standard", basePriceXaf: 5000, durationMinutes: 300, dailyDepartures: 3 },
    ],
    amenities: ["wifi", "ac", "toilet", "usb", "tv", "hostess", "snacks", "cctv", "seatbelt", "gps-tracker", "vip-seat"],
    accentGlyph: "🚍",
    serviceClasses: ["VIP", "Business", "Standard"],
    status: "approved",
    commissionPercent: 7,
    logoColor: BRAND_HUES.touristique!.primary,
  },

  // ── Princesse Voyages ───────────────────────────────────────────────────
  {
    slug: "princesse-voyages",
    displayName: "Princesse Voyages",
    tagline: "Rapide, sécurisé, accueillant — depuis 2011",
    description:
      "PRINCESSE VOYAGES est une agence de voyages interurbains située au quartier Km5 à Douala, " +
      "à proximité de la Gare Routière de Mboppi. Spécialisée dans le transport en commun " +
      "depuis 2011, elle propose des services fiables et de qualité, " +
      "avec départs matinaux dès 5h et dernier départ à 23h, et un service courrier/colis pour Kribi et Douala.",
    brandKey: "princesse",
    email: "contact@princesse-voyages.cm",
    phone: "+237 698 90 42 22",
    headquartersCity: "douala",
    branchCities: ["yaounde", "kribi"],
    headquartersAddress: "Km5, Douala (proximité Gare Routière Mboppi)",
    yearFounded: 2011,
    fleetCount: 18,
    category: "interurban",
    routes: [
      { origin: "douala",  destination: "yaounde", classType: "Standard", basePriceXaf: 3500, durationMinutes: 300, dailyDepartures: 10 },
      { origin: "yaounde", destination: "douala",  classType: "Standard", basePriceXaf: 3500, durationMinutes: 300, dailyDepartures: 8 },
      { origin: "yaounde", destination: "kribi",   classType: "Standard", basePriceXaf: 4000, durationMinutes: 240, dailyDepartures: 5 },
      { origin: "douala",  destination: "kribi",   classType: "Standard", basePriceXaf: 4500, durationMinutes: 240, dailyDepartures: 4 },
    ],
    amenities: ["ac", "seatbelt", "gps-tracker"],
    accentGlyph: "👑",
    serviceClasses: ["Standard"],
    status: "approved",
    commissionPercent: 9,
    logoColor: BRAND_HUES.princesse!.primary,
  },

  // ── Finexs Voyages ──────────────────────────────────────────────────────
  {
    slug: "finexs-voyages",
    displayName: "Finexs Voyages",
    tagline: "Compagnie de transport interurbain des personnes et marchandises",
    description:
      "Finexs Voyages est une compagnie de transport interurbain des personnes et des marchandises " +
      "spécialisée sur l'axe Douala-Yaoundé-Douala. Siège à Douala-Akwa, flotte moderne, " +
      "départs cadencés et service courrier/colis sécurisé.",
    brandKey: "finexs",
    email: "contact@finexs-voyages.cm",
    phone: "+237 233 42 12 00",
    headquartersCity: "douala",
    branchCities: ["yaounde", "bafoussam"],
    headquartersAddress: "Douala-Akwa",
    yearFounded: 2008,
    fleetCount: 24,
    category: "interurban",
    routes: [
      { origin: "douala",    destination: "yaounde",   classType: "VIP",      basePriceXaf: 5500, durationMinutes: 300, dailyDepartures: 8 },
      { origin: "yaounde",   destination: "douala",    classType: "VIP",      basePriceXaf: 5500, durationMinutes: 300, dailyDepartures: 8 },
      { origin: "douala",    destination: "bafoussam", classType: "Standard", basePriceXaf: 5000, durationMinutes: 360, dailyDepartures: 4 },
    ],
    amenities: ["ac", "wifi", "usb", "cctv", "gps-tracker"],
    accentGlyph: "✈️",
    serviceClasses: ["VIP", "Standard"],
    status: "approved",
    commissionPercent: 8,
    logoColor: BRAND_HUES.finexs!.primary,
  },

  // ── Musango ─────────────────────────────────────────────────────────────
  {
    slug: "musango",
    displayName: "Musango Voyage",
    tagline: "Voyage à petit prix sur tous les axes du Cameroun",
    description:
      "Musango dessert plusieurs axes majeurs du pays avec des tarifs très accessibles " +
      "(Standard à 3 500 XAF, VIP à 8 000 XAF Douala-Yaoundé). Fréquence élevée, " +
      "flotte diversifiée et service de colis intégré.",
    brandKey: "musango",
    email: "contact@musango-voyage.cm",
    phone: "+237 696 11 22 33",
    headquartersCity: "douala",
    branchCities: ["yaounde", "bafoussam", "ngaoundere"],
    headquartersAddress: "Bépanda, Douala",
    yearFounded: 2015,
    fleetCount: 20,
    category: "interurban",
    routes: [
      { origin: "douala",  destination: "yaounde", classType: "Standard", basePriceXaf: 3500, durationMinutes: 300, dailyDepartures: 10 },
      { origin: "douala",  destination: "yaounde", classType: "VIP",      basePriceXaf: 8000, durationMinutes: 270, dailyDepartures: 4 },
      { origin: "yaounde", destination: "bafoussam", classType: "Standard", basePriceXaf: 4500, durationMinutes: 240, dailyDepartures: 6 },
    ],
    amenities: ["ac", "seatbelt"],
    accentGlyph: "🛤️",
    serviceClasses: ["Standard", "VIP"],
    status: "approved",
    commissionPercent: 10,
    logoColor: BRAND_HUES.musango!.primary,
  },

  // ── CamerMove Express (the platform's own seed agency) ─────────────────
  {
    slug: "camermove-express",
    displayName: "CamerMove Express",
    tagline: "La marque de la plateforme — interurbain fiable",
    description:
      "CamerMove Express est la marque de transport interurbain opérée en propre par CamerMove " +
      "pour offrir une alternative fiable sur l'axe Yaoundé–Douala.",
    brandKey: "camermove",
    email: "express@camermove.cm",
    phone: "+237 699 00 00 00",
    headquartersCity: "douala",
    branchCities: ["yaounde"],
    headquartersAddress: "Akwa, Douala",
    yearFounded: 2024,
    fleetCount: 12,
    category: "interurban",
    routes: [
      { origin: "yaounde", destination: "douala", classType: "Standard", basePriceXaf: 6000, durationMinutes: 270, dailyDepartures: 3 },
      { origin: "yaounde", destination: "douala", classType: "Premium",  basePriceXaf: 8000, durationMinutes: 240, dailyDepartures: 3 },
      { origin: "douala",  destination: "yaounde", classType: "Standard", basePriceXaf: 6000, durationMinutes: 270, dailyDepartures: 3 },
      { origin: "douala",  destination: "yaounde", classType: "Premium",  basePriceXaf: 8000, durationMinutes: 240, dailyDepartures: 3 },
    ],
    amenities: ["wifi", "ac", "usb", "cctv", "gps-tracker"],
    accentGlyph: "🟢",
    serviceClasses: ["Premium", "Standard"],
    status: "approved",
    commissionPercent: 5,
    logoColor: BRAND_HUES.camermove!.primary,
  },
]

/** Lookup by slug — the canonical key in the registry. */
export function findAgency(slug: string): AgencyRecord | null {
  return AGENCIES.find((a) => a.slug === slug) ?? null
}

/** All agencies that serve `cityId` as origin or destination. */
export function agenciesServing(cityId: CityId): AgencyRecord[] {
  return AGENCIES.filter(
    (a) =>
      a.routes.some((r) => r.origin === cityId || r.destination === cityId) ||
      a.headquartersCity === cityId ||
      a.branchCities.includes(cityId),
  )
}

/** All agencies headquartered in `cityId`. */
export function agenciesHeadquartered(cityId: CityId): AgencyRecord[] {
  return AGENCIES.filter((a) => a.headquartersCity === cityId)
}

/** All distinct cities that appear in any agency route. */
export function allServedCities(): CityRecord[] {
  const set = new Set<CityId>()
  for (const a of AGENCIES) {
    set.add(a.headquartersCity)
    for (const c of a.branchCities) set.add(c)
    for (const r of a.routes) {
      set.add(r.origin)
      set.add(r.destination)
    }
  }
  return [...set].map((id) => CITIES[id])
}

// ────────────────────────────────────────────────────────────────────────────
//  Interurban service classes (single source for chip labels and search filter)
// ────────────────────────────────────────────────────────────────────────────
export const INTERURBAN_CLASSES = ["Standard", "VIP", "Premium", "Business", "Classic"] as const
export type InterurbanClass = (typeof INTERURBAN_CLASSES)[number]

// ────────────────────────────────────────────────────────────────────────────
//  Vehicle amenity labels (single source — every UI consumes this)
// ────────────────────────────────────────────────────────────────────────────
export const AMENITY_LABEL: Record<VehicleAmenity, { label: string; emoji: string }> = {
  wifi:         { label: "Wi-Fi gratuit",           emoji: "📶" },
  ac:           { label: "Climatisation",          emoji: "❄️" },
  toilet:       { label: "Toilettes à bord",       emoji: "🚻" },
  usb:          { label: "Ports USB",              emoji: "🔌" },
  tv:           { label: "Divertissement vidéo",  emoji: "📺" },
  hostess:      { label: "Hôtesse à bord",         emoji: "💁" },
  "vip-seat":   { label: "Sièges VIP inclinables", emoji: "💺" },
  snacks:       { label: "Collation servie",       emoji: "🥐" },
  cctv:         { label: "Vidéosurveillance",      emoji: "🎥" },
  seatbelt:     { label: "Ceinture obligatoire",   emoji: "🪢" },
  "gps-tracker":{ label: "Suivi GPS en direct",    emoji: "📍" },
}

// ────────────────────────────────────────────────────────────────────────────
//  Intra-urban transit — the heart of CamerMove per the user's directive.
//  STECY (Yaoundé), the Douala BRT/PMUD network, and Tap&Go e-ticket model.
// ────────────────────────────────────────────────────────────────────────────

export type UrbanNetworkId = "stecy-yaounde" | "pmud-douala"

export interface UrbanStop {
  id: string
  name: string
  /** Offset minutes from the line terminus (0 = origin). */
  offsetMinutes: number
  /** True if this stop has an enclosed shelter / ticket booth. */
  sheltered: boolean
  /** True if transfer to another line is possible here. */
  transfer?: string[]
}

export interface UrbanLine {
  /** Stable slug — primary key. */
  id: string
  networkId: UrbanNetworkId
  /** Short label shown on vehicles and station signs. */
  code: string      // "L1"
  /** Human-readable name. */
  name: string      // "Olembé ↔ Ahala"
  /** Primary color of the line in maps, tickets and station pylons. */
  color: string
  /** Ordered stops (terminus first). */
  stops: UrbanStop[]
  /** Total trip duration end-to-end (minutes). */
  durationMinutes: number
  /** Peak frequency in minutes (06:00-09:00 / 17:00-20:00). */
  peakHeadwayMin: number
  /** Off-peak frequency in minutes. */
  offPeakHeadwayMin: number
  /** Service window. */
  serviceWindow: { startHour: number; endHour: number }
  /** Flat-fare band (XAF integer). Stored as price range to support
   *  full-route vs short-hop tickets. */
  fareBands: { label: string; priceXaf: number; description: string }[]
}

export interface UrbanNetwork {
  id: UrbanNetworkId
  city: CityId
  operatorName: string
  /** Marketing brand. */
  brand: string
  /** Short user-facing blurb. */
  tagline: string
  /** True if e-ticket / contactless is supported. */
  hasETicket: boolean
  /** Payment methods supported. */
  paymentMethods: string[]
  /** Brand colors. */
  brandKey: keyof typeof BRAND_HUES
}

// ────────────────────────────────────────────────────────────────────────────
//  Yaoundé — STECY (successeur du Bus Urbain de Yaoundé, ex-Le Bus)
//  Source : Rapport JICA + PCM SUMP Yaoundé 2019 + recherches opérateurs.
// ────────────────────────────────────────────────────────────────────────────
const STECY_LINES: UrbanLine[] = [
  {
    id: "stecy-olembe-ahala",
    networkId: "stecy-yaounde",
    code: "L1",
    name: "Olembé ↔ Ahala",
    color: "#0E5C40",
    durationMinutes: 55,
    peakHeadwayMin: 4,
    offPeakHeadwayMin: 8,
    serviceWindow: { startHour: 5, endHour: 22 },
    fareBands: [
      { label: "Ticket unitaire", priceXaf: 250, description: "Valable 1 trajet, correspondance gratuite dans les 45 min." },
      { label: "Carnet 10 trajets", priceXaf: 2200, description: "Économie 12% · rechargeable sur Tap&Go." },
      { label: "Abonnement mensuel", priceXaf: 9000, description: "Voyages illimités · rechargeable sur Tap&Go." },
    ],
    stops: [
      { id: "olembe",   name: "Olembé (Stade)",     offsetMinutes: 0,   sheltered: true,  transfer: ["L2"] },
      { id: "odza",     name: "Odza",                offsetMinutes: 8,   sheltered: false },
      { id: "nlongkak", name: "Nlongkak",            offsetMinutes: 18,  sheltered: true,  transfer: ["L2", "L3"] },
      { id: "centre",   name: "Centre Administratif",offsetMinutes: 25,  sheltered: true,  transfer: ["L2"] },
      { id: "mvan",     name: "Mvan",                offsetMinutes: 33,  sheltered: true,  transfer: ["L3"] },
      { id: "biyem-assi",name:"Biyem-Assi",          offsetMinutes: 42,  sheltered: true,  transfer: ["L2"] },
      { id: "ahala",    name: "Ahala",               offsetMinutes: 55,  sheltered: true },
    ],
  },
  {
    id: "stecy-mvan-ngousso",
    networkId: "stecy-yaounde",
    code: "L2",
    name: "Mvan ↔ Ngousso",
    color: "#C2772A",
    durationMinutes: 40,
    peakHeadwayMin: 5,
    offPeakHeadwayMin: 10,
    serviceWindow: { startHour: 5, endHour: 22 },
    fareBands: [
      { label: "Ticket unitaire", priceXaf: 250, description: "Valable 1 trajet." },
      { label: "Carnet 10 trajets", priceXaf: 2200, description: "Économie 12%." },
    ],
    stops: [
      { id: "mvan",       name: "Mvan",          offsetMinutes: 0,  sheltered: true,  transfer: ["L1", "L3"] },
      { id: "mokolo",     name: "Mokolo",        offsetMinutes: 9,  sheltered: false },
      { id: "poste-centrale",name:"Poste Centrale",offsetMinutes: 16, sheltered: true, transfer: ["L1"] },
      { id: "nlongkak",   name: "Nlongkak",      offsetMinutes: 22, sheltered: true,  transfer: ["L1", "L3"] },
      { id: "ngousso",    name: "Ngousso",       offsetMinutes: 40, sheltered: true },
    ],
  },
  {
    id: "stecy-mvan-mimboman",
    networkId: "stecy-yaounde",
    code: "L3",
    name: "Mvan ↔ Mimboman Terminus",
    color: "#1F3A5F",
    durationMinutes: 35,
    peakHeadwayMin: 6,
    offPeakHeadwayMin: 12,
    serviceWindow: { startHour: 5, endHour: 22 },
    fareBands: [
      { label: "Ticket unitaire", priceXaf: 250, description: "Valable 1 trajet." },
      { label: "Carnet 10 trajets", priceXaf: 2200, description: "Économie 12%." },
    ],
    stops: [
      { id: "mvan",     name: "Mvan",       offsetMinutes: 0,  sheltered: true, transfer: ["L1", "L2"] },
      { id: "etoudi",   name: "Etoudi",     offsetMinutes: 10, sheltered: false },
      { id: "nlongkak", name: "Nlongkak",   offsetMinutes: 18, sheltered: true, transfer: ["L1", "L2"] },
      { id: "mimboman", name: "Mimboman Terminus", offsetMinutes: 35, sheltered: true },
    ],
  },
]

// ────────────────────────────────────────────────────────────────────────────
//  Douala — PMUD / BRT
//  Source : World Bank PMUD implementation report, JICA openjicareport,
//  Business in Cameroon.
// ────────────────────────────────────────────────────────────────────────────
const PMUD_LINES: UrbanLine[] = [
  {
    id: "pmud-l1-bonaberi-yassa",
    networkId: "pmud-douala",
    code: "B1",
    name: "Bonabéri ↔ Yassa",
    color: "#0E5C40",
    durationMinutes: 60,
    peakHeadwayMin: 3,
    offPeakHeadwayMin: 6,
    serviceWindow: { startHour: 5, endHour: 22 },
    fareBands: [
      { label: "Ticket BRT unitaire", priceXaf: 500, description: "Valable 1 trajet BRT, correspondance gratuite 30 min." },
      { label: "Carnet BRT 10 trajets", priceXaf: 4500, description: "Économie 10%." },
      { label: "Abonnement mensuel", priceXaf: 14000, description: "Voyages illimités sur le réseau BRT." },
    ],
    stops: [
      { id: "bonaberi",   name: "Bonabéri (Terminus Ouest)", offsetMinutes: 0,  sheltered: true,  transfer: ["B2"] },
      { id: "ndokoti",    name: "Ndokoti",                   offsetMinutes: 12, sheltered: true,  transfer: ["B2", "B3"] },
      { id: "akwa",       name: "Akwa",                      offsetMinutes: 22, sheltered: true,  transfer: ["B2"] },
      { id: "central",    name: "Central (Gare Centrale)",   offsetMinutes: 32, sheltered: true,  transfer: ["B3"] },
      { id: "bonanjo",    name: "Bonanjo",                   offsetMinutes: 40, sheltered: true },
      { id: "pk8",        name: "PK8",                       offsetMinutes: 48, sheltered: true },
      { id: "yassa",      name: "Yassa (Terminus Est)",      offsetMinutes: 60, sheltered: true,  transfer: ["B3"] },
    ],
  },
  {
    id: "pmud-l2-bonaberi-pk14",
    networkId: "pmud-douala",
    code: "B2",
    name: "Bonabéri ↔ PK14",
    color: "#C2772A",
    durationMinutes: 55,
    peakHeadwayMin: 4,
    offPeakHeadwayMin: 8,
    serviceWindow: { startHour: 5, endHour: 22 },
    fareBands: [
      { label: "Ticket BRT unitaire", priceXaf: 500, description: "Valable 1 trajet BRT." },
      { label: "Carnet BRT 10 trajets", priceXaf: 4500, description: "Économie 10%." },
    ],
    stops: [
      { id: "bonaberi", name: "Bonabéri",         offsetMinutes: 0,  sheltered: true, transfer: ["B1"] },
      { id: "bepanda",  name: "Bépanda",          offsetMinutes: 12, sheltered: true },
      { id: "ndokoti",  name: "Ndokoti",          offsetMinutes: 22, sheltered: true, transfer: ["B1", "B3"] },
      { id: "bonapriso",name: "Bonapriso",        offsetMinutes: 32, sheltered: true },
      { id: "akwa",     name: "Akwa",             offsetMinutes: 42, sheltered: true, transfer: ["B1"] },
      { id: "pk14",     name: "PK14 (Terminus)",  offsetMinutes: 55, sheltered: true },
    ],
  },
  {
    id: "pmud-l3-nelson-mandela-yassa",
    networkId: "pmud-douala",
    code: "B3",
    name: "Nelson Mandela ↔ Yassa",
    color: "#1F3A5F",
    durationMinutes: 50,
    peakHeadwayMin: 4,
    offPeakHeadwayMin: 8,
    serviceWindow: { startHour: 5, endHour: 22 },
    fareBands: [
      { label: "Ticket BRT unitaire", priceXaf: 500, description: "Valable 1 trajet BRT." },
    ],
    stops: [
      { id: "nelson-mandela", name: "Nelson Mandela", offsetMinutes: 0,  sheltered: true, transfer: ["B2"] },
      { id: "central",        name: "Central",        offsetMinutes: 14, sheltered: true, transfer: ["B1"] },
      { id: "ndokoti",        name: "Ndokoti",        offsetMinutes: 26, sheltered: true, transfer: ["B1", "B2"] },
      { id: "bonamoussadi",   name: "Bonamoussadi",   offsetMinutes: 38, sheltered: true },
      { id: "yassa",          name: "Yassa",          offsetMinutes: 50, sheltered: true, transfer: ["B1"] },
    ],
  },
]

export const URBAN_NETWORKS: UrbanNetwork[] = [
  {
    id: "stecy-yaounde",
    city: "yaounde",
    operatorName: "STECY (Société de Transport et d'Equipement du Cameroun)",
    brand: "Trans-Yaoundé",
    tagline: "Le réseau BRT nord-sud de Yaoundé — Olembé ↔ Ahala sur 21 km",
    hasETicket: true,
    paymentMethods: ["Tap&Go", "Mobile Money", "Cash"],
    brandKey: "transyaounde",
  },
  {
    id: "pmud-douala",
    city: "douala",
    operatorName: "PMUD — Projet de Mobilité Urbaine de Douala",
    brand: "BRT Douala",
    tagline: "4 lignes BRT — 27 km — 44 stations — interconnecté au réseau national",
    hasETicket: true,
    paymentMethods: ["Tap&Go", "Mobile Money", "Cash", "Carte bancaire"],
    brandKey: "pmud",
  },
]

export const URBAN_LINES: UrbanLine[] = [...STECY_LINES, ...PMUD_LINES]

/** Lookup. */
export function findUrbanLine(id: string): UrbanLine | null {
  return URBAN_LINES.find((l) => l.id === id) ?? null
}

/** All lines that pass through a stop id. */
export function urbanLinesAtStop(stopId: string): UrbanLine[] {
  return URBAN_LINES.filter((l) => l.stops.some((s) => s.id === stopId))
}

/** Network by id. */
export function findUrbanNetwork(id: UrbanNetworkId): UrbanNetwork | null {
  return URBAN_NETWORKS.find((n) => n.id === id) ?? null
}

// ────────────────────────────────────────────────────────────────────────────
//  Reference price helpers — for landing pages, hero reels, dashboard badges
// ────────────────────────────────────────────────────────────────────────────
export function cheapestInterurbanPriceXaf(): number {
  let min = Number.MAX_SAFE_INTEGER
  for (const a of AGENCIES) {
    for (const r of a.routes) {
      if (r.basePriceXaf < min) min = r.basePriceXaf
    }
  }
  return min === Number.MAX_SAFE_INTEGER ? 3500 : min
}

export function cheapestUrbanFareXaf(): number {
  let min = Number.MAX_SAFE_INTEGER
  for (const l of URBAN_LINES) {
    for (const f of l.fareBands) {
      if (f.label.toLowerCase().startsWith("ticket") && f.priceXaf < min) min = f.priceXaf
    }
  }
  return min === Number.MAX_SAFE_INTEGER ? 250 : min
}

/** Human price label for the hero reel — single source. */
export function priceLabel(xaf: number): string {
  return priceXaf(xaf)
}