# Plan 2 — Launch Surface & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CamerMove launchable and self-testable on one command, honest in production behavior (no fake successes/fabricated actors), with an SEO-friendly French landing page and a separated, hidden admin surface.

**Architecture:** Four parts shipped as vertical slices: (A) prod-integrity fixes from the mock-data audit [F1/F5 notification channels throw when unconfigured; F2 single migrated service principal replaces fabricated user upserts; F3 no invented API_URL]; (B) `scripts/dev-up.ps1` one-command launch + LAUNCH.md; (C) landing redesign + full SEO (metadata/OG/sitemap/robots.ts hiding /admin, JSON-LD); (D) missing traveler `/login` + `/register` pages, dedicated `/admin/login`, middleware admin branch, `/admin` shell backed by new `GET /api/v1/me/profile`.

**Tech Stack:** Fastify/Zod, Prisma migrate, PowerShell launch script, Next.js 16 Metadata API, Tailwind 4, Vitest.

## Global Constraints

- AGENTS.md contract: Zod every endpoint; requireAuth enforcement API-side (middleware is UX gate only); French UI copy; no dead code; explicit-path staging; never stage `.env`.
- Files ≤200 lines; follow existing component/module patterns.
- Zero behavior regressions: all existing suites keep passing; smoke suites green after every task.
- Windows PowerShell 5.1 environment; web dev port 3002 (docker squats 3001); API :3000.

---

### Task A1: Notification channels fail loudly when unconfigured

**Files:**
- Modify: `apps/worker/src/notifications/channels/whatsapp.ts`
- Modify: `apps/worker/src/notifications/channels/push.ts`
- Test: `apps/worker/src/notifications/channels/channels.test.ts` (new)

**Interfaces:**
- Produces: `sendWhatsApp(env,msg)` / `sendPush(env,msg)` REJECT with `Error("channel_not_configured:<name>")` when required env missing AND not (NODE_ENV=test || NOTIF_DRIVER=stub). Dispatcher's existing `.catch` then records `status:"failed"` honestly — no dispatcher change needed.

- [ ] **Step 1: Failing tests**

```ts
// apps/worker/src/notifications/channels/channels.test.ts
import { describe, it, expect } from "vitest"
import { sendWhatsApp } from "./whatsapp"
import { sendPush } from "./push"

const envStub = { NODE_ENV: "development" } as never

describe("notification channels config honesty", () => {
  it("sendWhatsApp rejects when Twilio env missing outside stub/test", async () => {
    await expect(sendWhatsApp(envStub, { to: "whatsapp:+237600000001", body: "x" })).rejects.toThrow(
      /channel_not_configured:whatsapp/,
    )
  })
  it("sendPush rejects when ntfy base missing outside stub/test", async () => {
    await expect(sendPush(envStub, { userId: "u1", title: "t", message: "m" })).rejects.toThrow(
      /channel_not_configured:push/,
    )
  })
  it("stub mode still resolves silently", async () => {
    process.env.NOTIF_DRIVER = "stub"
    await expect(
      sendWhatsApp(envStub, { to: "whatsapp:+237600000001", body: "x" }),
    ).resolves.toBeUndefined()
    delete process.env.NOTIF_DRIVER
  })
})
```

Note: worker vitest currently has NO test files (`--passWithNoTests`). If no vitest config exists for worker, create minimal `apps/worker/vitest.config.ts` mirroring api's (read `apps/api/vitest.config.*` first; likely unnecessary — vitest defaults suffice).

- [ ] **Step 2: RED** — `pnpm --filter @camermove/worker exec vitest run src/notifications/channels` → FAIL (resolves instead of rejects).

- [ ] **Step 3: Implement**

In both files, replace the missing-env silent block:

```ts
// whatsapp.ts — replace console.warn+return
if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
  throw new Error("channel_not_configured:whatsapp")
}
```

```ts
// push.ts — replace console.warn+return
const baseUrl = env.NTFY_BASE_URL || env.NTFY_HOST
if (!baseUrl) {
  throw new Error("channel_not_configured:push")
}
```

Check `email.ts` for the same pattern; apply identical treatment if it silently succeeds when unconfigured (report either way).

