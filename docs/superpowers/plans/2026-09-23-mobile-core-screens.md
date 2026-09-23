# Mobile Core Travel Screens Implementation Plan (Wave 2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the working traveler core: auth (email/password + Google), Home, Search + trip detail with live seats, booking + Mobile-Money/card payment, tickets (QR detail, lookup, rating), and Account — all backed by the real `/api/v1` backend.

**Architecture:** Thin expo-router route files render screen components from `screens/` (never co-locate, per `expo-router` skill). Data via React Query over the Wave-2a API modules; session via `useAuthStore` + `hydrateAuth` gate in the root layout; validation/formatting in tested `lib/` helpers; UI primitives in `components/ui/`; brand tokens from `constants/theme.ts` only.

**Tech Stack:** Expo SDK 57, expo-router Stack + JS Tabs, React Query 5, Reanimated (already present), expo-image (new), expo-web-browser + expo-auth-session (installed), vitest.

## Global Constraints

- REST only via `lib/api/*` (Wave 2a) — no new raw fetch except `useLiveSeats`/`logout`-style backend calls through `apiBase()`.
- Every screen with data implements loading / error / empty / content (per `expo-data-fetching`); lists use FlatList with `ListEmptyComponent`; forms use `keyboardShouldPersistTaps="handled"`.
- French copy, brand tokens, zero radius, no gradients. Kebab-case route/screen file names.
- Validation rules match web exactly: email regex, password ≥ 8, E.164 phone, fullName ≥ 2 chars.
- New packages only via `npx expo install`. No `eas` commands, no persistent dev servers in tasks.
- Each task: `typecheck` clean + `test` green + task commit with the exact message. UI (non-testable under vitest) is verified by typecheck + the S7 walkthrough checklist.

## Decisions (locked)

- Keep the template JS Tabs (stability over NativeTabs; revisit Wave 4). Tabs: Accueil, Recherche, Billets, Compte.
- Results live in the Search tab driven by `useSearchStore` (mobile equivalent of web's URL-param truth).
- Confirmation countdown derives from `booking.holdExpiresAt` with a 600s fallback (fixes the web's hardcoded 10:00).
- Google native sign-in: `openAuthSessionAsync` against the existing `/api/v1/auth/google` endpoint + `camermove://auth/callback` deep-link route. BACKEND DEPENDENCY: the API must redirect native flows (`?native=1`) to `camermove://auth/callback?accessToken=…&user=…`; if it does not yet, the button shows an explanatory error (S2 implements the client side fully; backend tweak is tracked as a follow-up, not a blocker).
- Rating (RateYourTrip parity): minimal form (stars 1–5 + comment) posting to `/api/v1/reviews`.

---

## File structure (this plan)

- Create: `apps/mobile/lib/format.ts` (+ test), `lib/validation.ts` (+ test), `lib/seats.ts` (derive + hook, test for derive)
- Create: `apps/mobile/lib/api/trips.ts` (+ test), `lib/api/landing.ts` (+ test), `lib/api/agencies.ts` (+ test), `lib/api/reviews.ts` (+ test)
- Create: `apps/mobile/components/ui/button.tsx`, `text-input.tsx`, `screen-state.tsx`, `toast.tsx`
- Create: `apps/mobile/components/auth/google-button.tsx`
- Create: `apps/mobile/screens/*.tsx` (home, search-results, trip-detail, book, confirmation, login, register, tickets, ticket-detail, lookup, account)
- Create routes: `app/login.tsx`, `app/register.tsx`, `app/auth/callback.tsx`, `app/trips/[id].tsx`, `app/book/[tripId].tsx`, `app/book/confirmation.tsx`, `app/tickets/[id].tsx`, `app/tickets/lookup.tsx`
- Modify: `app/_layout.tsx` (QueryClientProvider + ToastProvider + hydration gate), `app/(tabs)/_layout.tsx` (4 tabs), `app/(tabs)/index.tsx`, `app/(tabs)/search.tsx`, `app/(tabs)/tickets.tsx`, `app/(tabs)/account.tsx`; delete `app/(tabs)/two.tsx`

---

### Task S1: shared helpers, UI primitives, providers, expo-image

**Files:**
- Create: `apps/mobile/lib/format.ts`, `lib/format.test.ts`, `lib/validation.ts`, `lib/validation.test.ts`, `lib/seats.ts`, `lib/seats.test.ts`
- Create: `apps/mobile/components/ui/button.tsx`, `components/ui/text-input.tsx`, `components/ui/screen-state.tsx`, `components/ui/toast.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `colors/typography` (theme), `queryClient` (2a), `hydrateAuth` (2a).
- Produces: helpers + primitives consumed by S2–S6; provider shell (QueryClient + Toast + hydration gate) that all screens rely on.

- [ ] **Step 1: install expo-image**

Run in `apps/mobile` (workdir, never cd): `npx expo install expo-image`. Expected: success, SDK-57 pin.

- [ ] **Step 2: write failing tests**

Create `apps/mobile/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatCountdown, formatXAF, occupancy } from "./format";

describe("format", () => {
  it("formats XAF with space grouping", () => {
    expect(formatXAF(2500)).toBe("2 500 FCFA");
    expect(formatXAF(15000)).toBe("15 000 FCFA");
  });

  it("formats countdown mm:ss and expiry", () => {
    expect(formatCountdown(600_000)).toBe("10:00");
    expect(formatCountdown(65_000)).toBe("01:05");
    expect(formatCountdown(0)).toBe("expiré");
    expect(formatCountdown(-5)).toBe("expiré");
  });

  it("computes occupancy percent", () => {
    expect(occupancy(44, 40)).toBe(9);
    expect(occupancy(44, 0)).toBe(100);
  });
});
```

Create `apps/mobile/lib/validation.test.ts`:

```ts
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
```

Create `apps/mobile/lib/seats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveSeatMap } from "./seats";

