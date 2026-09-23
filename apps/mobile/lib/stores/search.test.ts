import { describe, expect, it } from "vitest";
import { useSearchStore } from "./search";

describe("search store", () => {
  it("defaults to Yaounde -> Douala, tomorrow, 1 pax", () => {
    useSearchStore.getState().reset();
    const s = useSearchStore.getState();
    expect(s.origin).toBe("Yaoundé");
    expect(s.destination).toBe("Douala");
    expect(s.pax).toBe(1);
    expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("setSearch merges partial updates", () => {
    useSearchStore.getState().reset();
    useSearchStore.getState().setSearch({ pax: 3, origin: "Bafoussam" });
    const s = useSearchStore.getState();
    expect(s.pax).toBe(3);
    expect(s.origin).toBe("Bafoussam");
    expect(s.destination).toBe("Douala");
  });
});
