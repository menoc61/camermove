# Plan 1 — Partner Application + MinIO Presigned Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged-in user can submit a transporter partner application (TRANS-01) with supporting documents uploaded browser→MinIO via short-TTL presigned PUT URLs, then check their application status.

**Architecture:** New Fastify module `apps/api/src/partner-applications/` following the repo convention (schema/service/routes; Zod on every endpoint; `requireAuth` preHandler). Applying creates a transactional trio: `Transporter(status=pending)` + `PartnerApplication(status=received)` + `Document` rows, and links the user via `User.transporterId`. Files never pass through the API: client requests an objectKey+uploadUrl (`POST /presign`), PUTs bytes straight to MinIO, then submits application metadata referencing presigned objectKeys (ownership enforced by key-prefix check). This activates the currently-unused `packages/media` storage package. Web adds `/transporter/apply` wizard behind the existing cookie-gate middleware.

**Tech Stack:** Fastify + Zod, Prisma 6/Postgres, MinIO via `@camermove/media`, Next.js 16 client components, Vitest against live docker stack (postgres+minio up).

## Global Constraints

- From spec (2026-08-25-phase5-and-app-verification-design.md): vertical slice ships API + web together; Zod on every endpoint; `Idempotency-Key` accepted on writes (plugin is global); metadata fields logged; no raw document bytes through the API; rate limiting inherited from global plugin.
- AGENTS.md §3: no dead code — `packages/media` must be imported after this plan or removed.
- AGENTS.md §4: single data-access layer via `packages/db`; typed config only.
- Error style: French user-facing messages matching existing code (`Accès refusé`).
- Never commit secrets; `.env` gitignored; explicit `git add <paths>` only.

---

### Task 1: Presign endpoint (schema + service + route)

**Files:**
- Create: `apps/api/src/partner-applications/schema.ts`
- Create: `apps/api/src/partner-applications/service.ts`
- Create: `apps/api/src/partner-applications/routes.ts`
- Test: `apps/api/src/partner-applications/service.test.ts`

**Interfaces:**
- Consumes: `createStorage`/`objectKey` from `@camermove/media` (`storage.presignPut(key): Promise<string>`), `signTokens` from `../auth/tokens`, `loadEnv` from `@camermove/config`.
- Produces: `partnerApplicationRoutes(app)` registered in Task 2; service factory `createPartnerApplicationsService(deps)` reused by Tasks 2–3; shared Zod schemas `PresignInput`, `ApplicationInput`, `DocumentRef`, `DOC_TYPES`.

- [ ] **Step 1: Write failing tests**

```ts
// apps/api/src/partner-applications/service.test.ts
import { describe, it, expect, beforeAll } from "vitest"
import { loadEnv } from "@camermove/config"
import { createStorage } from "@camermove/media"
import { createPartnerApplicationsService } from "./service"

const env = loadEnv()
const realStorage = createStorage(env)
const svc = createPartnerApplicationsService({ env, storage: realStorage })

describe("presignDocument", () => {
  it("returns uploadUrl containing bucket + objectKey under the caller prefix", async () => {
    const out = await svc.presignDocument("user_presign_1", {
      type: "business_registration",
      mimetype: "application/pdf",
      size: 1024,
    })
    expect(out.objectKey).toMatch(/^partner-applications\/user_presign_1\/[0-9a-f-]{36}\.pdf$/)
    expect(out.uploadUrl).toContain(env.MINIO_BUCKET)
    expect(out.uploadUrl).toContain(encodeURIComponent(out.objectKey))
    // presigned PUT URLs carry X-Amz- signature params
    expect(out.uploadUrl).toContain("X-Amz-Signature=")
  })

  it("maps image mimetypes to jpg/png extensions", async () => {
    const jpg = await svc.presignDocument("u", { type: "id_document", mimetype: "image/jpeg", size: 10 })
    const png = await svc.presignDocument("u", { type: "id_document", mimetype: "image/png", size: 10 })
    expect(jpg.objectKey.endsWith(".jpg")).toBe(true)
    expect(png.objectKey.endsWith(".png")).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @camermove/api exec vitest run src/partner-applications/service.test.ts`
Expected: FAIL — cannot resolve `./service`.

- [ ] **Step 3: Implement schema, service, routes**