describe("deriveSeatMap", () => {
  it("marks taken head-count plus every 5th seat, picked overrides", () => {
    const map = deriveSeatMap(44, 40, 7);
    expect(map.slice(0, 4)).toEqual(["taken", "taken", "taken", "taken"]);
    expect(map[4]).toBe("taken");
    expect(map[5]).toBe("available");
    expect(map[6]).toBe("held");
    expect(map).toHaveLength(44);
  });

  it("returns all available when availability unknown", () => {
    expect(deriveSeatMap(10, null, null).every((s) => s === "available")).toBe(true);
  });
});
```

- [ ] **Step 3: run tests to verify they fail**

Run: `pnpm --filter @camermove/mobile test -- lib/format lib/validation lib/seats`. Expected: FAIL, modules missing.

- [ ] **Step 4: write implementations**

Create `apps/mobile/lib/format.ts`:

```ts
export function formatXAF(amount: number): string {
  const grouped = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} FCFA`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "expiré";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function occupancy(totalSeats: number, seatsAvailable: number): number {
  if (!totalSeats) return 0;
  return Math.round(((totalSeats - seatsAvailable) / totalSeats) * 100);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "Départ imminent";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Départ imminent";
  if (h === 1) return "dans 1h";
  return `dans ${h}h`;
}
```

Create `apps/mobile/lib/validation.ts`:

```ts
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
```

Create `apps/mobile/lib/seats.ts`:

```ts
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { apiBase } from "./api/resource";

export type SeatState = "available" | "taken" | "held";

export function deriveSeatMap(totalSeats: number, seatsAvailable: number | null, picked: number | null): SeatState[] {
  if (seatsAvailable === null) {
    return Array.from({ length: totalSeats }, () => "available" as SeatState);
  }
  const takenCount = Math.max(0, totalSeats - seatsAvailable);
  return Array.from({ length: totalSeats }, (_, i) => {
    const n = i + 1;
    if (picked === n) return "held" as SeatState;
    if (n <= takenCount || n % 5 === 0) return "taken" as SeatState;
    return "available" as SeatState;
  });
}

export interface LiveSeats {
  seatsAvailable: number;
  totalSeats: number;
}

export function useLiveSeats(tripId: string | null, intervalMs = 10000): LiveSeats | null {
  const [seats, setSeats] = useState<LiveSeats | null>(null);
  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function fetchSeats() {
      if (AppState.currentState !== "active") return;
      try {
        const res = await fetch(`${apiBase()}/api/v1/trips/${tripId}`);
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { seatAvailability?: { seatsAvailable: number }; totalSeats: number };
        if (!alive) return;
        setSeats({
          seatsAvailable: data.seatAvailability?.seatsAvailable ?? data.totalSeats,
          totalSeats: data.totalSeats,
        });
      } catch {
        // keep stale seats on failure
      }
    }
    void fetchSeats();
    timer = setInterval(fetchSeats, intervalMs);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void fetchSeats();
    });
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [tripId, intervalMs]);
  return seats;
}
```

Create `apps/mobile/components/ui/button.tsx`:

```tsx
import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/constants/theme";

export function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.root, disabled && styles.disabled]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.ink, paddingVertical: 18, paddingHorizontal: 28, alignItems: "center" },
  disabled: { opacity: 0.4 },
  label: { fontSize: 12, fontWeight: "500", letterSpacing: 2.6, textTransform: "uppercase", color: colors.paper },
});
```