- [ ] **Step 4: GREEN + suite** — channels tests pass; `pnpm --filter @camermove/worker exec tsc --noEmit` exit 0; run `pnpm smoke:tickets` (worker notification path) → still green (dev uses configured/local channels or records failed honestly — verify output shows no behavioral regression beyond honest failures).

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/notifications/channels/
git commit -m "fix(worker): notification channels reject when unconfigured - no more fake sent status"
```

---

### Task A2: Service principal migration; delete fabricated user upserts

**Files:**
- Create: `packages/db/prisma/migrations/<timestamp>_system_principal/migration.sql` (via `prisma migrate dev --name system_principal`)
- Modify: `apps/api/src/payments/jobs/reconciliation.ts` (~136-143, ~346-352)
- Modify: `apps/api/src/payments/jobs/refund.ts` (~56-62) + its call sites (read them first)
- Test: extend nearest covering tests (search `rg -l "confirmPaymentSuccess|processRefund" apps/api --type ts | grep test`)

**Interfaces:**
- Produces: User row `id="system"` (email `system@camermove.internal`, role `admin`, `passwordHash=null`, `status="system"` — unloggable). `AuditLog.actorId` writes use `"system"`. Refund resolves real admin via `prisma.user.findUnique({where:{id}})`; falls back to `"system"` ONLY for automated refunds; never creates rows.

- [ ] **Step 1: Read refund call sites** — identify who passes `actorId` (admin route? job?). Record in report.

- [ ] **Step 2: Migration**

```bash
pnpm --filter @camermove/db exec prisma migrate dev --name system_principal --create-only
```

Edit generated SQL:

```sql
-- Insert idempotent service principal (no login possible: NULL passwordHash)
INSERT INTO "User" ("id", "email", "role", "status")
VALUES ('system', 'system@camermove.internal', 'admin', 'system')
ON CONFLICT ("id") DO NOTHING;
```

Apply: `pnpm --filter @camermove/db exec prisma migrate dev`. Guard: if a colliding email exists, remap email first inside the same SQL (documented comment).

- [ ] **Step 3: Replace upserts**

Delete BOTH try/catch upserts in `reconciliation.ts`; change `actorId: "system:webhook"` → `"system"` in the two AuditLog writes. In `refund.ts`: replace upsert block with:

```ts
const actor = await tx.user.findUnique({ where: { id: actorId }, select: { id: true } })
if (!actor && actorId !== "system") {
  throw new Error(`refund_actor_not_found:${actorId}`)
}
```

and write `actorId: actor ? actorId : "system"`. Remove any now-unused imports.

- [ ] **Step 4: Tests** — extend the existing confirmPaymentSuccess test (smoke-tickets drives it live; unit-level: assert no User row with email containing `@camermove.cm` fabricated pattern is created during a confirm — piggyback the integration suite already present). Run `pnpm --filter @camermove/api test` + `pnpm smoke:tickets`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma apps/api/src/payments/jobs/
git commit -m "fix(api): single migrated service principal replaces fabricated admin users"
```

---

### Task A3: Payments env honesty + real description

**Files:**
- Modify: `apps/api/src/payments/service.ts` (lines ~44-59)
- Test: extend `rg -l "initiatePayment|createPaymentSession" apps/api/src/payments --type ts | grep test` (or add assertions to existing payments tests)

- [ ] **Step 1:** Replace lines 44-50 with `const env = loadEnv()` (delete try/catch fabrication entirely).
- [ ] **Step 2:** Description line 54: `CamerMove ${reference} Yaounde-Douala` → build from actual trip when available:

```ts
const routeLabel =
  trip && "routeOrigin" in (trip as Record<string, unknown>)
    ? `${(trip as Record<string, unknown>).routeOrigin}-${(trip as Record<string, unknown>).routeDestination}`
    : null
const description = routeLabel ? `CamerMove ${reference} ${routeLabel}` : `CamerMove ${reference}`
```

(Read the query above first — if `include` already pulls route fields, use them directly; otherwise keep reference-only form. Do NOT add a DB roundtrip.)

- [ ] **Step 3:** Run payments tests + `pnpm smoke` ; adjust any test asserting the fallback URL.
- [ ] **Step 4: Commit**

```bash
git add apps/api/src/payments/service.ts
git commit -m "fix(api): payments fail loudly on broken env; drop hardcoded route label"
```

---

### Task B1: One-command launch + docs

