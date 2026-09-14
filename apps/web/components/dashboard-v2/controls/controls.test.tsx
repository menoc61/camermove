import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildExportQuery, clampPage, parseExportFilename, shouldShowPagination } from "./lib";

const dir =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

function src(name: string) {
  return readFileSync(join(dir, `${name}.tsx`), "utf8");
}

describe("PaginationControls hides when totalPages<=1", () => {
  it("returns false for 0 and 1, true above", () => {
    expect(shouldShowPagination(0)).toBe(false);
    expect(shouldShowPagination(1)).toBe(false);
    expect(shouldShowPagination(2)).toBe(true);
  });

  it("clamps page into [1, totalPages]", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(6, 5)).toBe(5);
    expect(clampPage(3, 5)).toBe(3);
  });

  it("component returns null when hidden (source guard)", () => {
    expect(src("PaginationControls")).toMatch(/totalPages\s*<=\s*1/);
    expect(src("PaginationControls")).toMatch(/aria-label="Pagination"/);
  });
});

describe("export builds qs + parses Content-Disposition", () => {
  it("builds qs with dateFrom/dateTo/format", () => {
    const qs = buildExportQuery({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      format: "csv",
    });
    expect(qs).toContain("dateFrom=2026-01-01");
    expect(qs).toContain("dateTo=2026-01-31");
    expect(qs).toContain("format=csv");
  });

  it("omits empty dates but keeps format", () => {
    const qs = buildExportQuery({ dateFrom: "", dateTo: "", format: "json" });
    expect(qs).toBe("format=json");
  });

  it("parses quoted and bare filenames", () => {
    expect(
      parseExportFilename(
        'attachment; filename="export-bookings-2026-01-01-2026-01-31.csv"',
        "fallback.csv",
      ),
    ).toBe("export-bookings-2026-01-01-2026-01-31.csv");
    expect(
      parseExportFilename("attachment; filename=export.json", "fallback.json"),
    ).toBe("export.json");
    expect(parseExportFilename("", "fallback.csv")).toBe("fallback.csv");
  });

  it("export form follows shadcn FieldGroup+Field + data-invalid", () => {
    const s = src("ExportButton");
    expect(s).toMatch(/FieldGroup/);
    expect(s).toMatch(/<Field[\s>]/);
    expect(s).toMatch(/data-invalid|aria-invalid/);
    expect(s).toMatch(/Select/);
    expect(s).toMatch(/type="date"/);
  });
});

describe("cancel confirms via alert-dialog (no window.confirm)", () => {
  it("has no window.confirm and uses alertdialog", () => {
    const s = src("CancelButton");
    expect(s).not.toMatch(/window\.confirm/);
    expect(s).toMatch(/alertdialog/i);
  });

  it("requires explicit confirm affordance", () => {
    const s = src("CancelButton");
    expect(s).toMatch(/Confirmer|Confirm/);
    expect(s).toMatch(/Annuler|Cancel/);
  });
});
