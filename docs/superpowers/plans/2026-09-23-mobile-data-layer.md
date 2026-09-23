# Mobile Data Layer Implementation Plan (Wave 2a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the mobile app a fully tested backend-connected data layer: traveler API modules, SecureStore-backed auth session, search/booking stores, and a React Query client.

**Architecture:** Port `apps/web/lib/api/*.ts` modules one-to-one (dropping the Next-only `cache` option, which does not exist in the mobile `RequestOptions`); port the three zustand stores with an `expo-secure-store` persist adapter for auth (per `expo-data-fetching`: SecureStore for tokens, never AsyncStorage) and plain in-memory stores for search/booking; centralize the QueryClient with web-parity defaults.

**Tech Stack:** Expo SDK 57, zustand 5 (+ persist middleware), expo-secure-store, @tanstack/react-query 5, vitest.

## Global Constraints

- Mobile talks to the API only via `REST /api/v1` through `lib/api/resource.ts` (`request` / `resourceClient`) — no direct fetch-URL construction elsewhere, no db/config/kafka imports.
- Every `POST`/`PUT`/`PATCH` sends `Idempotency-Key` (handled by `resource.ts`; tests assert its presence on writes).
- Tokens live in SecureStore only. Non-sensitive prefs may use AsyncStorage (not this plan).
- No `crypto.randomUUID`, no `Buffer`, no `atob` assumptions — Hermes-safe code only (manual base64 decode for JWT expiry).
- Each task ends with its own verification (`pnpm --filter @camermove/mobile test` green for its files + `typecheck` clean); commit per task with the exact message given.

---

## File structure (this plan)

- Create: `apps/mobile/lib/api/auth.ts`, `search.ts`, `bookings.ts`, `payments.ts`, `tickets.ts`, `dashboard.ts`, `favorites.ts`, `notifications.ts` (+ matching `*.test.ts` for each)
- Create: `apps/mobile/lib/auth/session.ts` (+ `session.test.ts`)
- Create: `apps/mobile/lib/stores/search.ts` (+ test), `apps/mobile/lib/stores/booking.ts` (+ test)
- Create: `apps/mobile/lib/query/client.ts` (+ `client.test.ts`)

Web sources (exact semantics to match): `apps/web/lib/api/auth.ts|search.ts|bookings.ts|payments.ts|tickets.ts|dashboard.ts|favorites.ts|notifications.ts`, `packages/frontend/src/useAuthStore.ts|useSearchStore.ts|useBookingStore.ts`.

---

### Task D1: auth + search API modules

**Files:**
- Create: `apps/mobile/lib/api/auth.ts`, `apps/mobile/lib/api/auth.test.ts`
- Create: `apps/mobile/lib/api/search.ts`, `apps/mobile/lib/api/search.test.ts`