```ts
// apps/api/src/partner-applications/schema.ts
import { z } from "zod"

export const DOC_TYPES = [
  "business_registration",
  "insurance",
  "transport_license",
  "id_document",
] as const

export const DocumentType = z.enum(DOC_TYPES)
export const AllowedMimetype = z.enum(["application/pdf", "image/jpeg", "image/png"])
const MAX_DOC_BYTES = 10 * 1024 * 1024

export const PresignInput = z.object({
  type: DocumentType,
  mimetype: AllowedMimetype,
  size: z.number().int().min(1).max(MAX_DOC_BYTES),
})

export const DocumentRef = z.object({
  type: DocumentType,
  objectKey: z.string().min(3).max(256),
  mimetype: AllowedMimetype,
  size: z.number().int().min(1).max(MAX_DOC_BYTES),
})

export const ApplicationInput = z.object({
  companyName: z.string().min(2).max(120),
  contactName: z.string().min(2).max(120),
  phone: z.string().min(6).max(30),
  city: z.string().min(2).max(80).optional(),
  transportType: z.string().min(2).max(80).optional(),
  vehicleCount: z.number().int().min(0).max(500).optional(),
  routesServed: z.array(z.string().min(1).max(120)).max(50),
  message: z.string().max(2000).optional(),
  documents: z.array(DocumentRef).min(1).max(10),
})

export type PresignInputT = z.infer<typeof PresignInput>
export type ApplicationInputT = z.infer<typeof ApplicationInput>
```

```ts
// apps/api/src/partner-applications/service.ts
import { loadEnv, type Env } from "@camermove/config"
import { objectKey, type Storage } from "@camermove/media"
import type { PresignInputT } from "./schema"

function extFor(mimetype: string): string {
  if (mimetype === "application/pdf") return "pdf"
  if (mimetype === "image/png") return "png"
  return "jpg"
}

export function createPartnerApplicationsService(deps: { env?: Env; storage: Storage }) {
  const env = deps.env ?? loadEnv()
  return {
    async presignDocument(userId: string, input: PresignInputT) {
      const objectKeyFull = objectKey(`partner-applications/${userId}`, extFor(input.mimetype))
      const uploadUrl = await deps.storage.presignPut(objectKeyFull)
      return { objectKey: objectKeyFull, uploadUrl }
    },
  }
}
```

```ts
// apps/api/src/partner-applications/routes.ts
import type { FastifyInstance } from "fastify"
import { loadEnv } from "@camermove/config"
import { createStorage } from "@camermove/media"
import { PresignInput } from "./schema"
import { createPartnerApplicationsService } from "./service"

export async function partnerApplicationRoutes(app: FastifyInstance) {
  const env = loadEnv()
  const storage = createStorage(env)
  const svc = createPartnerApplicationsService({ env, storage })

  app.post(
    "/partner-applications/presign",
    { preHandler: app.requireAuth() },
    async (req) => {
      const input = PresignInput.parse(req.body)
      const user = (req as unknown as { user: { id: string; role: string } }).user
      const meta = (req as unknown as { meta: Record<string, unknown> }).meta
      req.log.info({ ...meta, userId: user.id, docType: input.type }, "partner.application.presign")
      return svc.presignDocument(user.id, input)
    },
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @camermove/api exec vitest run src/partner-applications/service.test.ts`
Expected: PASS (3 tests). Note: presigned URL generation signs offline — no MinIO network call needed.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @camermove/api exec tsc --noEmit` → exit 0.

```bash
git add apps/api/src/partner-applications/schema.ts apps/api/src/partner-applications/service.ts apps/api/src/partner-applications/routes.ts apps/api/src/partner-applications/service.test.ts
git commit -m "feat(api): partner-application document presign endpoint (TRANS-01)"
```

---

### Task 2: Submit application endpoint (transactional create + guards)

**Files:**
- Modify: `apps/api/src/partner-applications/service.ts`
- Modify: `apps/api/src/partner-applications/routes.ts`
- Test: `apps/api/src/partner-applications/service.test.ts` (append)

**Interfaces:**
- Consumes: `prisma` from `@camermove/db`, `ConflictError`, `ForbiddenError` from `@camermove/config`.
- Produces: `svc.submit(userId, input)` → `{ id: string; status: "received" }`; `svc.getMyApplication(userId)` (Task 3).

- [ ] **Step 1: Write failing tests (append to service.test.ts)**

```ts
import { prisma } from "@camermove/db"