**Files:**
- Create: `scripts/dev-up.ps1`
- Create: `LAUNCH.md`
- Modify: `docker-compose.yml` (all 8 `ports:` → `127.0.0.1:` prefix)

- [ ] **Step 1:** Edit every mapping: e.g. `"5432:5432"` → `"127.0.0.1:5432:5432"` (8 services incl. grafana `127.0.0.1:3001:3000`).
- [ ] **Step 2:** `scripts/dev-up.ps1`: idempotent — `docker compose up -d`; wait postgres healthy; `pnpm --filter @camermove/db exec prisma migrate deploy`; seed-if-empty (reuse logic from plan-0 task-4: count User, run documented seed script only when 0); start api/worker/web detached with logs under `.superpowers\logs\` (create dir); poll `http://localhost:3000/health` + web :3002 Ready; print URL table + demo creds pointer to LAUNCH.md.
- [ ] **Step 3:** `LAUNCH.md` (≤80 lines): prerequisites (Node 22, pnpm 11, Docker Desktop), `pnpm install`, `./scripts/dev-up.ps1`, URL table (:3000 API/docs/swagger, :3002 web, :8025 mailhog, :9001 minio, :8080 kafka-ui), seeded logins (read actual seed file for creds — document exactly what exists), stop command (`docker compose down`), troubleshoot section (port 3001 squat, Kafka topics auto-provision note).
- [ ] **Step 4:** Prove it: stop everything (`docker compose down`, kill node processes on :3000/:3002), run `./scripts/dev-up.ps1` fresh, then `Invoke-RestMethod http://localhost:3000/health` + web 200. Re-run once more to prove idempotency.
- [ ] **Step 5: Commit**

```bash
git add scripts/dev-up.ps1 LAUNCH.md docker-compose.yml
git commit -m "feat(infra): one-command dev launch + loopback-only port bindings"
```

---

### Task C1: SEO foundation (metadata, robots, sitemap)

**Files:**
- Modify: `apps/web/app/layout.tsx` (metadata export only)
- Create: `apps/web/app/robots.ts`
- Create: `apps/web/app/sitemap.ts`
- Modify: `apps/web/next.config.ts` (nothing needed unless metadataBase requires — prefer env-based constant in layout)

- [ ] **Step 1:** layout.tsx metadata (keep lang="fr"):

```tsx
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002"
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "CamerMove — Billets de bus Yaoundé ↔ Douala", template: "%s | CamerMove" },
  description:
    "Réservez vos billets de bus interurbains au Cameroun en ligne. Recherche, paiement sécurisé Mobile Money et e-billet QR entre Yaoundé et Douala.",
  keywords: ["bus Cameroun", "Yaoundé Douala", "billet de bus en ligne", "réservation bus"],
  openGraph: { type: "website", locale: "fr_CM", siteName: "CamerMove", url: SITE_URL },
  twitter: { card: "summary_large_image" },
}
```

- [ ] **Step 2:** `robots.ts`:

```ts
import type { MetadataRoute } from "next"
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/dashboard", "/tickets/", "/transporter"] }],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002"}/sitemap.xml`,
  }
}
```

- [ ] **Step 3:** `sitemap.ts` listing `/`, `/results`, `/tickets/lookup` with lastModified.

- [ ] **Step 4:** Verify: boot web :3002 → `GET /robots.txt` contains `Disallow: /admin`; `GET /sitemap.xml` 200 XML; typecheck.

- [ ] **Step 5: Commit** — `feat(web): SEO foundation - metadata, robots.ts hides admin, sitemap`

---

### Task C2: Landing page redesign

**Files:**
- Modify: `apps/web/app/page.tsx` (server component assembling sections)
- Create: `apps/web/components/landing/Hero.tsx` (client — wraps SearchBar)
- Create: `apps/web/components/landing/Features.tsx`
- Create: `apps/web/components/landing/HowItWorks.tsx`
- Create: `apps/web/components/landing/PartnerCta.tsx`
- Create: `apps/web/components/landing/SiteFooter.tsx`
- Modify: `apps/web/app/layout.tsx` (JSON-LD Organization script)

Content (French): Hero h1 "Yaoundé ⇄ Douala en un clic", sub, SearchBar (existing component), trust chips (Paiement sécurisé · E-billet QR · Annulation flexible); Features 3 cards (lucide icons: Bus/Search, ShieldCheck, QrCode); HowItWorks 3 numbered steps (Rechercher→Réserver&payer→Recevoir e-billet); PartnerCta teal band linking `/transporter/apply`; Footer: brand blurb, link groups (Voyageurs: Réserver/Mon compte/Retrouver un billet → real routes; Entreprise: Devenir partenaire/Contact (#)), legal line © 2026 CamerMove. All ≤200 lines each; mobile-first Tailwind; theme tokens #0e9f8f/#f4b607.

JSON-LD in layout body:

```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
  "@context": "https://schema.org", "@type": "Organization", name: "CamerMove",
  url: SITE_URL, areaServed: "CM", slogan: "Yaoundé ⇄ Douala en un clic" }) }} />