**Interfaces:**
- Consumes: `request` from `../resource` (F3).
- Produces: `login`, `register`, `refreshAccessToken`, `logout`, `AuthUser`, `AuthResponse`, `fetchSearch`, `SearchParams`, `SearchResultItem` for D4 and Wave 2b screens.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/lib/api/auth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "./auth";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("auth api", () => {
  it("login posts credentials to /api/v1/auth/login with idempotency key", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await login("a@b.cm", "secret123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.cm", password: "secret123" });
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

Create `apps/mobile/lib/api/search.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSearch } from "./search";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("search api", () => {
  it("builds the search query with defaults", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await fetchSearch({ origin: "Yaounde", destination: "Douala", date: "2026-10-01", pax: 2 });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(init.method).toBe("GET");
    expect(url).toContain("/api/v1/search?");
    expect(url).toContain("origin=Yaounde");
    expect(url).toContain("destination=Douala");
    expect(url).toContain("date=2026-10-01");
    expect(url).toContain("pax=2");
    expect(url).toContain("sortBy=price_asc");
    expect(url).toContain("page=1");
    expect(url).toContain("perPage=20");
    expect(init.headers.Authorization).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @camermove/mobile test -- lib/api/auth lib/api/search`. Expected: FAIL, cannot find `./auth` and `./search`.

- [ ] **Step 3: Write minimal implementations**

Create `apps/mobile/lib/api/auth.ts` (verbatim port of the web module):

```ts
import { request } from "./resource";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

function authPost(path: string, body: unknown): Promise<AuthResponse> {
  return request<AuthResponse>(path, { method: "POST", body });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return authPost("/api/v1/auth/login", { email, password });
}

export function register(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<AuthResponse> {
  return authPost("/api/v1/auth/register", input);
}

export function refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
  return authPost("/api/v1/auth/refresh", { refreshToken });
}

export function logout(accessToken: string, refreshToken?: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/v1/auth/logout", {
    method: "POST",
    token: accessToken,
    body: refreshToken ? { refreshToken } : {},
  });
}
```

Create `apps/mobile/lib/api/search.ts` (verbatim port minus the Next-only `cache` option):

```ts
import { request } from "./resource";

export interface SearchResultItem {
  id: string;
  departureAt: string;
  price: number;
  totalSeats: number;
  seatsAvailable: number;
  transporterId: string;
  companyName: string;
  vehicleTypeInfo: string | null;
}

export interface SearchParams {
  origin: string;
  destination: string;
  date: string;
  pax: number;
  sortBy?: "price_asc" | "price_desc" | "departure_asc";
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  perPage?: number;
  vehicleType?: string;
}

export function fetchSearch(params: SearchParams): Promise<{ items: SearchResultItem[]; total: number; page: number; perPage: number; totalPages: number; meta?: Record<string, unknown> }> {
  return request("/api/v1/search", {
    errorLabel: "search failed",
    params: {
      origin: params.origin,
      destination: params.destination,
      date: params.date,
      pax: params.pax,
      sortBy: params.sortBy ?? "price_asc",
      page: params.page ?? 1,
      perPage: params.perPage ?? 20,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      vehicleType: params.vehicleType,
    },
  });
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @camermove/mobile test`. Expected: all tests PASS (previous 7 + new 2 = 9).
Run: `pnpm --filter @camermove/mobile typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/api/auth.ts apps/mobile/lib/api/auth.test.ts apps/mobile/lib/api/search.ts apps/mobile/lib/api/search.test.ts
git commit -m "feat(mobile): auth and search api modules"
```

---

### Task D2: bookings + payments API modules

**Files:**
- Create: `apps/mobile/lib/api/bookings.ts`, `apps/mobile/lib/api/bookings.test.ts`
- Create: `apps/mobile/lib/api/payments.ts`, `apps/mobile/lib/api/payments.test.ts`

**Interfaces:**
- Consumes: `request`, `resourceClient` from `../resource` (F3).
- Produces: booking/ticket-list/payment functions + DTOs for Wave 2b booking flow and tickets tab.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/lib/api/bookings.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelBooking, createBooking } from "./bookings";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("bookings api", () => {
  it("createBooking posts trip, seats and passengers with bearer token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await createBooking(
      { tripId: "t1", seatCount: 2, passengers: [{ fullName: "A B" }, { fullName: "C D", phone: "690000000" }] },
      "tok123",
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/bookings");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init.body)).toEqual({
      tripId: "t1",
      seatCount: 2,
      passengers: [{ fullName: "A B" }, { fullName: "C D", phone: "690000000" }],
    });
  });

  it("cancelBooking posts to the booking cancel endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await cancelBooking("b1", "tok123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/bookings/b1/cancel");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });
});
```

Create `apps/mobile/lib/api/payments.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTripPayment } from "./bookings";
import { fetchMyPayments } from "./payments";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("payments api", () => {
  it("createTripPayment posts booking, provider and phone with bearer token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await createTripPayment("tok123", "b1", { provider: "notchpay", phone: "690000000" });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/payments");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(JSON.parse(init.body)).toEqual({ bookingId: "b1", provider: "notchpay", phone: "690000000" });
  });

  it("fetchMyPayments lists owner payments with bearer token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await fetchMyPayments("tok123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/payments");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @camermove/mobile test -- lib/api/bookings lib/api/payments`. Expected: FAIL, cannot find modules.

- [ ] **Step 3: Write minimal implementations**

Create `apps/mobile/lib/api/bookings.ts` (verbatim port of the web module):

```ts
import { request } from "./resource";

export type BookingResponse = { booking: { id: string; reference: string; holdExpiresAt: string; totalAmount: number; status: string }; totalAmount: number; holdExpiresAt: string };

export interface MyBookingItem {
  id: string;
  reference: string;
  origin: string;
  destination: string;
  departureAt: string;
  totalAmount: number;
  status: string;
  ticketId: string | null;
}

export interface MyBookingsResponse {
  items: MyBookingItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface MyTicketItem {
  id: string;
  verificationCode: string;
  origin: string;
  destination: string;
  departureAt: string;
  status: string;
}

export interface MyTicketsResponse {
  items: MyTicketItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface MyBookingsParams {
  page?: number;
  perPage?: number;
  scope?: "upcoming" | "history" | "all";
}

export interface MyTicketsParams {
  page?: number;
  perPage?: number;
}

export function fetchMyBookings(token: string, params: MyBookingsParams = {}): Promise<MyBookingsResponse> {
  return request<MyBookingsResponse>("/api/v1/me/bookings", {
    token,
    params: { page: params.page, perPage: params.perPage, scope: params.scope },
  });
}

export function fetchMyTickets(token: string, params: MyTicketsParams = {}): Promise<MyTicketsResponse> {
  return request<MyTicketsResponse>("/api/v1/tickets/me", {
    token,
    params: { page: params.page, perPage: params.perPage },
  });
}

export function createBooking(input: { tripId: string; seatCount: number; passengers: Array<{ fullName: string; phone?: string }> }, token: string): Promise<BookingResponse> {
  return request<BookingResponse>("/api/v1/bookings", { method: "POST", token, body: input });
}

export type TripPaymentResult = {
  payment: { id: string };
  authorizationUrl: string | null;
  paymentUrl: string | null;
};

export function createTripPayment(
  token: string,
  bookingId: string,
  opts: { provider: "notchpay" | "cinetpay"; method?: string; phone?: string; email?: string },
): Promise<TripPaymentResult> {
  return request<TripPaymentResult>("/api/v1/payments", {
    method: "POST",
    token,
    body: { bookingId, provider: opts.provider, method: opts.method, phone: opts.phone, email: opts.email },
  });
}

export function getBooking(id: string, token: string): Promise<unknown> {
  return request(`/api/v1/bookings/${id}`, { token });
}

export function cancelBooking(id: string, token: string): Promise<unknown> {
  return request(`/api/v1/bookings/${id}/cancel`, { method: "POST", token });
}

export function bulkCancelBookings(ids: string[], token: string): Promise<{ affected: number }> {
  return request<{ affected: number }>("/api/v1/bookings/bulk/cancel", { method: "POST", token, body: { ids } });
}
```

Create `apps/mobile/lib/api/payments.ts` (verbatim port of the web module):

```ts
import { resourceClient } from "./resource";

const payments = resourceClient("/api/v1/payments");

export interface MyPaymentItem {
  id: string;
  provider: string;
  providerRef: string | null;
  amount: number;
  method: string | null;
  currency: string;
  status: string;
  createdAt: string;
  bookingId: string;
}

export interface MyPaymentsResponse {
  items: MyPaymentItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function fetchMyPayments(token: string, params: Record<string, string> = {}): Promise<MyPaymentsResponse> {
  return payments.list("", { token, params }) as Promise<MyPaymentsResponse>;
}
```

Note: `payments.list("", ...)` builds the URL as `basePath + ""`. Keep the base path in one place: `resourceClient("/api/v1/payments")` then `payments.list("", { token, params })`. (The `.slice(...)` construction above is only illustrative — write the plain `payments.list("", ...)` form.)

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @camermove/mobile test`. Expected: all PASS (9 + 4 = 13).
Run: `pnpm --filter @camermove/mobile typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/api/bookings.ts apps/mobile/lib/api/bookings.test.ts apps/mobile/lib/api/payments.ts apps/mobile/lib/api/payments.test.ts
git commit -m "feat(mobile): bookings and payments api modules"
```

---

### Task D3: tickets + dashboard + favorites + notifications API modules

**Files:**
- Create: `apps/mobile/lib/api/tickets.ts`, `apps/mobile/lib/api/tickets.test.ts`
- Create: `apps/mobile/lib/api/dashboard.ts`, `apps/mobile/lib/api/dashboard.test.ts`
- Create: `apps/mobile/lib/api/favorites.ts`, `apps/mobile/lib/api/favorites.test.ts`
- Create: `apps/mobile/lib/api/notifications.ts`, `apps/mobile/lib/api/notifications.test.ts`

**Interfaces:**
- Consumes: `request`, `resourceClient` from `../resource`.
- Produces: ticket detail/verify/lookup, dashboard, favorites, notification functions for Wave 2b tickets/account screens and Wave 3 verticals.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/lib/api/tickets.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTicketDetail, lookupTicket, verifyTicket } from "./tickets";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("tickets api", () => {
  it("getTicketDetail gets the ticket with bearer token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "t1" }) });
    await getTicketDetail("tok123", "t1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/me/tickets/t1");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("verifyTicket posts the code with bearer token and idempotency key", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await verifyTicket("tok123", "CM-ABC123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/tickets/verify");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ code: "CM-ABC123" });
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("lookupTicket is public (no token) with ref query", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await lookupTicket("CM-ABC123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/tickets/lookup?ref=CM-ABC123");
    expect(init.headers.Authorization).toBeUndefined();
  });
});
```

Create `apps/mobile/lib/api/dashboard.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboard } from "./dashboard";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("dashboard api", () => {
  it("getDashboard calls the dashboard endpoint with bearer token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ upcoming: [] }) });
    await getDashboard("tok123");
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/me/dashboard");
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });
});
```

Create `apps/mobile/lib/api/favorites.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFavorite, removeFavorite } from "./favorites";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("favorites api", () => {
  it("addFavorite posts kind and entityId", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await addFavorite("tok123", "hotel", "h1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("http://localhost:3000/api/v1/favorites");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ kind: "hotel", entityId: "h1" });
  });

  it("removeFavorite deletes by id", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await removeFavorite("tok123", "f1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(url).toBe("http://localhost:3000/api/v1/favorites/f1");
    expect(init.method).toBe("DELETE");
  });
});
```

Create `apps/mobile/lib/api/notifications.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { markNotificationRead } from "./notifications";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("notifications api", () => {
  it("markNotificationRead patches the read endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await markNotificationRead("tok123", "n1");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toBe("http://localhost:3000/api/v1/me/notifications/n1/read");
    expect(init.method).toBe("PATCH");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @camermove/mobile test -- lib/api/tickets lib/api/dashboard lib/api/favorites lib/api/notifications`. Expected: FAIL, modules missing.

- [ ] **Step 3: Write minimal implementations**

Create `apps/mobile/lib/api/tickets.ts` (types verbatim from the web module, plus the three functions the mobile screens need — endpoint paths confirmed against `apps/api` route table: `GET /api/v1/me/tickets/:id`, `POST /api/v1/tickets/verify {code}`, `GET /api/v1/tickets/lookup?ref=`):

```ts
import { request } from "./resource";

export interface TicketDetailResponse {
  id: string;
  reference: string;
  verificationCode: string;
  qrDataUrl: string;
  status: string;
  trip: {
    origin: string;
    destination: string;
    departureAt: string;
    arrivalAt: string | null;
    vehiclePlate: string | null;
    seatCount: number;
    vehicleTypeInfo: string | null;
  };
  passengers: Array<{ firstName: string; lastName: string; seatNumber: string }>;
  agency: {
    companyName: string;
    brandColor: string;
    accentIcon: string;
    phone: string | null;
    tagline: string | null;
  };
  boardingStop: { name: string; offsetMinutes: number } | null;
  dropOffStop: { name: string; offsetMinutes: number } | null;
  seatLabels: string[];
  ratingContext: {
    tripId: string;
    transporterId: string;
    bookingId: string;
  };
}

export function getTicketDetail(token: string, id: string): Promise<TicketDetailResponse> {
  return request<TicketDetailResponse>(`/api/v1/me/tickets/${id}`, { token });
}

export function verifyTicket(token: string, code: string): Promise<unknown> {
  return request("/api/v1/tickets/verify", { method: "POST", token, body: { code } });
}

export function lookupTicket(ref: string): Promise<unknown> {
  return request("/api/v1/tickets/lookup", { params: { ref } });
}
```

Create `apps/mobile/lib/api/dashboard.ts` (verbatim port of the web module):

```ts
import { request } from "./resource";

export interface DashboardItem {
  id: string;
  reference: string;
  origin: string;
  destination: string;
  departureAt: string;
  totalAmount: number;
  status: string;
  ticketId: string | null;
}

export interface DashboardTicketItem {
  id: string;
  verificationCode: string;
  origin: string;
  destination: string;
  departureAt: string;
  status: string;
}

export interface DashboardTotals {
  trips: number;
  hotels: number;
  rentals: number;
  parcels: number;
  insurance: number;
  events: number;
}

export interface DashboardResponse {
  upcoming: DashboardItem[];
  history: DashboardItem[];
  tickets: DashboardTicketItem[];
  totals?: DashboardTotals;
}

export function getDashboard(token: string): Promise<DashboardResponse> {
  return request<DashboardResponse>("/api/v1/me/dashboard", { method: "GET", token });
}
```

Create `apps/mobile/lib/api/favorites.ts` (verbatim port of the web module):

```ts
import { request, resourceClient } from "./resource";

const favorites = resourceClient("/api/v1/favorites");

export type FavoriteKind = "hotel" | "rental" | "event";

export interface Favorite {
  id: string;
  userId: string;
  kind: FavoriteKind;
  entityId: string;
  createdAt: string;
}

export interface FavoritesResponse {
  items: Favorite[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function fetchFavorites(token: string, page = 1, perPage = 20) {
  return favorites.list("", { token, params: { page, perPage } }) as Promise<FavoritesResponse>;
}

export function addFavorite(token: string, kind: FavoriteKind, entityId: string) {
  return favorites.create("", { kind, entityId }, { token });
}

export function removeFavorite(token: string, id: string) {
  return favorites.remove(`/${id}`, { token });
}
```

Create `apps/mobile/lib/api/notifications.ts` (verbatim port of the web module):

```ts
import { resourceClient } from "./resource";

const notifications = resourceClient("/api/v1/me/notifications");

export interface MyNotification {
  id: string;
  channel: string;
  type: string;
  status: string;
  payload: Record<string, unknown> | null;
  sentAt: string | null;
  createdAt: string;
  read: boolean;
}

export interface MyNotificationsResponse {
  items: MyNotification[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export function fetchMyNotifications(token: string, params: Record<string, string> = {}): Promise<MyNotificationsResponse> {
  return notifications.list("", { token, params }) as Promise<MyNotificationsResponse>;
}

export function markNotificationRead(token: string, id: string): Promise<MyNotification> {
  return notifications.request<MyNotification>(`/api/v1/me/notifications/${id}/read`, { method: "PATCH", token });
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @camermove/mobile test`. Expected: all PASS (13 + 7 = 20).
Run: `pnpm --filter @camermove/mobile typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/api/tickets.ts apps/mobile/lib/api/tickets.test.ts apps/mobile/lib/api/dashboard.ts apps/mobile/lib/api/dashboard.test.ts apps/mobile/lib/api/favorites.ts apps/mobile/lib/api/favorites.test.ts apps/mobile/lib/api/notifications.ts apps/mobile/lib/api/notifications.test.ts
git commit -m "feat(mobile): tickets, dashboard, favorites, notifications api modules"
```

---

### Task D4: SecureStore-backed auth session store

**Files:**
- Create: `apps/mobile/lib/auth/session.ts`
- Test: `apps/mobile/lib/auth/session.test.ts`

**Interfaces:**
- Consumes: `login`-family types from `../api/auth`, `apiBase` from `../api/resource`.
- Produces: `useAuthStore` (`user/accessToken/refreshToken`, `setAuth/clearAuth/isAccessTokenExpired/refreshIfNeeded/logout`), `hydrateAuth()` for the root-layout gate (Wave 2b). Same semantics as `packages/frontend/src/useAuthStore.ts`, except persistence goes to SecureStore (async) instead of localStorage, the base URL comes from `apiBase()`, and JWT expiry uses a Hermes-safe manual base64 decoder (no `atob`/`Buffer`).

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/auth/session.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => {
  const mem = new Map<string, string>();
  return {
    getItemAsync: vi.fn(async (k: string) => (mem.has(k) ? mem.get(k)! : null)),
    setItemAsync: vi.fn(async (k: string, v: string) => void mem.set(k, v)),
    deleteItemAsync: vi.fn(async (k: string) => void mem.delete(k)),
    __mem: mem,
  };
});