Create `apps/mobile/components/ui/text-input.tsx`:

```tsx
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { colors } from "@/constants/theme";

export function Field({ label, error, ...props }: { label: string; error?: string } & TextInputProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={colors.ink2}
        autoCapitalize="none"
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: "500", letterSpacing: 2.6, textTransform: "uppercase", color: colors.ink2, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: colors.ink, borderRadius: 0 },
  inputError: { borderColor: "#B3261E" },
  error: { fontSize: 13, color: "#B3261E", marginTop: 6 },
});
```

Create `apps/mobile/components/ui/screen-state.tsx`:

```tsx
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { Button } from "./button";

export function LoadingState({ label = "Chargement…" }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.ink} />
      <Text style={styles.note}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text selectable style={styles.message}>{message}</Text>
      <Button label="Réessayer" onPress={onRetry} />
    </View>
  );
}

export function EmptyState({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.paper },
  message: { fontSize: 16, color: colors.ink1, textAlign: "center" },
  note: { fontSize: 14, color: colors.ink2 },
});
```

Create `apps/mobile/components/ui/toast.tsx`:

```tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

const ToastContext = createContext((msg: string) => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg ? (
        <View style={styles.banner}>
          <Text style={styles.text}>{msg}</Text>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  banner: { position: "absolute", left: 16, right: 16, bottom: 32, backgroundColor: colors.ink, padding: 16 },
  text: { color: colors.paper, fontSize: 14 },
});
```

Modify `apps/mobile/app/_layout.tsx`: wrap providers + hydration gate. Apply these edits to the current file (keep everything else):

1. Add imports:
```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query/client";
import { hydrateAuth } from "@/lib/auth/session";
import { ToastProvider } from "@/components/ui/toast";
import { useState } from "react";
```
(`useEffect`/`useState` from react — extend the existing `import { useEffect } from 'react'` to `import { useEffect, useState } from 'react'`.)

2. In `RootLayout`, add before the `if (!loaded)` check:
```tsx
const [hydrated, setHydrated] = useState(false);

useEffect(() => {
  hydrateAuth().finally(() => setHydrated(true));
}, []);
```
and change the guard to `if (!loaded || !hydrated) { return null; }`.

3. In `RootLayoutNav`'s return, wrap the Stack:
```tsx
return (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </ToastProvider>
  </QueryClientProvider>
);
```
(New stack screens for S2/S4–S6 routes are added by their own tasks — each registers its route here.)

- [ ] **Step 5: run tests + typecheck**

Run: `pnpm --filter @camermove/mobile test`. Expected: all PASS (29 + 8 = 37).
Run: `pnpm --filter @camermove/mobile typecheck`. Expected: 0 errors.

- [ ] **Step 6: commit**

```bash
git add apps/mobile/lib/format.ts apps/mobile/lib/format.test.ts apps/mobile/lib/validation.ts apps/mobile/lib/validation.test.ts apps/mobile/lib/seats.ts apps/mobile/lib/seats.test.ts apps/mobile/components/ui/button.tsx apps/mobile/components/ui/text-input.tsx apps/mobile/components/ui/screen-state.tsx apps/mobile/components/ui/toast.tsx apps/mobile/app/_layout.tsx apps/mobile/package.json
git commit -m "feat(mobile): shared helpers, ui primitives, providers"
```

(Stage `package.json` only if `npx expo install expo-image` modified it — it will add the dep.)

---

### Task S2: auth screens (login, register, Google, callback)

**Files:**
- Create: `apps/mobile/components/auth/google-button.tsx`
- Create: `apps/mobile/screens/login.tsx`, `screens/register.tsx`
- Create routes: `apps/mobile/app/login.tsx`, `app/register.tsx`, `app/auth/callback.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (register the three routes)

**Interfaces:**
- Consumes: `login`/`register` (D1 api), `useAuthStore.setAuth` (D4), `apiBase` (F3), Button/Field/ErrorState (S1), `expo-auth-session`? (NOT needed — Google uses `WebBrowser.openAuthSessionAsync`, already-installed `expo-web-browser`).
- Produces: working email/password auth + Google entry points; `next` param convention (`login?next=/book/<id>`).

Google flow (client side, fully implemented here): open
`${apiBase()}/api/v1/auth/google?native=1` with return URL `camermove://auth/callback`.
BACKEND DEPENDENCY (follow-up, not this task): the API must redirect native
flows to `camermove://auth/callback?accessToken=…&user=<json>`; until then the
button surfaces the backend error message. Both the warm return
(`openAuthSessionAsync` result URL) and cold-start deep link (`app/auth/callback.tsx`
reading params) are handled.

