import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTrip } from "./trips";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("trips api", () => {
  it("getTrip GETs /api/v1/trips/:id", async () => {
    const payload = {
      id: "t1",
      departureAt: "2026-10-01T08:00:00.000Z",
      arrivalEstimateAt: null,
      price: 3500,
      totalSeats: 44,
      vehicleTypeInfo: null,
      status: "scheduled",
      route: { originCity: "Yaoundé", destinationCity: "Douala" },
      transport: { companyName: "Amour Mezaam" },
      seatAvailability: { seatsAvailable: 40, seatsHeld: 0, seatsBooked: 4 },
    };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(getTrip("t1")).resolves.toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toBe("http://localhost:3000/api/v1/trips/t1");
    expect(init.method).toBe("GET");
  });

  it("throws a labelled error on non-2xx", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(getTrip("missing")).rejects.toThrow("trip failed");
  });
});
