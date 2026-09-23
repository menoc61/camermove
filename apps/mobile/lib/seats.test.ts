import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  AppState: { currentState: "active", addEventListener: () => ({ remove: () => {} }) },
}));

import { deriveSeatMap } from "./seats";

describe("deriveSeatMap", () => {
  it("marks taken head-count plus every 5th seat, picked overrides", () => {
    const map = deriveSeatMap(44, 40, 7);
    expect(map.slice(0, 4)).toEqual(["taken", "taken", "taken", "taken"]);
    expect(map[4]).toBe("taken");
    expect(map[5]).toBe("available");
    expect(map[6]).toBe("held");
    expect(map).toHaveLength(44);
  });

  it("returns all available when availability unknown", () => {
    expect(deriveSeatMap(10, null, null).every((s) => s === "available")).toBe(true);
  });
});