- [ ] **Step 1: create the Google button**

Create `apps/mobile/components/auth/google-button.tsx`:

```tsx
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { apiBase } from "@/lib/api/resource";
import { Button } from "@/components/ui/button";

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email: string; role: string };
}

export function parseGoogleCallbackUrl(url: string): GoogleTokens | null {
  const query = url.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  const accessToken = params.get("accessToken");
  const userRaw = params.get("user");
  if (!accessToken || !userRaw) return null;
  try {
    const user = JSON.parse(decodeURIComponent(userRaw)) as GoogleTokens["user"];
    if (!user?.id || !user?.email) return null;
    return { accessToken, refreshToken: params.get("refreshToken") ?? undefined, user };
  } catch {
    return null;
  }
}

export function GoogleButton({ onTokens, onError }: { onTokens: (t: GoogleTokens) => void; onError: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    try {
      const res = await WebBrowser.openAuthSessionAsync(
        `${apiBase()}/api/v1/auth/google?native=1`,
        "camermove://auth/callback",
      );
      if (res.type === "success") {
        const tokens = parseGoogleCallbackUrl(res.url);
        if (tokens) onTokens(tokens);
        else onError("Connexion Google incomplète. Réessayez.");
      } else if (res.type === "cancel" || res.type === "dismiss") {
        onError("Connexion Google annulée.");
      } else {
        onError("Échec de la connexion Google.");
      }
    } catch {
      onError("Échec de la connexion Google.");
    } finally {
      setBusy(false);
    }
  }
  return <Button label={busy ? "Google…" : "Continuer avec Google"} onPress={start} disabled={busy} />;
}
```

- [ ] **Step 2: create login + register screens**

Create `apps/mobile/screens/login.tsx`:

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { login } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/session";
import { isEmailValid, isPasswordValid } from "@/lib/validation";
import { ApiError } from "@/lib/api/resource";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/text-input";
import { GoogleButton } from "@/components/auth/google-button";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";

