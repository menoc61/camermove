# Plan S — Shared-Instance Singleton Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One env instance and one storage client per process — memoized at the package level so all ~20 existing `loadEnv()` call sites become singletons with zero call-site churn.

**Architecture:** Memoize inside `packages/config`'s `loadEnv` (parse once, cache, return same frozen object). Add lazy `getStorage()` singleton in `packages/media`; switch the one production call site (`partner-applications/routes.ts`) to it; `createStorage` stays exported for tests. No DI container, no module restructuring.

**Tech Stack:** TypeScript, Zod (existing EnvSchema), MinIO client, Vitest.

## Global Constraints

- Zero behavior change: every existing test must pass untouched (except new identity tests).
- AGENTS §3: no dead code — nothing may end up unused.
- Public API preserved: `loadEnv(envSource?)` signature compatible with existing tests that pass custom sources.
- Explicit-path staging only; never stage `.env`.

---

### Task 1: Memoize loadEnv in packages/config

**Files:**
- Modify: `packages/config/src/env.ts`
- Test: `packages/config/src/env.test.ts` (append)

- [ ] **Step 1: Failing identity test**

Append to `packages/config/src/env.test.ts` (follow its existing setup style for required env vars):

```ts
describe("loadEnv memoization", () => {
  it("returns the SAME frozen instance across calls", () => {
    const a = loadEnv()
    const b = loadEnv()
    expect(a).toBe(b)
    expect(Object.isFrozen(a)).toBe(true)
  })
})
```

Note: existing tests mutate `process.env` then call `loadEnv()` expecting fresh parses (env.test.ts:9-34 uses `delete process.env... / expect(() => loadEnv()).toThrow`). If memoization breaks those tests, add a documented escape hatch `__resetEnvCacheForTests()` used in those tests' beforeEach — behavior contract: production callers always share one instance; tests opt out explicitly. Adapt minimally and document in the report.

- [ ] **Step 2: RED** — run `pnpm --filter @camermove/config exec vitest run src/env.test.ts`, expect FAIL on toBe/frozen.

- [ ] **Step 3: Implement**

```ts
let cached: Env | undefined
export function loadEnv(source?: NodeJS.ProcessEnv): Env {
  if (!cached) {
    cached = Object.freeze(parseEnv(source ?? process.env))
  }
  return cached
}
export function __resetEnvCacheForTests(): void {
  cached = undefined
}
```

Adapt names to the file's real internals (`parseEnv` = whatever currently validates; keep the real function). Freeze the instance. Keep the export list in `packages/config/src/index.ts` unchanged plus `__resetEnvCacheForTests` export ONLY if tests need it.

- [ ] **Step 4: GREEN + package green** — `pnpm --filter @camermove/config test` all pass; `pnpm --filter @camermove/config exec tsc --noEmit` exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/config/src/env.ts packages/config/src/env.test.ts packages/config/src/index.ts
git commit -m "refactor(config): memoize loadEnv as a per-process singleton"
```

---

### Task 2: getStorage() singleton in packages/media + adopt

**Files:**
- Modify: `packages/media/src/storage.ts`
- Modify: `packages/media/src/index.ts`
- Modify: `apps/api/src/partner-applications/routes.ts`
- Test: `packages/media/src/storage.test.ts` (append)

- [ ] **Step 1: Failing test**

Append to storage.test.ts (match its existing mock/style):

```ts
describe("getStorage singleton", () => {
  it("returns the same client instance across calls", () => {
    const a = getStorage()
    const b = getStorage()
    expect(a.getClient()).toBe(b.getClient())
  })
})
```

- [ ] **Step 2: RED** — `pnpm --filter @camermove/media exec vitest run src/storage.test.ts` → FAIL (getStorage not exported).

- [ ] **Step 3: Implement**

```ts
let storageSingleton: Storage | undefined
export function getStorage(): Storage {
  if (!storageSingleton) storageSingleton = createStorage(loadEnvFromConfig())
  return storageSingleton
}
```

Use whatever the correct env import is (`loadEnv` from `@camermove/config` — now safely cheap after Task 1). Export from `index.ts`.

- [ ] **Step 4: Adopt in routes.ts**

`apps/api/src/partner-applications/routes.ts`: drop `const env = loadEnv()` + `createStorage(env)` lines; use `const svc = createPartnerApplicationsService({ prisma, storage: getStorage() })`. Remove now-unused imports. NOTE: service factory no longer receives env — verify nothing else in the module reads `deps.env` (Task 2 of plan-1 removed it already).

- [ ] **Step 5: GREEN + gates**

`pnpm --filter @camermove/media test` pass; `pnpm --filter @camermove/api exec vitest run src/partner-applications` pass (service.test keeps using createStorage directly — unchanged); both `tsc --noEmit` exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/media/src/storage.ts packages/media/src/index.ts packages/media/src/storage.test.ts apps/api/src/partner-applications/routes.ts
git commit -m "refactor(media): getStorage() per-process singleton; partner-applications adopts it"
```

---

### Task 3: Whole-workspace gates

**Files:** none modified (unless a latent break surfaces).

- [ ] **Step 1:** `pnpm -r typecheck` → 0 errors
- [ ] **Step 2:** `pnpm -r test` → all pass
- [ ] **Step 3:** `pnpm smoke` ; `pnpm smoke:tickets` ; `pnpm smoke:dashboard` → exit 0 (API :3000 + worker running; restart detached if needed)
- [ ] **Step 4:** Ledger line + report back. Any breakage: root-cause fix, separate commit, re-run everything.