const fetchMock = vi.fn();

function jwtWithExp(expSeconds: number): string {
  const b64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64url({ alg: "none" })}.${b64url({ exp: expSeconds })}.sig`;
}

describe("auth session", () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    const { useAuthStore } = await import("./session");
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
  });

  it("setAuth stores tokens and reports non-expired access token", async () => {
    const { useAuthStore } = await import("./session");
    const exp = Math.floor(Date.now() / 1000) + 600;
    useAuthStore.getState().setAuth({
      accessToken: jwtWithExp(exp),
      refreshToken: "r1",
      user: { id: "u1", email: "a@b.cm", role: "traveler" },
    });
    expect(useAuthStore.getState().isAccessTokenExpired()).toBe(false);
  });

  it("reports missing token as expired", async () => {
    const { useAuthStore } = await import("./session");
    expect(useAuthStore.getState().isAccessTokenExpired()).toBe(true);
  });

  it("refreshIfNeeded refreshes an expired token and keeps working state on network error", async () => {
    const { useAuthStore } = await import("./session");
    const expired = Math.floor(Date.now() / 1000) - 60;
    const fresh = Math.floor(Date.now() / 1000) + 600;
    useAuthStore.getState().setAuth({
      accessToken: jwtWithExp(expired),
      refreshToken: "r1",
      user: { id: "u1", email: "a@b.cm", role: "traveler" },
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: jwtWithExp(fresh), refreshToken: "r2", user: { id: "u1", email: "a@b.cm", role: "traveler" } }),
    });
    expect(await useAuthStore.getState().refreshIfNeeded()).toBe(true);
    expect(useAuthStore.getState().isAccessTokenExpired()).toBe(false);

    useAuthStore.getState().setAuth({
      accessToken: jwtWithExp(expired),
      refreshToken: "r1",
      user: { id: "u1", email: "a@b.cm", role: "traveler" },
    });
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await useAuthStore.getState().refreshIfNeeded()).toBe(false);
    expect(useAuthStore.getState().accessToken).not.toBeNull();
  });

  it("logout clears the store even when the server call fails", async () => {
    const { useAuthStore } = await import("./session");
    useAuthStore.getState().setAuth({
      accessToken: jwtWithExp(Math.floor(Date.now() / 1000) + 600),
      refreshToken: "r1",
      user: { id: "u1", email: "a@b.cm", role: "traveler" },
    });
    fetchMock.mockRejectedValue(new Error("offline"));
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/mobile test -- lib/auth/session`. Expected: FAIL, cannot find `./session`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/mobile/lib/auth/session.ts`:

```ts
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { refreshAccessToken } from "../api/auth";
import type { AuthUser } from "../api/auth";
import { apiBase } from "../api/resource";