export function LoginScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/(tabs)";
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const emailError = touched && email.length > 0 && !isEmailValid(email) ? "Adresse e-mail invalide." : undefined;

  async function submit() {
    setTouched(true);
    if (!isEmailValid(email)) {
      toast("Adresse e-mail invalide.");
      return;
    }
    if (!isPasswordValid(password)) {
      toast("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setBusy(true);
    try {
      const res = await login(email.trim(), password);
      setAuth({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user });
      toast("Connecté.");
      router.replace(next as never);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) toast("E-mail ou mot de passe incorrect.");
      else toast(e instanceof Error ? e.message : "Échec de la connexion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>CamerMove</Text>
      <Text style={styles.title}>Connexion</Text>
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" error={emailError} />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
      <Button label={busy ? "Connexion…" : "Se connecter"} onPress={submit} disabled={busy} />
      <View style={styles.gap} />
      <GoogleButton
        onTokens={(t) => {
          setAuth({ accessToken: t.accessToken, refreshToken: t.refreshToken, user: t.user });
          toast("Connecté avec Google.");
          router.replace(next as never);
        }}
        onError={toast}
      />
      <Text style={styles.switch} onPress={() => router.push(`/register${params.next ? `?next=${encodeURIComponent(params.next)}` : ""}` as never)}>
        Pas de compte ? Créer un compte
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingTop: 64 },
  eyebrow: { fontSize: 11, fontWeight: "500", letterSpacing: 2.4, textTransform: "uppercase", color: colors.ink2, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 24 },
  gap: { height: 12 },
  switch: { marginTop: 24, fontSize: 14, color: colors.woodDark, textAlign: "center" },
});
```

Create `apps/mobile/screens/register.tsx`:

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { register } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/session";
import { isEmailValid, isPasswordValid } from "@/lib/validation";
import { ApiError } from "@/lib/api/resource";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/text-input";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/constants/theme";

export function RegisterScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/(tabs)";
  const setAuth = useAuthStore((s) => s.setAuth);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!isEmailValid(email)) {
      toast("Adresse e-mail invalide.");
      return;
    }
    if (!isPasswordValid(password)) {
      toast("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (confirm !== password) {
      toast("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const res = await register({
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      setAuth({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user });
      toast("Compte créé.");
      router.replace(next as never);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) toast("Un compte existe déjà avec cet e-mail.");
      else toast(e instanceof Error ? e.message : "Échec de l'inscription.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>CamerMove</Text>
      <Text style={styles.title}>Créer un compte</Text>
      <Field label="Prénom" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
      <Field label="Nom" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
      <Field label="Confirmer le mot de passe" value={confirm} onChangeText={setConfirm} secureTextEntry />
      <Button label={busy ? "Création…" : "Créer mon compte"} onPress={submit} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingTop: 64 },
  eyebrow: { fontSize: 11, fontWeight: "500", letterSpacing: 2.4, textTransform: "uppercase", color: colors.ink2, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: "500", color: colors.ink, marginBottom: 24 },
});
```

- [ ] **Step 3: create thin routes + callback handler**

`apps/mobile/app/login.tsx`:
```tsx
import { Stack } from "expo-router";
import { LoginScreen } from "@/screens/login";

export default function LoginRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Connexion" }} />
      <LoginScreen />
    </>
  );
}
```

`apps/mobile/app/register.tsx`:
```tsx
import { Stack } from "expo-router";
import { RegisterScreen } from "@/screens/register";

export default function RegisterRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Inscription" }} />
      <RegisterScreen />
    </>
  );
}
```

`apps/mobile/app/auth/callback.tsx` (cold-start deep-link return from Google):
```tsx
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth/session";
import { parseGoogleCallbackUrl } from "@/components/auth/google-button";
import { useToast } from "@/components/ui/toast";
import { LoadingState } from "@/components/ui/screen-state";

export default function AuthCallbackRoute() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<Record<string, string>>();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const url = `camermove://auth/callback?${new URLSearchParams(params as Record<string, string>).toString()}`;
    const tokens = parseGoogleCallbackUrl(url);
    if (tokens) {
      setAuth({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.user });
      toast("Connecté avec Google.");
      router.replace("/(tabs)");
    } else {
      toast("Échec de la connexion Google.");
      router.replace("/login");
    }
  }, [params, router, setAuth, toast]);

  return (
    <>
      <Stack.Screen options={{ title: "Connexion Google" }} />
      <LoadingState label="Finalisation de la connexion…" />
    </>
  );
}
```

Register the routes in `app/_layout.tsx` Stack (add inside the existing `<Stack>` alongside `(tabs)`/`modal`/`onboarding`):
```tsx
<Stack.Screen name="login" options={{ headerShown: false }} />
<Stack.Screen name="register" options={{ headerShown: false }} />
<Stack.Screen name="auth/callback" options={{ headerShown: false }} />
```

- [ ] **Step 4: verify**

Run: `pnpm --filter @camermove/mobile typecheck` (0 errors) and `pnpm --filter @camermove/mobile test` (all green, count grows only if you added tests — none required here).

- [ ] **Step 5: commit**

```bash
git add apps/mobile/components/auth/google-button.tsx apps/mobile/screens/login.tsx apps/mobile/screens/register.tsx apps/mobile/app/login.tsx apps/mobile/app/register.tsx apps/mobile/app/auth/callback.tsx apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): auth screens with google entry points"
```

---

### Task S3: tabs restructure + Home (landing/agencies/places ports)

**Files:**
- Create: `apps/mobile/lib/api/landing.ts` (+ test), `lib/api/agencies.ts` (+ test), `lib/api/places.ts` (no test — see below)
- Create: `apps/mobile/screens/home.tsx`
- Modify: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`; create `app/(tabs)/search.tsx`, `app/(tabs)/tickets.tsx`, `app/(tabs)/account.tsx` (tickets/account render placeholder screens now, replaced by S6 — each shows an EmptyState with the correct title so tabs boot cleanly)
- Delete: `app/(tabs)/two.tsx`
- Modify: `app/_layout.tsx` (nothing unless tab routes need registration — tabs are auto-registered; no change expected)

**Interfaces:**
- Consumes: `useSearchStore` (2a), `getDashboard`? (no — S6), Button/EmptyState (S1), theme.
- Produces: 4-tab shell + Home with stats/rails + search widget that writes the store and jumps to the Search tab.

Port pattern (established D1–D3): copy the web module verbatim, drop any Next-only `cache`/`next` options. Read the web sources first:
- `apps/web/lib/api/landing.ts` → port `fetchLandingStats`, `fetchLandingRails` (GET `/api/v1/landing/stats`, GET `/api/v1/landing/rails?...`)
- `apps/web/lib/api/agencies.ts` → port agency list/detail (GET `/api/v1/agencies`, GET `/api/v1/agencies/:slug`)
- `apps/web/lib/api/places.ts` → port autocomplete (GET `/api/v1/places/autocomplete?...`) — no test file (single trivial wrapper; test via Home smoke in S7)

