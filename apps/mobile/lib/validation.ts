export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164 = /^\+?[1-9]\d{7,14}$/;

export function isEmailValid(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function isPasswordValid(password: string): boolean {
  return password.length >= 8;
}

export function isPhoneValid(phone: string): boolean {
  return E164.test(phone.replace(/\s/g, ""));
}

export interface PassengerDraft {
  fullName: string;
  phone?: string;
}

export function validatePassenger(p: PassengerDraft): { fullName?: string; phone?: string } {
  const errors: { fullName?: string; phone?: string } = {};
  if (!p.fullName || p.fullName.trim().length < 2) {
    errors.fullName = "Nom complet requis (min 2 caractères)";
  }
  if (p.phone && p.phone.trim() !== "" && !isPhoneValid(p.phone)) {
    errors.phone = "Téléphone invalide (E.164, ex: +2376XXXXXXXX)";
  }
  return errors;
}
