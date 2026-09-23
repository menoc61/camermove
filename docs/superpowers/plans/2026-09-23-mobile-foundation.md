# Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate `apps/mobile` into the pnpm monorepo with a tested API client, brand theme, and branded splash + onboarding shell that boots.

**Architecture:** Convert npm→pnpm and rename to `@camermove/mobile`; port the web REST adapter to React Native (dropping Next-only `cache`/`next` options, using `expo-crypto` for idempotency keys); encode the Swiss/Bauhaus tokens from `docs/DESIGN-SYSTEM.md` as TS constants; gate first launch behind an AsyncStorage-backed onboarding route.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, Reanimated 4.5.1, vitest (new), expo-crypto / expo-secure-store / AsyncStorage (new).

## Global Constraints

- Mobile talks to the API only via `REST /api/v1` — never import `@camermove/db`, `@camermove/config` `loadEnv()`, or any `kafkajs`/`ioredis` module.
- Every `POST`/`PUT`/`PATCH` sends an `Idempotency-Key` header (spec §7, AGENTS.md §1).
- Brand: zero radius (`radius = 0`), no gradients, no shadows; ink/paper/wood palette with exact hexes below.
- New native-compatible packages are added with `npx expo install <pkg>`, never raw `npm`/`pnpm add` for expo packages.
- Each task ends with its own verification; commit per task.

---

## File structure (this plan)

- Modify: `apps/mobile/package.json` — rename, scripts, workspace deps.
- Modify: `apps/mobile/app.json` — CamerMove name, `camermove` slug/scheme, `com.camermove.app` identifiers.
- Modify: `apps/mobile/eas.json` — per-channel `EXPO_PUBLIC_API_URL`.
- Create: `apps/mobile/vitest.config.ts` — test runner config.
- Create: `apps/mobile/lib/api/resource.ts` — RN port of the web REST adapter.
- Create: `apps/mobile/lib/api/resource.test.ts` — adapter unit tests.
- Create: `apps/mobile/constants/theme.ts` — brand tokens.
- Create: `apps/mobile/constants/theme.test.ts` — token lock-in tests.
- Create: `apps/mobile/app/onboarding.tsx` — 3-slide carousel.
- Modify: `apps/mobile/app/_layout.tsx` — first-launch gate.

---

### Task 1: pnpm conversion + rename + dependencies + app config

**Files:**
- Modify: `apps/mobile/package.json` (name, scripts)
- Modify: `apps/mobile/app.json` (brand + identifiers)
- Modify: `apps/mobile/eas.json` (channel env)

**Interfaces:**
- Consumes: nothing.
- Produces: package `@camermove/mobile` installable by root `pnpm install`; `EXPO_PUBLIC_API_URL` readable via `process.env` in app code.

- [ ] **Step 1: Remove npm artifacts**

Run:

```powershell
Remove-Item -Recurse -Force "C:\Users\DTA_WorkStation\Documents\camermove\apps\mobile\node_modules"
Remove-Item -Force "C:\Users\DTA_WorkStation\Documents\camermove\apps\mobile\package-lock.json"
```

Expected: both paths gone; `Test-Path` returns False.

- [ ] **Step 2: Rename package + add scripts**

Edit `apps/mobile/package.json`: change `"name": "mobile"` to `"name": "@camermove/mobile"`, and replace the `scripts` block with:

```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "typecheck": "tsc --noEmit",
  "test": "vitest run"
}
```

- [ ] **Step 3: Install runtime deps (SDK-pinned) + workspace/test deps**

Run in `apps/mobile`:

```powershell
npx expo install expo-crypto expo-secure-store expo-auth-session expo-haptics @react-native-async-storage/async-storage
pnpm add zustand zod @tanstack/react-query
pnpm add -D vitest
```

Expected: `pnpm --filter @camermove/mobile list` shows the new deps, no peer warnings that block install.

- [ ] **Step 4: Rebrand `app.json`**

Apply these edits to `apps/mobile/app.json`:

```json
"name": "CamerMove",
"slug": "camermove",
"scheme": "camermove",
```

```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.camermove.app"
},
```

```json
"android": {
  "package": "com.camermove.app",
  "adaptiveIcon": {
```

Keep the existing `extra.eas.projectId: b14510d6-0b45-4794-8ed3-52a4b5d14f9c` untouched.

- [ ] **Step 5: Per-channel API URL in `eas.json`**

Find the machine LAN IP (physical devices cannot reach `localhost`):

```powershell
ipconfig | Select-String "IPv4"
```

Write `apps/mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "http://192.168.1.10:3000"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api-staging.camermove.com"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.camermove.com"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

Replace `192.168.1.10` with the LAN IP from `ipconfig`, and the staging/prod hosts with the real deployed API hosts when known.

- [ ] **Step 6: Verify + commit**

Run at repo root: `pnpm install`. Expected: success, `apps/mobile` resolves.

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/eas.json
git commit -m "feat(mobile): pnpm integration, rebrand, channel env"
```