Tests (write for landing + agencies, fetch-mock style asserting URL + method):
- `landing.test.ts`: stats hits `/api/v1/landing/stats` GET; rails passes `type` param.
- `agencies.test.ts`: list hits `/api/v1/agencies` GET; detail hits `/api/v1/agencies/:slug`.

Home screen (`screens/home.tsx`): header eyebrow + title, search widget (origin, destination, date, pax stepper −/+ 1..10, Button "Rechercher" → `router.push("/(tabs)/search")` — the Search tab reads the store), stats row (from `useQuery(["landing","stats"], fetchLandingStats)`), rails FlatList (horizontal, `useQuery(["landing","rails"], () => fetchLandingRails())`), four states each. Keep rails cards minimal (title + CTA text, no images in 2b).

Tab layout (`app/(tabs)/_layout.tsx`): rewrite as

```tsx
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="search" options={{ title: "Recherche" }} />
      <Tabs.Screen name="tickets" options={{ title: "Billets" }} />
      <Tabs.Screen name="account" options={{ title: "Compte" }} />
    </Tabs>
  );
}
```

`app/(tabs)/index.tsx` renders `<HomeScreen/>` (import from `@/screens/home`). `search.tsx`/`tickets.tsx`/`account.tsx` render their S4/S6 screens — S3 creates them rendering a temporary `EmptyState` ("L'écran Recherche arrive…" etc.) so the shell boots; S4/S6 replace the bodies (same files, no route churn).

- [ ] **Steps 1–4:** port modules (tests first), build Home + shell, typecheck + test green.
- [ ] **Step 5: commit** `feat(mobile): tab shell and home screen`

---

### Task S4: search results + trip detail with live seats

**Files:**
- Create: `apps/mobile/lib/api/trips.ts` (+ test: `getTrip` GETs `/api/v1/trips/:id`)
- Create: `apps/mobile/components/search/trip-card.tsx`
- Create: `apps/mobile/screens/search-results.tsx`, `screens/trip-detail.tsx`
- Create route: `apps/mobile/app/trips/[id].tsx`
- Modify: `app/(tabs)/search.tsx` (render real screen), `app/_layout.tsx` (register `trips/[id]`)

**Interfaces:**
- Consumes: `fetchSearch` (D1), `useSearchStore` (2a), `useLiveSeats` + `deriveSeatMap` (S1), `useBookingStore` (2a), `formatXAF/formatTime/formatDate/formatRelative/occupancy` (S1), Button/Field/states (S1).

Trip detail response type (from web `trips/[id]` loader):
```ts
export interface TripDetail {
  id: string; departureAt: string; arrivalEstimateAt: string | null;
  price: number; totalSeats: number; vehicleTypeInfo: string | null; status: string;
  route: { originCity: string; destinationCity: string };
  transport: { companyName: string };
  seatAvailability?: { seatsAvailable: number; seatsHeld: number; seatsBooked: number } | null;
}
export function getTrip(id: string): Promise<TripDetail> {
  return request<TripDetail>(`/api/v1/trips/${id}`, { errorLabel: "trip failed" });
}
```

Search results screen: reads store (`origin/destination/date/pax`), local sort state (`price_asc|price_desc|departure_asc`, default `price_asc`), `useQuery(["search", origin, destination, date, pax, sortBy], () => fetchSearch({...store, sortBy}))`, FlatList of TripCard (`keyboardShouldPersistTaps="handled"`), sort segmented control (3 Pressables), four states (empty → EmptyState "Aucun résultat" + action "Modifier la recherche" jumping to Home tab; error → ErrorState + refetch).

TripCard: company, time/date/relative, price XAF tabular, seats left (`Plus que N` red when 0<N<5, `Complet` when 0), occupancy bar, best-price highlight for first item when `sortBy==="price_asc"`; whole card is a Link/Pressable to `/trips/${id}`.

Trip detail screen: `useLocalSearchParams<{id}>`, `useQuery(["trip", id], () => getTrip(id))`, live seats via `useLiveSeats(id)`, seat grid (rows of 4 from `deriveSeatMap`, Pressable seats, taken disabled, picked → held style), passenger name/phone Fields (validation via `validatePassenger` on continue), bottom Continuer button disabled unless picked + name ≥ 2 + not sold out → `setBooking({tripId, seatCount: 1, passengers:[{fullName: name, phone}]})` + `router.push(`/book/${id}`)`.

- [ ] **Steps:** tests-first for `trips.ts`; build components/screens; typecheck + tests green.
- [ ] **Commit** `feat(mobile): search results and trip detail`

---

