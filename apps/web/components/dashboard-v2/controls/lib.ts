export type ExportFormat = "csv" | "json";

export function buildExportQuery(o: { dateFrom: string; dateTo: string; format: ExportFormat }) {
  const qs = new URLSearchParams();
  if (o.dateFrom) qs.set("dateFrom", o.dateFrom);
  if (o.dateTo) qs.set("dateTo", o.dateTo);
  qs.set("format", o.format);
  return qs.toString();
}

export function parseExportFilename(cd: string, fallback: string) {
  const m = cd.match(/filename="([^"]+)"/) ?? cd.match(/filename=([^;]+)/);
  const name = m?.[1]?.trim().replace(/^"|"$/g, "");
  return name ? name : fallback;
}

export function shouldShowPagination(totalPages: number) {
  return Number.isFinite(totalPages) && totalPages > 1;
}

export function clampPage(page: number, totalPages: number) {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.floor(page)), Math.max(1, totalPages));
}
