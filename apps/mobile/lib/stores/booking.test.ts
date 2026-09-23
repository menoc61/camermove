import { describe, expect, it } from "vitest";
import { useBookingStore } from "./booking";

describe("booking store", () => {
  it("defaults to empty draft with one passenger row", () => {
    useBookingStore.getState().reset();
    const s = useBookingStore.getState();
    expect(s.tripId).toBeNull();
    expect(s.seatCount).toBe(1);
    expect(s.passengers).toEqual([{ fullName: "" }]);
  });

  it("setBooking replaces trip and passengers", () => {
    useBookingStore.getState().reset();
    useBookingStore.getState().setBooking({
      tripId: "t1",
      seatCount: 2,
      passengers: [{ fullName: "A B" }, { fullName: "C D" }],
    });
    const s = useBookingStore.getState();
    expect(s.tripId).toBe("t1");
    expect(s.passengers).toHaveLength(2);
  });
});
