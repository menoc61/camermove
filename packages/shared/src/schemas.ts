/**
 * Small reusable Zod helpers — single source of truth.
 *
 * Anything used in more than one Zod schema lives here. Avoid redefining
 * `zId` or date range helpers locally in feature modules.
 */
import { z } from "zod"

/** CUID-shaped string id — used for every ID parameter. */
export const zId = z.string().min(1).max(64)

/** Date-range query: from / to as ISO YYYY-MM-DD inclusive both sides. */
export const dateRange = z
  .object({
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .partial()