const AUTH_STORAGE_KEY = "cm-auth";

const secureStorage: StateStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const B64CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Hermes-safe base64url decode (no atob/Buffer). Returns null on any failure. */
function decodeJwtExpMs(token: string): number | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const bytes: number[] = [];
    let bits = 0;
    let bitCount = 0;
    for (const ch of normalized) {
      if (ch === "=") break;
      const v = B64CHARS.indexOf(ch);
      if (v < 0) return null;
      bits = (bits << 6) | v;
      bitCount += 6;
      if (bitCount >= 8) {
        bitCount -= 8;
        bytes.push((bits >> bitCount) & 0xff);
      }
    }
    let json = "";
    for (const b of bytes) json += String.fromCharCode(b);
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (a: { accessToken: string; refreshToken?: string | null; user: AuthUser }) => void;
  clearAuth: () => void;
  isAccessTokenExpired: (skewSeconds?: number) => boolean;
  refreshIfNeeded: (opts?: { skewSeconds?: number }) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, user, refreshToken: refreshToken ?? null }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
      isAccessTokenExpired: (skewSeconds = 30) => {
        const { accessToken } = get();
        if (!accessToken) return true;
        const exp = decodeJwtExpMs(accessToken);
        if (exp === null) return false;
        return Date.now() >= exp - skewSeconds * 1000;
      },
      refreshIfNeeded: async (opts) => {
        const { accessToken, refreshToken, user } = get();
        if (!accessToken || !refreshToken) return false;
        if (!get().isAccessTokenExpired(opts?.skewSeconds)) return true;
        try {
          const data = await refreshAccessToken(refreshToken);
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user ?? user });
          return true;
        } catch (err) {
          if (err instanceof Error && (err as { status?: number }).status === 401) get().clearAuth();
          return false;
        }
      },
      logout: async () => {
        const { accessToken, refreshToken } = get();
        try {
          if (accessToken) {
            await fetch(`${apiBase()}/api/v1/auth/logout`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(refreshToken ? { refreshToken } : {}),
            });
          }
        } catch {
          // best-effort: store is cleared regardless
        } finally {
          get().clearAuth();
        }
      },
    }),
    { name: AUTH_STORAGE_KEY, storage: createJSONStorage(() => secureStorage) },
  ),
);

