import { describe, expect, it } from "vitest";
import { formatCountdown, formatXAF, occupancy } from "./format";

describe("format", () => {
  it("formats XAF with space grouping", () => {
    expect(formatXAF(2500)).toBe("2 500 FCFA");
    expect(formatXAF(15000)).toBe("15 000 FCFA");
  });

  it("formats countdown mm:ss and expiry", () => {
    expect(formatCountdown(600_000)).toBe("10:00");
    expect(formatCountdown(65_000)).toBe("01:05");
    expect(formatCountdown(0)).toBe("expiré");
    expect(formatCountdown(-5)).toBe("expiré");
  });

  it("computes occupancy percent", () => {
    expect(occupancy(44, 40)).toBe(9);
    expect(occupancy(44, 0)).toBe(100);
  });
});