async function testUser(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: "x", role: "traveler" },
  })
}

describe("submit", () => {
  let userId: string
  beforeAll(async () => {
    const u = await testUser(`plan1-submit-${Date.now()}@test.cm`)
    userId = u.id
  })

  const baseInput = {
    companyName: "Agence Test Voyages",
    contactName: "Jean Test",
    phone: "+237600000001",
    routesServed: ["Yaoundé-Douala"],
    documents: [
      {
        type: "business_registration" as const,
        objectKey: "", // set below
        mimetype: "application/pdf" as const,
        size: 2048,
      },
    ],
  }

  it("creates pending Transporter + received application + documents, links user", async () => {
    const input = {
      ...baseInput,
      documents: [{ ...baseInput.documents[0], objectKey: `partner-applications/${userId}/doc.pdf` }],
    }
    const out = await svc.submit(userId, input as never)
    expect(out.status).toBe("received")

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.transporterId).toBeTruthy()
    const appRow = await prisma.partnerApplication.findUniqueOrThrow({
      where: { id: out.id },
      include: { documents: true },
    })
    expect(appRow.transporterId).toBe(user.transporterId)
    expect(appRow.documents).toHaveLength(1)
    const tr = await prisma.transporter.findUniqueOrThrow({ where: { id: user.transporterId! } })
    expect(tr.status).toBe("pending")
    expect(tr.email).toBe(user.email)
  })

  it("rejects a second application by the same user with 409", async () => {
    await expect(svc.submit(userId, baseInput as never)).rejects.toMatchObject({ status: 409 })
  })

  it("rejects documents outside the caller's presigned prefix with 403", async () => {
    const u2 = await testUser(`plan1-foreign-${Date.now()}@test.cm`)
    await expect(
      svc.submit(u2.id, {
        ...baseInput,
        documents: [{ ...baseInput.documents[0], objectKey: "partner-applications/someone-else/x.pdf" }],
      } as never),
    ).rejects.toMatchObject({ status: 403 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @camermove/api exec vitest run src/partner-applications/service.test.ts`
Expected: FAIL — `svc.submit is not a function`.

- [ ] **Step 3: Implement submit in service.ts**

Add inside the returned object of `createPartnerApplicationsService`:

```ts
import { ConflictError, ForbiddenError, UnauthorizedError } from "@camermove/config"
import type { ApplicationInputT } from "./schema"
// deps gain: prisma: PrismaClient  (import type { PrismaClient } from "@camermove/db")
```

IMPORTANT before using ConflictError: read `packages/config/src/errors.ts` first and match its exact constructor signature (existing call site uses single-message form: `new ForbiddenError("Accès refusé")`; app.ts maps `err.code ?? "CONFLICT"` style via `{ error: err.code, ... }`). Adapt constructor args AND the tests' `.rejects.toMatchObject({ status: 409 })` to whatever the real classes expose (`status` vs `statusCode`).

```ts
async submit(userId: string, input: ApplicationInputT) {
  const user = await deps.prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new UnauthorizedError()
  if (user.transporterId) throw new ConflictError("APPLICATION_EXISTS", "Une candidature existe déjà pour ce compte")
  const emailTaken = await deps.prisma.transporter.findUnique({ where: { email: user.email } })
  if (emailTaken) throw new ConflictError("TRANSPORTER_EMAIL_TAKEN", "Un transporteur utilise déjà cet email")
  const prefix = `partner-applications/${userId}/`
  for (const d of input.documents) {
    if (!d.objectKey.startsWith(prefix)) throw new ForbiddenError("DOCUMENT_NOT_OWNED", "Document non autorisé")
  }
  return deps.prisma.$transaction(async (tx) => {
    const transporter = await tx.transporter.create({
      data: {
        companyName: input.companyName,
        contactName: input.contactName,
        phone: input.phone,
        email: user.email,
        city: input.city,
        transportType: input.transportType,
        vehicleCount: input.vehicleCount ?? 0,
        servedRoutes: input.routesServed,
        status: "pending",
      },
    })
    const created = await tx.partnerApplication.create({
      data: {
        companyName: input.companyName,
        contactName: input.contactName,
        phone: input.phone,
        email: user.email,
        city: input.city,
        transportType: input.transportType,
        vehicleCount: input.vehicleCount,
        routesServed: input.routesServed,
        message: input.message,
        status: "received",
        transporterId: transporter.id,
      },
    })
    await tx.document.createMany({
      data: input.documents.map((d) => ({
        type: d.type,
        objectKey: d.objectKey,
        mimetype: d.mimetype,
        size: d.size,
        transporterId: transporter.id,
        partnerApplicationId: created.id,
      })),
    })
    await tx.user.update({ where: { id: userId }, data: { transporterId: transporter.id } })
    return { id: created.id, status: created.status as "received" }
  })
}
```

Update the factory deps type to `{ env?: Env; storage: Storage; prisma: PrismaClient }` and update the test's `svc` construction accordingly (import `prisma` from `@camermove/db`).

- [ ] **Step 4: Add route**

In `routes.ts`:

```ts
import { ApplicationInput } from "./schema"

app.post("/partner-applications", { preHandler: app.requireAuth() }, async (req, reply) => {
  const input = ApplicationInput.parse(req.body)
  const user = (req as unknown as { user: { id: string; role: string } }).user
  const meta = (req as unknown as { meta: Record<string, unknown> }).meta
  req.log.info({ ...meta, userId: user.id, docCount: input.documents.length }, "partner.application.submit")
  const out = await svc.submit(user.id, input)
  try {
    const { prisma } = await import("@camermove/db")
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "partner.application.submit",
        entityType: "PartnerApplication",
        entityId: out.id,
        metadata: { docCount: input.documents.length, companyName: input.companyName } as never,
      },
    })
  } catch {
    // audit best-effort; submission must not fail because of audit write
  }
  return reply.code(201).send(out)
})
```

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm --filter @camermove/api exec vitest run src/partner-applications/service.test.ts`
Expected: PASS (6 tests).

Cleanup rule: append an `afterAll` deleting `prisma.user.deleteMany({ where: { email: { contains: "@test.cm" } } })` — cascades remove transporters/apps/documents via schema `onDelete`.

- [ ] **Step 6: Typecheck + full api suite + commit**

Run: `pnpm --filter @camermove/api exec tsc --noEmit` → 0 errors; `pnpm --filter @camermove/api test` → all green.

```bash
git add apps/api/src/partner-applications/service.ts apps/api/src/partner-applications/routes.ts apps/api/src/partner-applications/service.test.ts
git commit -m "feat(api): submit partner application atomically (TRANS-01)"
```

---

### Task 3: Status endpoint (GET /partner-applications/me)

**Files:**
- Modify: `apps/api/src/partner-applications/service.ts`
- Modify: `apps/api/src/partner-applications/routes.ts`
- Test: `apps/api/src/partner-applications/service.test.ts` (append)

**Interfaces:**
- Produces: `svc.getMyApplication(userId)` → `{ id, status, createdAt, companyName, documents: Array<{type,size,mimetype,createdAt}> } | null`.

- [ ] **Step 1: Failing test**

```ts
describe("getMyApplication", () => {
  it("returns sanitized shape without objectKeys for the linked applicant", async () => {
    const u = await testUser(`plan1-me-${Date.now()}@test.cm`)
    await svc.submit(u.id, {
      companyName: "Status Test SARL",
      contactName: "Marie Test",
      phone: "+237600000002",
      routesServed: ["Douala-Bafoussam"],
      documents: [
        { type: "insurance" as const, objectKey: `partner-applications/${u.id}/ins.pdf`, mimetype: "application/pdf" as const, size: 4096 },
      ],
    } as never)
    const me = await svc.getMyApplication(u.id)
    expect(me).not.toBeNull()
    expect(me!.status).toBe("received")
    expect(JSON.stringify(me)).not.toContain("objectKey")
    expect(me!.documents[0].size).toBe(4096)

    const stranger = await testUser(`plan1-stranger-${Date.now()}@test.cm`)
    expect(await svc.getMyApplication(stranger.id)).toBeNull()
  })
})
```

- [ ] **Step 2: Verify failure** — run suite; expected FAIL (method missing).

- [ ] **Step 3: Implement**

```ts
async getMyApplication(userId: string) {
  const user = await deps.prisma.user.findUnique({ where: { id: userId } })
  if (!user?.transporterId) return null
  const row = await deps.prisma.partnerApplication.findFirst({
    where: { transporterId: user.transporterId },
    orderBy: { createdAt: "desc" },
    include: { documents: { select: { type: true, size: true, mimetype: true, createdAt: true } } },
  })
  if (!row) return null
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    companyName: row.companyName,
    documents: row.documents,
  }
}
```

Route:

```ts
app.get("/partner-applications/me", { preHandler: app.requireAuth() }, async (req) => {
  const user = (req as unknown as { user: { id: string; role: string } }).user
  return svc.getMyApplication(user.id)
})
```

- [ ] **Step 4: Verify pass + typecheck + commit**

Run: `pnpm --filter @camermove/api exec vitest run src/partner-applications/service.test.ts` → all PASS; `tsc --noEmit` → 0 errors.

```bash
git add apps/api/src/partner-applications/service.ts apps/api/src/partner-applications/routes.ts apps/api/src/partner-applications/service.test.ts
git commit -m "feat(api): partner application status endpoint (TRANS-01)"
```

---

### Task 4: Wire module into app.ts + auth inject test

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/partner-applications/routes.test.ts` (new)

- [ ] **Step 1: Write failing test**

```ts
// apps/api/src/partner-applications/routes.test.ts
import { describe, it, expect } from "vitest"
import { buildApp } from "../app"
import { loadEnv } from "@camermove/config"
import { signTokens } from "../auth/tokens"

describe("partner-application routes auth", () => {
  it("401 without token; accepts valid JWT on /me", async () => {
    const app = await buildApp()
    const noAuth = await app.inject({ method: "POST", url: "/api/v1/partner-applications/presign", payload: {} })
    expect(noAuth.statusCode).toBe(401)

    const env = loadEnv()
    const { accessToken } = signTokens({ id: "routes-test-user", role: "traveler" }, env)
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/partner-applications/me",
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
```

Note: if `signTokens` returns a different shape than `{accessToken}`, adjust destructure after reading `apps/api/src/auth/tokens.ts` — verify first, do not guess.

- [ ] **Step 2: Verify failure** — expected FAIL (404 route not found until wired).

- [ ] **Step 3: Register in app.ts**

Mirror existing imports/registrations:

```ts
import { partnerApplicationRoutes } from "./partner-applications/routes"
// ...
await app.register(partnerApplicationRoutes, { prefix: "/api/v1" })
```

Place after `meTicketRoutes` registration.

- [ ] **Step 4: Verify pass**

Run: `pnpm --filter @camermove/api exec vitest run src/partner-applications/routes.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.ts apps/api/src/partner-applications/routes.test.ts
git commit -m "feat(api): register partner-application routes"
```

---

### Task 5: Web — apply wizard at /transporter/apply

**Files:**
- Create: `apps/web/lib/api/partner.ts`
- Create: `apps/web/app/transporter/apply/page.tsx`
- Create: `apps/web/components/partner/ApplyWizard.tsx`
- Modify: `apps/web/middleware.ts`

**Interfaces:**
- Consumes: `apiFetch` from `lib/api/client.ts`; token from `useAuthStore` (mirror exactly how `apps/web/app/dashboard/page.tsx` obtains its token — read it first and follow that pattern).
- Produces: authenticated-only route `/transporter/apply`.

- [ ] **Step 1: API helpers**

```ts
// apps/web/lib/api/partner.ts
import { apiFetch } from "./client"

export type DocumentType = "business_registration" | "insurance" | "transport_license" | "id_document"

export interface PresignResponse {
  objectKey: string
  uploadUrl: string
}

export interface ApplicationPayload {
  companyName: string
  contactName: string
  phone: string
  city?: string
  transportType?: string
  vehicleCount?: number
  routesServed: string[]
  message?: string
  documents: Array<{ type: DocumentType; objectKey: string; mimetype: string; size: number }>
}

export function presignDocument(token: string, body: { type: DocumentType; mimetype: string; size: number }) {
  return apiFetch<PresignResponse>("/api/v1/partner-applications/presign", {
    method: "POST",
    body: JSON.stringify(body),
    token,
  })
}

export async function uploadToPresigned(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", body: file })
  if (!res.ok) throw new Error(`Échec de l'envoi du fichier (${res.status})`)
}

export function submitApplication(token: string, payload: ApplicationPayload) {
  return apiFetch<{ id: string; status: string }>("/api/v1/partner-applications", {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  })
}

export interface MyApplication {
  id: string
  status: string
  createdAt: string
  companyName: string
  documents: Array<{ type: string; size: number; mimetype: string; createdAt: string }>
}

export function getMyApplication(token: string) {
  return apiFetch<MyApplication | null>("/api/v1/partner-applications/me", { method: "GET", token })
}
```

- [ ] **Step 2: Wizard component (single client component, ≤200 lines)**

Build `ApplyWizard.tsx` as a controlled multi-step form: Step 1 company info (companyName, contactName, phone, city, transportType, vehicleCount, routesServed comma-separated → array, message textarea); Step 2 documents (for each of the 4 DOC_TYPES allow one optional file except `business_registration` which is required; on select → presign → `uploadToPresigned` immediately; show per-file ✓/✗ state; accept `.pdf,.jpg,.jpeg,.png` ≤10MB, reject others client-side); Step 3 review + submit → `submitApplication`; success renders status card using `getMyApplication`. French labels throughout. Client-side validation mirrors the API Zod rules (lengths, ≥1 doc). Follow existing component conventions (Tailwind classes like `components/booking/passenger-form.tsx`, lucide-react icons).

- [ ] **Step 3: Page + middleware gate**

```tsx
// apps/web/app/transporter/apply/page.tsx
"use client"
import { ApplyWizard } from "../../../components/partner/ApplyWizard"

export default function TransporterApplyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Devenir partenaire transporteur</h1>
      <ApplyWizard />
    </main>
  )
}
```

middleware.ts: add `"/transporter"` to `PROTECTED_PREFIXES` and `"/transporter/:path*"` to `config.matcher`. Update the doc-comment list of public routes accordingly (transporter/* is NOT public).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @camermove/web exec tsc --noEmit` → 0 errors; boot web detached (`Start-Process cmd.exe '/c pnpm --filter @camermove/web dev -p 3002 > .superpowers\sdd\plan-1\web.log 2>&1' -WindowStyle Hidden`) and confirm unauthenticated `http://localhost:3002/transporter/apply` redirects to `/login?next=%2Ftransporter%2Fapply` (Invoke-WebRequest -MaximumRedirection 0 shows 307 to /login). Kill the server afterwards unless later tasks need it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/api/partner.ts apps/web/components/partner/ApplyWizard.tsx apps/web/app/transporter/apply/page.tsx apps/web/middleware.ts
git commit -m "feat(web): transporter apply wizard with direct-to-MinIO uploads (TRANS-01)"
```

---

### Task 6: Browser-upload CORS for MinIO + final gates

**Files:**
- Modify: `docker-compose.yml` (minio service environment)
- Modify: `docs/superpowers/plans/2026-08-25-plan-0-verification-report.md` (append Phase-5 progress note) — optional, skip if cleaner to leave report untouched.

- [ ] **Step 1: Allow browser PUT/PUT-preflight to MinIO dev**

Under `minio:` service `environment:` add (bitnami var):

```yaml
MINIO_API_CORS_ALLOW_ORIGIN: "*"
```

Then recreate ONLY minio: `docker compose up -d minio` (named volume preserves data). Verify: `docker compose ps minio` healthy/up.

- [ ] **Step 2: Full gates**

Run in order; every command exit 0:
`pnpm -r typecheck`
`pnpm -r test`
`pnpm smoke` ; `pnpm smoke:tickets` ; `pnpm smoke:dashboard`

- [ ] **Step 3: E2E proof over HTTP (scripted, no browser)**

Write `.superpowers/sdd/plan-1/e2e-proof.ps1` executed NOT committed, doing: register fresh user on :3000 → login → POST presign (business_registration/pdf/2048) → generate 2KB dummy PDF buffer → PUT bytes to returned uploadUrl (proves CORS config + real MinIO write) → POST /partner-applications referencing that objectKey → expect 201 {status:"received"} → GET /me → expect status received, 1 document. Log each status. Any failure = fix root cause before proceeding.

- [ ] **Step 4: Commit + ledger**

```bash
git add docker-compose.yml
git commit -m "chore(infra): allow browser CORS for MinIO presigned uploads"
```

Append one line to `.superpowers/sdd/progress.md`: `Plan 1 complete: TRANS-01 done (commits <list>, e2e proof passed)`.

Report back: status, commits, gate summary, concerns.
