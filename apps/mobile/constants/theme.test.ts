import { describe, expect, it } from "vitest";
import { colors, radius, spacing, typography } from "./theme";

describe("brand tokens", () => {
  it("uses the exact ink/paper/wood palette", () => {
    expect(colors.ink).toBe("#0E0E0E");
    expect(colors.paper).toBe("#F5F4F1");
    expect(colors.wood).toBe("#B89B7B");
    expect(colors.line).toBe("#D8D4CC");
  });

  it("enforces zero radius (Swiss/Bauhaus, no rounded corners)", () => {
    expect(radius).toBe(0);
  });

  it("defines spacing and typography scales", () => {
    expect(spacing.md).toBe(16);
    expect(typography.eyebrow.tracking).toBe(0.22);
  });
});
