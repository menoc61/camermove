import { describe, expect, it } from "vitest";
import { isEmailValid, isPasswordValid, isPhoneValid, validatePassenger } from "./validation";

describe("validation", () => {
  it("matches web rules", () => {
    expect(isEmailValid("a@b.cm")).toBe(true);
    expect(isEmailValid("nope")).toBe(false);
    expect(isPasswordValid("12345678")).toBe(true);
    expect(isPasswordValid("short")).toBe(false);
    expect(isPhoneValid("+237690000000")).toBe(true);
    expect(isPhoneValid("+237 690 00 00 00")).toBe(true);
    expect(isPhoneValid("123")).toBe(false);
  });

  it("validates passengers like PassengerForm", () => {
    expect(validatePassenger({ fullName: "A" })).toEqual({ fullName: "Nom complet requis (min 2 caractères)" });
    expect(validatePassenger({ fullName: "A B", phone: "bad" })).toEqual({ phone: "Téléphone invalide (E.164, ex: +2376XXXXXXXX)" });
    expect(validatePassenger({ fullName: "A B" })).toEqual({});
  });
});