```

Verify: home renders 200 with all sections present in HTML (string checks), typecheck, `pnpm --filter @camermove/web exec tsc --noEmit`.
Commit: `feat(web): marketing landing page with SEO structure`

---

### Task D1: Traveler auth pages (/login, /register)

**Files:**
- Create: `apps/web/app/login/page.tsx` + `apps/web/app/register/page.tsx`
- Create: `apps/web/lib/api/auth.ts` (login/register/getProfile helpers using apiFetch WITHOUT token for these — plain fetch wrapper here since apiFetch requires token; mirror ApiError usage)
- Create: `apps/web/components/auth/AuthForm.tsx` (shared client form ≤200 lines: mode login|register, French labels/errors, Zod-lite manual validation mirroring API RegisterBody rules read from `apps/api/src/auth/schema.ts`)

Behavior: submit → API → `useAuthStore.setAuth({accessToken, user})` (cookie mirrors automatically via providers subscription) → `router.push(next ?? "/dashboard")`. Register: firstName/lastName/email/password → auto-login same flow. Show API error messages verbatim (French from server).
Verify: unauth /dashboard redirects /login?next=/dashboard; login with seeded creds lands dashboard; bad creds show French error. Typecheck.
Commit: `feat(web): traveler login and register pages close the auth loop`

---

### Task D2: Admin surface — profile endpoint, /admin/login, middleware, shell

**Files:**
- Create: `apps/api/src/routes/me/profile.ts` (GET /me/profile, requireAuth(), returns `{id,email,role,status}`)
- Modify: `apps/api/src/app.ts` (register after meTicketRoutes)
- Test: inject test 401/200 mirroring routes.test.ts pattern in partner-applications
- Create: `apps/web/app/admin/login/page.tsx` (own minimal layout inline; noindex via `export const metadata = { robots: { index: false } }`; posts to /auth/login; role gate: non-admin → error "Accès réservé aux administrateurs"; success → /admin)
- Modify: `apps/web/middleware.ts`: add `"/admin"` to PROTECTED_PREFIXES + matcher `/admin/:path*`; early-return allow for pathname === "/admin/login" (mirror PUBLIC_TICKETS_PATH pattern); unauth /admin/* → `/admin/login?next=...`
- Create: `apps/web/app/admin/page.tsx` + `apps/web/components/admin/AdminShell.tsx` (nav scaffold: Tableau de bord, Utilisateurs, Transporteurs, Trajets, Réservations, Paiements, Commissions, Paramètres, Journal d'audit — placeholder panels "Bientôt disponible"; fetches /me/profile client-side, renders email/role badge; noindex meta)

Verify chain: unauth `/admin` → 307 `/admin/login?next=%2Fadmin`; `/admin/login` reachable unauthenticated (200); traveler-role login at /admin/login shows refusal; admin/super_admin seeded creds land on shell rendering nav. API inject test green. Smoke suites still pass.
Commit: `feat(admin): separated admin login surface with role-gated shell`

---

### Task D3: Full gates + launch proof

- [ ] `pnpm -r typecheck` → 0; `pnpm -r test` → all pass
- [ ] `pnpm smoke` / `smoke:tickets` / `smoke:dashboard` (WEB_URL=:3002) → exit 0
- [ ] Launch proof via `scripts/dev-up.ps1` from cold start; then HTTP sweep recording statuses: `/` 200 + contains "Yaoundé", `/robots.txt` contains Disallow /admin, `/sitemap.xml` 200, `/admin` 307→/admin/login, `/admin/login` 200, `/login` 200, seeded-admin login POST 200 role check, `/results?origin=Yaoundé&destination=Douala` 200.
- [ ] Ledger line + report back.
