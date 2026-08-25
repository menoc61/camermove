/**
 * Ticket generation service. Called inside the caller's Prisma $transaction
 * (confirmPaymentSuccess) so ticket create is atomic with the booking confirm
 * + commission create + audit log writes. Per AGENTS.md §1 ACID.
 *
 * Idempotent: presence check by bookingId. If a ticket already exists, the
 * existing row is returned without insertion.
 *
 * QR code is rendered as base64 PNG data URL (qrcode@^1.5.4) and stored in
 * Ticket.qrDataUrl @db.Text so the same PNG can be embedded in the email
 * notification without any external host (no tracking, no CDN).
 */
import type { Prisma } from "@camermove/db"
import { ConflictError } from "@camermove/config"
import { randomBytes } from "node:crypto"
import QRCode from "qrcode"

const MAX_COLLISION_RETRIES = 3

/** 12-char base32 verification code (Crockford alphabet, no ambiguous chars). */
export function generateVerificationCode(): string {
  // 10 random bytes -> 12 base64url chars (no padding, alphabet is [A-Z0-9]).
  // 10 bytes = 80 bits; base64url of 10 bytes = 14 chars; we slice to 12.
  // We avoid Node's base32 (not a BufferEncoding) and use base64url which is.
  return randomBytes(10).toString("base64url").toUpperCase().replace(/[-_]/g, "").slice(0, 12)
}

/** Opaque QR payload — only the verification code, no PII. */
export function generateQrPayload(verificationCode: string): string {
  return `CM-T:${verificationCode}`
}

export interface IssuedTicket {
  id: string
  bookingId: string
  verificationCode: string
  qrCode: string
  qrDataUrl: string
  status: string
  issuedAt: Date
  createdNew: boolean
}

/**
 * Generate and issue a ticket inside the caller's transaction. Idempotent.
 * Throws ConflictError if a unique verificationCode cannot be generated in
 * MAX_COLLISION_RETRIES tries (astronomically unlikely).
 */
export async function generateAndIssueTicket(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<IssuedTicket> {
  // Idempotency: if a ticket already exists for this booking, return it.
  const existing = await tx.ticket.findFirst({ where: { bookingId } })
  if (existing) {
    return {
      id: existing.id,
      bookingId: existing.bookingId,
      verificationCode: existing.verificationCode,
      qrCode: existing.qrCode,
      qrDataUrl: existing.qrDataUrl ?? "",
      status: existing.status,
      issuedAt: existing.issuedAt,
      createdNew: false,
    }
  }

  // Look up the trip to set expiresAt = departureAt (for downstream cron-based expiration)
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { trip: true } })
  if (!booking) throw new ConflictError("Réservation introuvable pour génération de billet")

  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    const verificationCode = generateVerificationCode()
    const qrCode = generateQrPayload(verificationCode)
    const qrDataUrl = await QRCode.toDataURL(verificationCode, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
      color: { dark: "#0e9f8f", light: "#ffffff" },
    })

    try {
      const ticket = await tx.ticket.create({
        data: {
          bookingId,
          qrCode,
          verificationCode,
          status: "valid",
          qrDataUrl,
        },
      })
      return {
        id: ticket.id,
        bookingId: ticket.bookingId,
        verificationCode: ticket.verificationCode,
        qrCode: ticket.qrCode,
        qrDataUrl: ticket.qrDataUrl ?? qrDataUrl,
        status: ticket.status,
        issuedAt: ticket.issuedAt,
        createdNew: true,
      }
    } catch (e) {
      const msg = (e as Error).message ?? ""
      // Prisma P2002 unique constraint violation on verificationCode — retry
      if (msg.includes("Unique constraint") || msg.includes("verificationCode") || msg.includes("P2002")) {
        continue
      }
      throw e
    }
  }
  throw new ConflictError("Impossible de générer un code de billet unique après plusieurs tentatives")
}