### Task S5: booking flow + payment + confirmation

**Files:**
- Create: `apps/mobile/components/booking/payment-step.tsx`
- Create: `apps/mobile/screens/book.tsx`, `screens/confirmation.tsx`
- Create routes: `apps/mobile/app/book/[tripId].tsx`, `app/book/confirmation.tsx`
- Modify: `app/_layout.tsx` (register `book/[tripId]`, `book/confirmation`)

**Interfaces:**
- Consumes: `useBookingStore` (2a), `createBooking/createTripPayment/getBooking` (D2), `validatePassenger` (S1), `formatCountdown/formatXAF` (S1), `getTrip` (S4, for price), `WebBrowser.openAuthSessionAsync` (installed), Button/Field/states/toast (S1).

Book screen: auth guard (`accessToken`; if missing `router.replace(`/login?next=/book/${tripId}`)` + render Login prompt EmptyState); store init when `tripId` changes (reset to 1 seat); trip price via `useQuery(["trip", tripId], getTrip)`; seat-count stepper (1..10, resizes passengers array preserving entries); passenger Fields with inline errors; Recap (total = price × seats, formatXAF); `useMutation(createBooking)` — on success render `PaymentStep` (keep draft per `expo-data-fetching`: disable submit while pending, keep form on error); error map 409 → "Plus de places disponibles", 429 → "Trop de requêtes".

PaymentStep (`{bookingId, amount, onPaid}`): provider radio notchpay/cinetpay, method select mobile_money/card, phone Field (validated only for mobile_money), submit → `createTripPayment(token, bookingId, {provider, method, phone?})` → `url = paymentUrl ?? authorizationUrl` → if url: `await WebBrowser.openAuthSessionAsync(url, "camermove://")`; afterwards (dismiss or return) call `onPaid()` → parent pushes `/book/confirmation?ref=<reference>`.

Confirmation screen: `ref` param required (else missing-reference EmptyState + link to Search); `useQuery(["booking", ref], () => getBooking(ref, token), {enabled: !!token})`; countdown from `booking.holdExpiresAt` (fallback 600s), ticking each second via the pattern from web (`setInterval` 1000ms, `formatCountdown`); shows reference (selectable), seats, total, status; CTAs: "Voir le billet" → `/tickets/lookup?ref=<ref>`, "Mes réservations" → Account tab.

- [ ] **Steps:** build components/screens; typecheck + tests green (no new unit tests required — logic covered by S1/D2 tests; add none).
- [ ] **Commit** `feat(mobile): booking, payment and confirmation flow`

---

### Task S6: tickets tab + account tab + reviews

**Files:**
- Create: `apps/mobile/lib/api/reviews.ts` (+ test: posts review to `/api/v1/reviews` with bearer + idempotency key)
- Create: `apps/mobile/screens/tickets.tsx`, `screens/ticket-detail.tsx`, `screens/lookup.tsx`, `screens/account.tsx`
- Create routes: `apps/mobile/app/tickets/[id].tsx`, `app/tickets/lookup.tsx`
- Modify: `app/(tabs)/tickets.tsx`, `app/(tabs)/account.tsx` (render real screens), `app/_layout.tsx` (register `tickets/[id]`, `tickets/lookup`)

**Interfaces:**
- Consumes: `fetchMyTickets/getTicketDetail/verifyTicket/lookupTicket` (D2/D3), `getDashboard/fetchMyBookings/fetchMyPayments/fetchFavorites/fetchMyNotifications` (D2/D3), `useAuthStore` (D4), expo-image `Image` for `qrDataUrl`, Button/Field/states (S1), theme.

Tickets tab: auth guard (EmptyState + login CTA when logged out); `useQuery(["tickets","me"], ...)` FlatList (verificationCode, origin→destination, date, status); header button "Vérifier un billet" → `/tickets/lookup`; item press → `/tickets/[id]`.

Ticket detail: `useQuery(["ticket", id], () => getTicketDetail(token, id))`; brand header (agency.brandColor, companyName, phone `tel:` via Linking), hero origin→destination + times, QR via `expo-image` (`source={{uri: qrDataUrl}}`, 160×160) or "QR indisponible", verificationCode selectable, passengers list with seat badges, stops with offset-adjusted times, rating form (stars 1–5 Pressables + comment ≤2000 + submit → `createReview` mutation, login required).