/** Await SecureStore rehydration before gating UI on auth state (root layout). */
export function hydrateAuth(): Promise<void> {
  return useAuthStore.persist.rehydrate();
}
```

Note: `refreshAccessToken` throws `ApiError` (which carries `.status`) on HTTP
failures, so a 401 clears the store while network errors keep existing state —
same semantics as `packages/frontend/src/useAuthStore.ts`.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @camermove/mobile test`. Expected: all PASS (20 + 4 = 24).
Run: `pnpm --filter @camermove/mobile typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/auth/session.ts apps/mobile/lib/auth/session.test.ts
git commit -m "feat(mobile): securestore-backed auth session store"
```

---

### Task D5: search/booking stores + query client

**Files:**
- Create: `apps/mobile/lib/stores/search.ts`, `apps/mobile/lib/stores/search.test.ts`
- Create: `apps/mobile/lib/stores/booking.ts`, `apps/mobile/lib/stores/booking.test.ts`
- Create: `apps/mobile/lib/query/client.ts`, `apps/mobile/lib/query/client.test.ts`

**Interfaces:**
- Consumes: zustand (plain, no persist — same as web), `@tanstack/react-query`.
- Produces: `useSearchStore`, `useBookingStore`, `queryClient` (stale 30s, gc 5m, retry 1, no refocus) for Wave 2b screens. `QueryClientProvider` wiring happens in Wave 2b's layout task.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/lib/stores/search.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { useSearchStore } from "./search";

