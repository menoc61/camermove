import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "providers.tsx"), "utf8");

describe("QueryProvider defaults (overfetch guard)", () => {
  it("sets staleTime 30s, gcTime 300s, retry 1, no refetch on window focus", () => {
    expect(src).toContain("staleTime");
    expect(src).toMatch(/staleTime:\s*30_000/);
    expect(src).toMatch(/gcTime:\s*300_000/);
    expect(src).toMatch(/retry:\s*1/);
    expect(src).toMatch(/refetchOnWindowFocus:\s*false/);
  });
});