Reviews module (`lib/api/reviews.ts`):
```ts
import { request } from "./resource";

export interface CreateReviewInput {
  target: "trip" | "transporter";
  tripId?: string;
  transporterId?: string;
  bookingId: string;
  rating: number;
  punctuality?: number;
  comfort?: number;
  cleanliness?: number;
  service?: number;
  comment?: string;
}

export function createReview(token: string, input: CreateReviewInput): Promise<unknown> {
  return request("/api/v1/reviews", { method: "POST", token, body: input });
}
```
Test asserts POST to `/api/v1/reviews` with bearer + idempotency key + body passthrough.

Lookup screen: public (no guard); ref input prefilled from `?ref=` param; submit → `useQuery(["lookup", ref], () => lookupTicket(ref), {enabled: submitted})`; renders reference/origin/destination/date/status badge (`valid→Valide, used→Utilisé, void→Annulé`) + passenger first name; 404 → "Billet introuvable", 410 → "Ce trajet est expiré".

Account tab: guard (login CTA when logged out); `useQuery(["dashboard"], () => getDashboard(token))` → greeting + totals row (trips/hotels/rentals/parcels/insurance/events) + upcoming trip hero; bookings section (`fetchMyBookings` upcoming/history toggle); payments section (`fetchMyPayments`); logout Button (confirm via double-press pattern: first press arms "Confirmer la déconnexion", second executes `logout()` + `router.replace("/login")`).

- [ ] **Steps:** reviews module tests-first; build screens; typecheck + tests green.
- [ ] **Commit** `feat(mobile): tickets, lookup, rating and account`

---

### Task S7: core-travel verification sweep

**Files:** none (verification only; fix minimally + commit only if a check fails).

- [ ] **Step 1: static checks**

```powershell
pnpm --filter @camermove/mobile typecheck
pnpm --filter @camermove/mobile test
npx expo-doctor   # workdir apps/mobile
```

Expected: 0 errors; all tests pass; no blocking doctor issues (quote warnings + justifications).

- [ ] **Step 2: dead-code scan**

```powershell
rg -n "TODO|FIXME|dead|unused" apps/mobile/app apps/mobile/screens apps/mobile/components apps/mobile/lib --type ts
```

Expected: zero unjustified hits.

- [ ] **Step 3: backend reachability + boot walkthrough**

```powershell
curl.exe -s http://localhost:3000/api/v1/landing/stats
```

Expected: JSON (API running via `docker compose up -d` or local dev; if unreachable, record as environment blocker and verify against whichever host `EXPO_PUBLIC_API_URL` points to).

Walkthrough checklist (Expo Go or `pnpm --filter @camermove/mobile web`, record pass/fail per line — failures become Wave-3/4 backlog, not S7 fixes unless trivial):
1. Cold start → onboarding (fresh install state) → tabs.
2. Search tab shows results for default Yaoundé→Douala query (or honest empty/error state).
3. Trip detail opens, seats render, sold-out state sane.
4. Logged-out booking attempt routes to login with working `next` return.
5. Login with invalid credentials shows the 401 message (no crash).
6. Tickets lookup with a bogus ref shows "Billet introuvable".
7. Google button opens the backend OAuth page or shows the backend-dependency error (record which).

- [ ] **Step 4: report**

Write findings to `.superpowers/sdd/mobile-wave2b-s7-report.md` (no doc commit needed — scratch file). If a fix was required, commit it separately with a `fix(mobile): …` message.

---

## Self-review

- **Spec coverage:** every Wave-2b need tasked — providers/gate (S1), auth incl. Google both paths (S2), tabs + Home (S3), search/detail/live seats (S4), book/pay/confirm (S5), tickets/rating/lookup/account (S6), verification incl. backend handshake (S7). Wave-3 verticals (hotels/rentals/events/parcels/insurance) and motion polish explicitly out.
- **Placeholder scan:** all code blocks complete; S3's three ports follow the established D1–D3 verbatim pattern with named exports, endpoints, and test assertions specified (implementer reads the tiny web sources; no shapes invented).
- **Type consistency:** `AuthUser` reused from D1; `PassengerDraft` shape matches `createBooking` input; `TripDetail` matches web loader fields; `TicketDetailResponse` reused from D3; route params (`next`, `ref`, `id`, `tripId`) consistent across screens.
- **Skills invoked:** `expo-router` (thin routes, no co-location, kebab-case, Stack registration), `expo-native-ui` (FlatList over virtualized lists, ScrollView-first, keyboard taps, inline styles, expo-image, no `@react-navigation` imports), `expo-data-fetching` (four states, SecureStore tokens, hydration gate, draft preservation, query-key discipline). `expo-ui`, `expo-animation`, `micro-interaction`, `expo-design-system` load at Wave-4 polish (native components + motion system) — S-tasks stay on built-ins deliberately to keep this wave shippable.