describe("search store", () => {
  it("defaults to Yaounde -> Douala, tomorrow, 1 pax", () => {
    useSearchStore.getState().reset();
    const s = useSearchStore.getState();
    expect(s.origin).toBe("Yaoundé");
    expect(s.destination).toBe("Douala");
    expect(s.pax).toBe(1);
    expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("setSearch merges partial updates", () => {
    useSearchStore.getState().reset();
    useSearchStore.getState().setSearch({ pax: 3, origin: "Bafoussam" });
    const s = useSearchStore.getState();
    expect(s.pax).toBe(3);
    expect(s.origin).toBe("Bafoussam");
    expect(s.destination).toBe("Douala");
  });
});
```

Create `apps/mobile/lib/stores/booking.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { useBookingStore } from "./booking";

describe("booking store", () => {
  it("defaults to empty draft with one passenger row", () => {
    useBookingStore.getState().reset();
    const s = useBookingStore.getState();
    expect(s.tripId).toBeNull();
    expect(s.seatCount).toBe(1);
    expect(s.passengers).toEqual([{ fullName: "" }]);
  });

  it("setBooking replaces trip and passengers", () => {
    useBookingStore.getState().reset();
    useBookingStore.getState().setBooking({
      tripId: "t1",
      seatCount: 2,
      passengers: [{ fullName: "A B" }, { fullName: "C D" }],
    });
    const s = useBookingStore.getState();
    expect(s.tripId).toBe("t1");
    expect(s.passengers).toHaveLength(2);
  });
});
```

Create `apps/mobile/lib/query/client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { queryClient } from "./client";

describe("query client", () => {
  it("uses web-parity defaults", () => {
    const defaults = queryClient.getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(30_000);
    expect(defaults?.gcTime).toBe(5 * 60_000);
    expect(defaults?.retry).toBe(1);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @camermove/mobile test -- lib/stores lib/query`. Expected: FAIL, modules missing.

- [ ] **Step 3: Write minimal implementations**

Create `apps/mobile/lib/stores/search.ts` (verbatim port of `useSearchStore.ts`):

```ts
import { create } from "zustand";

interface SearchState {
  origin: string;
  destination: string;
  date: string;
  pax: number;
  setSearch: (s: Partial<Omit<SearchState, "setSearch" | "reset">>) => void;
  reset: () => void;
}

function tomorrow(): string {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

export const useSearchStore = create<SearchState>((set) => ({
  origin: "Yaoundé",
  destination: "Douala",
  date: tomorrow(),
  pax: 1,
  setSearch: (s) => set(s),
  reset: () => set({ origin: "Yaoundé", destination: "Douala", date: tomorrow(), pax: 1 }),
}));
```

Create `apps/mobile/lib/stores/booking.ts` (verbatim port of `useBookingStore.ts`):

```ts
import { create } from "zustand";

export interface PassengerDraft {
  fullName: string;
  phone?: string;
}

interface BookingState {
  tripId: string | null;
  seatCount: number;
  passengers: PassengerDraft[];
  setBooking: (s: Partial<Pick<BookingState, "tripId" | "seatCount" | "passengers">>) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  tripId: null,
  seatCount: 1,
  passengers: [{ fullName: "" }],
  setBooking: (s) => set(s),
  reset: () => set({ tripId: null, seatCount: 1, passengers: [{ fullName: "" }] }),
}));
```

Create `apps/mobile/lib/query/client.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @camermove/mobile test`. Expected: all PASS (24 + 5 = 29).
Run: `pnpm --filter @camermove/mobile typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/stores/search.ts apps/mobile/lib/stores/search.test.ts apps/mobile/lib/stores/booking.ts apps/mobile/lib/stores/booking.test.ts apps/mobile/lib/query/client.ts apps/mobile/lib/query/client.test.ts
git commit -m "feat(mobile): search and booking stores plus query client"
```

---

## Self-review

- **Spec coverage:** every Wave-2a need is tasked — API modules (D1–D3, all traveler endpoints incl. ticket verify/lookup additions), auth session with SecureStore + Hermes-safe JWT (D4), search/booking stores + QueryClient (D5). Screens, QueryClientProvider wiring, and Google auth-session belong to Plan 2b.
- **Placeholder scan:** all code blocks complete; endpoint paths verified against the `apps/api` route table (`/api/v1/me/tickets/:id`, `/tickets/verify`, `/tickets/lookup?ref=`); no TBD/TODO.
- **Type consistency:** `AuthUser` defined once in `api/auth.ts`, imported by `session.ts`; `RequestOptions.params` is `Record<string, unknown>` everywhere; envelope types match web originals field-for-field.
- **Deviations from web, all justified:** dropped Next-only `cache` option; `params` typed tighter; JWT decode without `atob`/`Buffer`; auth persist via SecureStore adapter; `tickets.ts` gains the three functions the web keeps in page components.