---

### Task 2: Test runner + typecheck wiring

**Files:**
- Create: `apps/mobile/vitest.config.ts`

**Interfaces:**
- Consumes: Task 1 scripts (`test`, `typecheck`).
- Produces: `pnpm --filter @camermove/mobile test` and `typecheck` commands used by Tasks 3–5.

- [ ] **Step 1: Create vitest config**

Create `apps/mobile/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "constants/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Verify runner starts (no tests yet)**

Run: `pnpm --filter @camermove/mobile test`. Expected: `No test files found` with exit code 1 (proves the runner works; Tasks 3–4 add files).

Run: `pnpm --filter @camermove/mobile typecheck`. Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/vitest.config.ts
git commit -m "feat(mobile): vitest config and typecheck wiring"
```

---

### Task 3: Port REST adapter (`resource.ts`) with tests

**Files:**
- Create: `apps/mobile/lib/api/resource.ts`
- Test: `apps/mobile/lib/api/resource.test.ts`

**Interfaces:**
- Consumes: `EXPO_PUBLIC_API_URL` (Task 1).
- Produces: `request<T>`, `resourceClient<T>`, `buildQuery`, `ApiError`, `PaginatedResponse<T>`, `apiBase()` for all later API modules and stores. Drops the web-only `cache`/`next` options; idempotency keys come from `expo-crypto` (Hermes-safe).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/api/resource.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, buildQuery, request } from "./resource";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("buildQuery", () => {
  it("skips undefined, null, and empty values", () => {
    expect(buildQuery({ origin: "Yaounde", pax: 1, q: "", skip: undefined })).toBe(
      "?origin=Yaounde&pax=1",
    );
  });

  it("serializes arrays as JSON", () => {
    expect(buildQuery({ ids: ["a", "b"] })).toBe("?ids=%5B%22a%22%2C%22b%22%5D");
  });
});

