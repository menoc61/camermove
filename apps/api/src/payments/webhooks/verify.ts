import crypto from "node:crypto"

/**
 * Verify NotchPay webhook HMAC.
 * rawBody MUST be the raw JSON string (req.rawBody), never JSON.stringify(parsed).
 */
export function verifyNotchSignature(rawBody: string, signature: string, hashKey: string): boolean {
  if (!rawBody || !signature || !hashKey) return false
  const expected = crypto.createHmac("sha256", hashKey).update(rawBody).digest("hex")
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))
  } catch {
    return false
  }
}

/**
 * Verify CinetPay x-token HMAC.
 * Concatenates 15 fields in exact doc order, empty string for missing, HMAC SHA256 hex + timingSafeEqual.
 * Falls back to Object.values(form).join("") per RESEARCH if primary fails.
 */
export function verifyCinetToken(
  form: Record<string, string>,
  xToken: string,
  secretKey: string,
): boolean {
  if (!xToken || !secretKey) return false
  const data =
    (form.cpm_site_id ?? "") +
    (form.cpm_trans_id ?? "") +
    (form.cpm_trans_date ?? "") +
    (form.cpm_amount ?? "") +
    (form.cpm_currency ?? "") +
    (form.signature ?? "") +
    (form.payment_method ?? "") +
    (form.cel_phone_num ?? "") +
    (form.cpm_phone_prefixe ?? "") +
    (form.cpm_language ?? "") +
    (form.cpm_version ?? "") +
    (form.cpm_payment_config ?? "") +
    (form.cpm_page_action ?? "") +
    (form.cpm_custom ?? "") +
    (form.cpm_designation ?? "") +
    (form.cpm_error_message ?? "")

  const expected = crypto.createHmac("sha256", secretKey).update(data).digest("hex")
  try {
    if (crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(xToken, "hex"))) {
      return true
    }
  } catch {
    // fall through to fallback
  }

  // Fallback: some docs show hash_hmac over implode('', $_POST)
  const fallbackData = Object.values(form).join("")
  const fallbackExpected = crypto.createHmac("sha256", secretKey).update(fallbackData).digest("hex")
  try {
    return crypto.timingSafeEqual(Buffer.from(fallbackExpected, "hex"), Buffer.from(xToken, "hex"))
  } catch {
    return false
  }
}
