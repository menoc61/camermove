import type { FastifyReply } from "fastify"

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",")
  const lines = rows.map((r) => columns.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))
  return [header, ...lines].join("\n")
}

export async function sendExport(
  reply: FastifyReply,
  resource: string,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  format: "json" | "csv",
  rows: Record<string, unknown>[],
  columns: string[]
) {
  const from = dateFrom ?? "all"
  const to = dateTo ?? "all"
  const filename = `export-${resource}-${from}-${to}.${format}`
  if (format === "csv") {
    const csv = toCsv(rows, columns)
    return reply.header("Content-Type", "text/csv").header("Content-Disposition", `attachment; filename="${filename}"`).send(csv)
  }
  return reply.header("Content-Disposition", `attachment; filename="${filename}"`).send(rows)
}

export function parseExportQuery(query: Record<string, unknown>) {
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined
  const format = (query.format as string) === "csv" ? "csv" as const : "json" as const
  const q = query.q as string | undefined
  const groupBy = query.groupBy as string | undefined
  const orderBy = query.orderBy as string | undefined
  return { dateFrom, dateTo, format, q, groupBy, orderBy }
}