describe("request", () => {
  it("sends Bearer token and Idempotency-Key on POST", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await request("/api/v1/bookings", {
      method: "POST",
      token: "tok123",
      body: { tripId: "t1" },
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("throws ApiError with server message on failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ message: "Trip not found" }),
    });
    await expect(request("/api/v1/trips/x")).rejects.toMatchObject(
      new ApiError(404, "Trip not found"),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/mobile test`. Expected: FAIL with `Failed to resolve import "./resource"`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/mobile/lib/api/resource.ts`:

```ts
/**
 * Typed REST adapter for the mobile app → /api/v1.
 * Port of apps/web/lib/api/resource.ts minus Next.js-only options.
 * Owns the API base URL (one env read), Bearer auth, automatic
 * Idempotency-Key on POST/PUT/PATCH (via expo-crypto, Hermes-safe),
 * query-string building, and uniform ApiError surfacing.
 */
import * as Crypto from "expo-crypto";

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  token?: string | null;
  body?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  errorLabel?: string;
}

export function buildQuery(params: Record<string, unknown> = {}): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

async function parseError(res: Response, path: string, errorLabel?: string): Promise<ApiError> {
  if (errorLabel) return new ApiError(res.status, `${errorLabel}: ${path}`);
  let message = `HTTP ${res.status}`;
  try {
    const text = await res.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) message = parsed.message;
        else message = text;
      } catch {
        message = text;
      }
    }
  } catch {
    // body unreadable — keep generic status message
  }
  return new ApiError(res.status, message);
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    headers["Idempotency-Key"] = opts.idempotencyKey ?? Crypto.randomUUID();
  }
  Object.assign(headers, opts.headers);
  const res = await fetch(`${API_BASE_URL}${path}${buildQuery(opts.params)}`, {
    method,
    headers,
    body,
  });
  if (!res.ok) throw await parseError(res, path, opts.errorLabel);
  try {
    return (await res.json()) as T;
  } catch {
    return undefined as T;
  }
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage?: number;
  totalPages: number;
}

export interface ResourceClient<T> {
  get: <R = T>(path: string, opts?: RequestOptions) => Promise<R>;
  list: <R = T>(path: string, opts?: RequestOptions) => Promise<PaginatedResponse<R>>;
  create: <R = T>(path: string, body: unknown, opts?: RequestOptions) => Promise<R>;
  update: <R = T>(path: string, body: unknown, opts?: RequestOptions) => Promise<R>;
  remove: <R = void>(path: string, opts?: RequestOptions) => Promise<R>;
  request: typeof request;
}

export function resourceClient<T>(basePath: string): ResourceClient<T> {
  const url = (path: string) => `${basePath}${path}`;
  return {
    get: <R>(path: string, opts: RequestOptions = {}) => request<R>(url(path), { ...opts, method: "GET" }),
    list: <R>(path: string, opts: RequestOptions = {}) =>
      request<PaginatedResponse<R>>(url(path), { ...opts, method: "GET" }),
    create: <R>(path: string, body: unknown, opts: RequestOptions = {}) =>
      request<R>(url(path), { ...opts, method: "POST", body }),
    update: <R>(path: string, body: unknown, opts: RequestOptions = {}) =>
      request<R>(url(path), { ...opts, method: "PUT", body }),
    remove: <R>(path: string, opts: RequestOptions = {}) => request<R>(url(path), { ...opts, method: "DELETE" }),
    request,
  };
}

export function apiBase(): string {
  return API_BASE_URL;
}

export async function apiFetch<T>(path: string, init: RequestInit & { token: string }): Promise<T> {
  return request<T>(path, {
    method: init.method as HttpMethod | undefined,
    token: init.token,
    body: init.body,
    headers: init.headers as Record<string, string> | undefined,
  });
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @camermove/mobile test`. Expected: all 4 tests PASS.

Run: `pnpm --filter @camermove/mobile typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/api/resource.ts apps/mobile/lib/api/resource.test.ts
git commit -m "feat(mobile): REST adapter port with idempotency keys"
```

---

### Task 4: Brand theme tokens

**Files:**
- Create: `apps/mobile/constants/theme.ts`
- Test: `apps/mobile/constants/theme.test.ts`

**Interfaces:**
- Consumes: hex values from `docs/DESIGN-SYSTEM.md` §2 (copied verbatim below).
- Produces: `colors`, `radius`, `spacing`, `typography` consumed by onboarding (Task 5) and all Wave 2+ screens.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/constants/theme.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { colors, radius, spacing, typography } from "./theme";

describe("brand tokens", () => {
  it("uses the exact ink/paper/wood palette", () => {
    expect(colors.ink).toBe("#0E0E0E");
    expect(colors.paper).toBe("#F5F4F1");
    expect(colors.wood).toBe("#B89B7B");
    expect(colors.line).toBe("#D8D4CC");
  });

  it("enforces zero radius (Swiss/Bauhaus, no rounded corners)", () => {
    expect(radius).toBe(0);
  });

  it("defines spacing and typography scales", () => {
    expect(spacing.md).toBe(16);
    expect(typography.eyebrow.tracking).toBe(0.22);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/mobile test -- constants/theme`. Expected: FAIL with `Failed to resolve import "./theme"`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/mobile/constants/theme.ts`:

```ts
/** Brand tokens — source of truth is docs/DESIGN-SYSTEM.md §2/§3. */
export const colors = {
  ink: "#0E0E0E",
  ink1: "#2A2A2A",
  ink2: "#6B6B6B",
  paper: "#F5F4F1",
  surface1: "#FFFFFF",
  surface2: "#ECEAE5",
  surface3: "#DCD9D2",
  line: "#D8D4CC",
  wood: "#B89B7B",
  woodDark: "#6F5638",
  woodLight: "#DCC6A8",
  stone: "#8C8A85",
} as const;

export type ColorName = keyof typeof colors;

/** Swiss/Bauhaus: square corners everywhere. */
export const radius = 0;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const typography = {
  eyebrow: { size: 11, weight: "500" as const, tracking: 0.22, uppercase: true },
  display: { size: 40, weight: "500" as const, tracking: -0.035 },
  h2: { size: 28, weight: "500" as const, tracking: -0.025 },
  h3: { size: 22, weight: "500" as const, tracking: -0.02 },
  body: { size: 16, weight: "400" as const, tracking: 0 },
} as const;
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @camermove/mobile test`. Expected: all tests PASS (7 total).

Run: `pnpm --filter @camermove/mobile typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/constants/theme.ts apps/mobile/constants/theme.test.ts
git commit -m "feat(mobile): brand theme tokens"
```

---

### Task 5: Branded splash + onboarding + first-launch gate

**Files:**
- Create: `apps/mobile/app/onboarding.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (gate + route registration)

**Interfaces:**
- Consumes: `colors`/`typography` (Task 4), `expo-router` Stack, `AsyncStorage` key `cm-onboarded`.
- Produces: first launch shows splash → onboarding carousel; returning launches go straight to `(tabs)`; "Commencer" persists the flag and routes to `(tabs)`.

- [ ] **Step 1: Create the onboarding route**

Create `apps/mobile/app/onboarding.tsx`:

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { colors, typography } from "@/constants/theme";

export const ONBOARDED_KEY = "cm-onboarded";

const SLIDES = [
  {
    eyebrow: "01 — Transport",
    title: "Voyagez entre les villes du Cameroun",
    body: "Yaoundé, Douala, Bafoussam et plus — comparez les agences et réservez votre siège.",
  },
  {
    eyebrow: "02 — Services",
    title: "Hôtels, locations, colis et assurance",
    body: "Tous les services CamerMove dans une seule app.",
  },
  {
    eyebrow: "03 — Billets",
    title: "Vos billets QR toujours avec vous",
    body: "Payez par Mobile Money ou carte, présentez votre QR à l'embarquement.",
  },
];

function Dot({ active }: { active: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withSpring(active ? 24 : 8, { damping: 20, stiffness: 300 }),
  }));
  return <Animated.View style={[styles.dot, active && styles.dotActive, style]} />;
}

export default function Onboarding() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  async function finish() {
    await AsyncStorage.setItem(ONBOARDED_KEY, "1");
    router.replace("/(tabs)");
  }

  const slide = SLIDES[index]!;

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>
      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <Dot key={s.eyebrow} active={i === index} />
        ))}
      </View>
      <View style={styles.row}>
        {index > 0 ? (
          <Pressable onPress={() => setIndex(index - 1)} style={styles.ghost}>
            <Text style={styles.ghostLabel}>Retour</Text>
          </Pressable>
        ) : (
          <Pressable onPress={finish} style={styles.ghost}>
            <Text style={styles.ghostLabel}>Passer</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => (last ? void finish() : setIndex(index + 1))}
          style={styles.primary}
        >
          <Text style={styles.primaryLabel}>{last ? "Commencer" : "Suivant"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: "center" },
  eyebrow: {
    fontSize: typography.eyebrow.size,
    fontWeight: typography.eyebrow.weight,
    letterSpacing: typography.eyebrow.size * typography.eyebrow.tracking,
    textTransform: "uppercase",
    color: colors.ink2,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "500",
    letterSpacing: -0.8,
    color: colors.ink,
    marginBottom: 12,
  },
  body: { fontSize: typography.body.size, color: colors.ink1, marginBottom: 32 },
  dots: { flexDirection: "row", gap: 8, marginBottom: 32 },
  dot: { height: 8, width: 8, backgroundColor: colors.surface3 },
  dotActive: { backgroundColor: colors.woodDark },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ghost: { paddingVertical: 14, paddingHorizontal: 8 },
  ghostLabel: { fontSize: 12, fontWeight: "500", letterSpacing: 2.6, color: colors.ink2 },
  primary: { backgroundColor: colors.ink, paddingVertical: 18, paddingHorizontal: 28 },
  primaryLabel: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: colors.paper,
  },
});
```

- [ ] **Step 2: Register route + first-launch gate in root layout**

In `apps/mobile/app/_layout.tsx`, add imports:

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { ONBOARDED_KEY } from "./onboarding";
```

Inside `RootLayoutNav`, before the `return`, add:

```tsx
const router = useRouter();

useEffect(() => {
  AsyncStorage.getItem(ONBOARDED_KEY).then((seen) => {
    if (!seen) router.replace("/onboarding");
  });
}, [router]);
```

And register the route in the Stack:

```tsx
<Stack.Screen name="onboarding" options={{ headerShown: false }} />
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter @camermove/mobile typecheck`. Expected: 0 errors.

Run: `npx expo-doctor` in `apps/mobile`. Expected: no blocking issues (only warnings allowed, each justified in the commit message if any).

Manual: `pnpm --filter @camermove/mobile web` boots; first visit redirects to `/onboarding`, carousel advances, "Commencer" lands on tabs.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/onboarding.tsx apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): onboarding carousel with first-launch gate"
```

---

### Task 6: Foundation verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Full checks**

Run at root:

```powershell
pnpm --filter @camermove/mobile typecheck
pnpm --filter @camermove/mobile test
```

Expected: 0 type errors; all tests pass.

- [ ] **Step 2: Dead-code scan**

Run at root: `rg -n "TODO|FIXME|dead|unused" apps/mobile/app apps/mobile/lib apps/mobile/constants --type ts`. Expected: zero hits, or each hit justified in the final summary.

---

## Self-review

- **Spec coverage:** §3 linkage → Task 1 (+ Task 2 runner wiring); §4 adapter → Task 3; §6 splash/onboarding shell → Task 5; brand tokens (DESIGN-SYSTEM §2/§3) → Task 4; §9 foundation verification → Task 6. Stores, Google auth, and traveler API modules are explicitly Wave 2 (next plan). Splash-screen plugin config ships with the template (`expo-splash-screen` + `preventAutoHideAsync` in `_layout.tsx`) — no task needed.
- **Placeholder scan:** no TBD/TODO; LAN IP step includes discovery command; staging/prod hosts flagged as replace-when-known.
- **Type consistency:** `RequestOptions.params` is `Record<string, unknown>` in both test and implementation; `PaginatedResponse`/`ResourceClient` signatures match the web original minus Next fields; `ONBOARDED_KEY` exported once and imported by the layout.
