import { z } from "zod"

/**
 * Public lookup by booking reference (CM-XXXXXXXX).
 * Returns 200 with sanitized JSON, 404 if not found, 410 if past departure.
 * Per AGENTS.md §1: dual-layer rate limited (IP + app-wide).
 */
export const LookupQuery = z.object({
  ref: z
    .string()
    .regex(/^CM-[A-Z0-9]{6,12}$/, "Format de référence invalide (attendu: CM-XXXXXXXX)"),
})

/**
 * Public lookup by ticket verification code (12-char base32).
 * Same redacted view as /lookup?ref=.
 */
export const LookupByCodeParams = z.object({
  code: z.string().regex(/^[A-Z0-9]{8,12}$/, "Code de vérification invalide"),
})

export type LookupQuery = z.infer<typeof LookupQuery>
export type LookupByCodeParams = z.infer<typeof LookupByCodeParams>
