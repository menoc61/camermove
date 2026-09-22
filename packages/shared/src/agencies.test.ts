/**
 * Single source of truth guards for the agency / urban registry.
 *
 * If you change anything in `agencies.ts`, these tests guard the invariants
 * downstream code relies on — they exist to prevent silent regressions.
 */
import { describe, it, expect } from "vitest"
import {
  AGENCIES,
  CITIES,
  URBAN_LINES,
  URBAN_NETWORKS,
  AMENITY_LABEL,
  INTERURBAN_CLASSES,
  findAgency,
  findCity,
  findUrbanLine,
  findUrbanNetwork,
  agenciesHeadquartered,
  agenciesServing,
  cityCoords,
  urbanLinesAtStop,
  cheapestInterurbanPriceXaf,
  cheapestUrbanFareXaf,
  allServedCities,
} from "./agencies"

describe("agencies registry — single source of truth", () => {
  it("every agency has a unique slug", () => {
    const slugs = AGENCIES.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("every agency has at least one route", () => {
    for (const a of AGENCIES) {
      expect(a.routes.length, a.slug).toBeGreaterThan(0)
    }
  })

  it("every route references cities that exist in the city registry", () => {
    for (const a of AGENCIES) {
      for (const r of a.routes) {
        expect(CITIES[r.origin], `${a.slug} route origin`).toBeDefined()
        expect(CITIES[r.destination], `${a.slug} route destination`).toBeDefined()
      }
    }
  })

  it("every agency HQ and branch is a real city", () => {
    for (const a of AGENCIES) {
      expect(CITIES[a.headquartersCity], `${a.slug} HQ`).toBeDefined()
      for (const b of a.branchCities) {
        expect(CITIES[b], `${a.slug} branch ${b}`).toBeDefined()
      }
    }
  })

  it("findAgency / findCity / findUrbanLine round-trip", () => {
    expect(findAgency("buca-voyages")?.slug).toBe("buca-voyages")
    expect(findCity("Yaoundé")?.id).toBe("yaounde")
    expect(findCity("yaounde")?.id).toBe("yaounde")
    expect(findUrbanLine("stecy-olembe-ahala")?.code).toBe("L1")
    expect(findUrbanNetwork("pmud-douala")?.city).toBe("douala")
    expect(findAgency("nope")).toBeNull()
    expect(findCity("Atlantis")).toBeNull()
  })

  it("agenciesServing returns at least one agency for each big city", () => {
    for (const c of ["yaounde", "douala", "bafoussam"] as const) {
      expect(agenciesServing(c).length).toBeGreaterThan(0)
    }
  })

  it("agenciesHeadquartered filter is correct", () => {
    expect(agenciesHeadquartered("douala").map((a) => a.slug)).toContain("princesse-voyages")
    expect(agenciesHeadquartered("bafoussam").map((a) => a.slug)).toContain("general-express")
  })

  it("cityCoords returns coords or null, never throws", () => {
    expect(cityCoords("Yaoundé")).toEqual({ lat: 3.848, lon: 11.498 })
    expect(cityCoords("nope")).toBeNull()
  })

  it("every urban line belongs to a known network and has unique code within it", () => {
    const seen = new Map<string, Set<string>>()
    for (const l of URBAN_LINES) {
      expect(URBAN_NETWORKS.some((n) => n.id === l.networkId)).toBe(true)
      const set = seen.get(l.networkId) ?? new Set<string>()
      expect(set.has(l.code), `dup code ${l.code} in ${l.networkId}`).toBe(false)
      set.add(l.code)
      seen.set(l.networkId, set)
      expect(l.stops[0]).toBeDefined()
      expect(l.stops[l.stops.length - 1]).toBeDefined()
    }
  })

  it("every urban line has at least 2 stops with monotonic offsets", () => {
    for (const l of URBAN_LINES) {
      expect(l.stops.length).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < l.stops.length; i++) {
        const cur = l.stops[i]!
        const prev = l.stops[i - 1]!
        expect(cur.offsetMinutes).toBeGreaterThan(prev.offsetMinutes)
      }
    }
  })

  it("urbanLinesAtStop finds at least one line for major transfer stops", () => {
    expect(urbanLinesAtStop("nlongkak").length).toBeGreaterThan(0)
    expect(urbanLinesAtStop("ndokoti").length).toBeGreaterThan(0)
  })

  it("cheapestInterurbanPriceXaf is consistent with the registry", () => {
    const expected = Math.min(...AGENCIES.flatMap((a) => a.routes.map((r) => r.basePriceXaf)))
    expect(cheapestInterurbanPriceXaf()).toBe(expected)
  })

  it("cheapestUrbanFareXaf picks the cheapest unit ticket", () => {
    const units = URBAN_LINES.flatMap((l) =>
      l.fareBands.filter((f) => f.label.toLowerCase().startsWith("ticket")).map((f) => f.priceXaf),
    )
    expect(cheapestUrbanFareXaf()).toBe(Math.min(...units))
  })

  it("allServedCities returns CityRecords (no strings)", () => {
    for (const c of allServedCities()) {
      expect(typeof c.label).toBe("string")
      expect(typeof c.lat).toBe("number")
    }
  })

  it("AMENITY_LABEL covers every amenity referenced by any agency", () => {
    const referenced = new Set<string>()
    for (const a of AGENCIES) for (const r of a.amenities) referenced.add(r)
    for (const r of referenced) {
      expect(AMENITY_LABEL[r as keyof typeof AMENITY_LABEL]).toBeDefined()
    }
  })

  it("INTERURBAN_CLASSES is non-empty", () => {
    expect(INTERURBAN_CLASSES.length).toBeGreaterThan(0)
  })
})