import type { FastifyReply } from "fastify"
import { z } from "zod"

export const ExportQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  format: z.enum(["json", "csv"]).default("json"),
  q: z.string().optional(),
  groupBy: z.string().optional(),
  orderBy: z.string().optional(),
  status: z.string().optional(),
  routeId: z.string().optional(),
})

function toRecord(row: unknown): Record<string, unknown> {
  if (row !== null && typeof row === "object") return row as Record<string, unknown>
  return {}
}

export function toCsv(rows: unknown[], columns: string[]): string {
  const header = columns.join(",")
  const lines = rows.map((row) => {
    const r = toRecord(row)
    return columns.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(",")
  })
  return [header, ...lines].join("\n")
}

export async function sendExport(
  reply: FastifyReply,
  resource: string,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  format: "json" | "csv",
  rows: unknown[],
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

export function parseExportQuery(query: unknown) {
  const parsed = ExportQuerySchema.parse(query ?? {})
  return parsed
}
