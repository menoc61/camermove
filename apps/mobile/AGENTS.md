# `apps/mobile` — Agent Operating Manual

> Expo SDK 57 / React Native 0.86 / Reanimated 4.5. Every screen, every list, every transition flows through the rules below. If you find yourself writing a screen that doesn't, stop and align first.

## 1. Source-of-truth documents

Read these before touching anything in this folder:

1. `/AGENTS.md` — platform-level principles (stateless, idempotent, ACID, etc.).
2. `apps/mobile/CLAUDE.md` (or root `AGENTS.md` if missing) — general mobile notes.
3. `docs/superpowers/specs/2026-09-23-camermove-mobile-design.md` — Wave scope + decisions.
4. `docs/DESIGN-SYSTEM.md` — color / typography / motion tokens. Single source of truth.

Never invent hex codes, font sizes, or easings. Pull from `constants/theme.ts` and `lib/motion.ts`.

## 2. Expo version discipline

The Expo SDK ships breaking changes every release. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of `expo` in `package.json` (currently SDK 57).
2. Fetch the versioned docs: `https://docs.expo.dev/versions/v57.0.0/`.
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links; never answer from memory.

## 3. Commands

```bash
npx expo install <package>      # ALWAYS for expo packages — resolves SDK-compatible versions
npx expo install --fix          # fix incompatible package versions
npx expo start                  # dev server (EAS dev build only — never Expo Go for native deps)
npx expo lint
npx tsc --noEmit                # typecheck — must be 0 errors before commit
pnpm --filter @camermove/mobile test    # vitest — must be green
pnpm --filter @camermove/mobile typecheck
npx expo-doctor                 # diagnose dependency / config issues
```

`@camermove/mobile` is the workspace package name — never run raw `npm`/`yarn`/`pnpm add` for expo packages.

## 4. Navigation & Routing

- **Expo Router** (`expo-router`) is the only navigator. Routes live in `app/`.
- Every file in `app/` IS a screen. `_layout.tsx` files define navigators.
- Screens export route content from `screens/*.tsx`; route files in `app/` stay thin (`import { X } from "@/screens/x"; export default X;`).
- Import `Link`, `router`, `useLocalSearchParams`, `useRouter` from `expo-router`. Never wire a `<Button onPress={() => navigation.navigate(...)}>`.
- Keep non-route code (components, hooks, utils, store) outside `app/`.
- New screens MUST be registered in `app/_layout.tsx` `<Stack>` or the appropriate tab layout.

## 5. Network & data layer

- All API calls go through `lib/api/resource.ts` (`request` / `resourceClient`). No raw `fetch`, no cross-module `prisma.*` imports, no `loadEnv()`.
- Every `POST/PUT/PATCH` sends `Idempotency-Key` (handled automatically by `resource.ts` via `expo-crypto.randomUUID()`).
- API modules live in `lib/api/<vertical>.ts` with a sibling `*.test.ts` (vitest, stub `fetch`, assert URL + headers + idempotency key on writes).
- React Query keys must be deterministic and include every parameter that affects the response.

## 6. UI/UX invariants (non-negotiable)

These are enforced on every PR. Violating them is a regression.

### 6.1 Performance — **Use FlashList, never FlatList**

For ANY list of cards, rows, or grids (agencies, hotels, rentals, events, parcels, trips, search results, tickets, account lists). `@shopify/flash-list` is installed. Reasons:

- Large datasets (hundreds of items) crash or jank on `FlatList` due to view recycling limits.
- FlashList recycles off-screen cells across all platforms with a single 16ms window budget per frame.
- Set `estimatedItemSize` to the rendered card height in pt; the lib warns you at runtime if it's off.
- `contentInsetAdjustmentBehavior="automatic"` for ScrollViews/FlashLists under a translucent bar.

Use `FlatList` only when the dataset is **trivially small and never grows** (e.g. an in-memory 3-item stepper). Prefer `ScrollView` with mapped children for ≤5 hardcoded rows. Document the choice with a one-line comment.

### 6.2 Loading — **Skeletons for lists/cards/details; `LoadingState` only for form submits**

- List screens (`*/list/*`, home rails, account history): render `<SkeletonList count={n} />` while the React Query is pending. Never show a centered spinner for a list.
- Card rails (home, search filters): render `<SkeletonRail count={4} />`.
- Detail screens (hotel/rental/event/parcel/agency detail): render `<SkeletonHero />` + `<SkeletonText />` blocks while pending.
- Stat tiles (`<StatIndicator>` with `loading`): render the skeleton in-place of the value.
- Centered spinners (`LoadingState` in `components/ui/screen-state.tsx`) are reserved for blocking flows (form submit, retry-after-error from mutation).

### 6.3 Spinners on actions

Use the `<Spinner>` primitive for in-button / inline progress on asynchronous actions (refresh, submit, retry). The `ActionButton` component wires idle/loading/success/error transitions automatically — use it for any primary CTA.

- Idle: eyebrow label, ink background, paper text.
- Loading: inline `<Spinner size="sm" />` next to a "…" suffix, button disabled.
- Success: brief swap to a success label with a small scale animation, then reset.
- Errors: `Haptics.notificationAsync(Error)`.

### 6.4 Stat indicators with tooltips

Numeric KPIs (Home stats strip, account balances, dashboard tiles) MUST use `<StatIndicator>`. When the metric needs an explanation, pass a `tooltip` string. The tooltip:

- Slides in below the value with a 280ms ease-out (snaps to visible when reduce-motion is on).
- Dismisses on the next press (toggle).
- Has a 44×44 minimum touch target.
- Renders a `+` glyph that rotates 45° → `×` when open.

### 6.5 Micro-interactions

Use `<AnimatedPressFeedback>` (or compose with `<ActionButton>`) for every interactive surface:

- 0.97 press scale + 0.85 opacity while held.
- `Haptics.impactAsync(Light)` on every primary press (skipped when reduce-motion is on).
- Cards (agency/hotel/rental/event cards, search rows, account history items) use it via `style` only when the whole card is pressable; nested `<Button>`s do not.

### 6.6 Reveal animations

Every list / detail screen mounts via a `<Reveal>` wrapper for first-impression polish:

- `<Reveal>` for the page header (no delay).
- `<Reveal delay={i * 60}>` for staggered list items (cap stagger at 8 items to avoid slow painting).
- Direction is `up` for top-level content, `none` for full-screen replaces.

### 6.7 Reduce motion (accessibility — non-negotiable)

- All animations MUST consult `useReduceMotion()` (from `lib/motion.ts`).
- When the user has reduced motion on:
  - Skeletons render as a static block (no shimmer).
  - Presses get no scale/opacity animation.
  - Reveals skip the slide and snap to opacity 1.
  - Haptics are skipped.
  - Tooltip opens instantly (no slide).
- Action items still fire a `NotificationFeedback` on errors.

### 6.8 Brand fidelity

- Border radius: **zero** (`radius: 0`). No exceptions.
- Palette: only `colors.*` tokens. No hex literals in components.
- Typography: eyebrow (`11px / 500 / 0.22em uppercase`), h2 (`28px / 500 / -0.025em`), body (`16px / 400`), tabular-nums for prices.
- Borders: 1px `colors.line`. No shadows, no gradients, no glassmorphism.
- No tailwind / nativewind utility soup in `apps/mobile` — plain `StyleSheet.create`.
- Minimum touch target: 44×44.
- French copy throughout.

### 6.9 No dead code

- No `// TODO` / `// FIXME` without an issue link. No commented-out logic.
- Every file must be imported. Run `rg -n "TODO|FIXME|XXX|console\.log" apps/mobile` before commit.
- Stubs only where the plan explicitly allows (e.g. `POST /auth/refresh`).

## 7. Motion + animation libraries

| Library | When |
| --- | --- |
| `react-native-reanimated` (already installed) | All UI animations, transitions, gestures. Use worklets. |
| `expo-haptics` (already installed) | Tactile feedback on every primary interaction. |
| `expo-image` (already installed) | Network / asset images. Replaces `<Image>` for hero shots. |
| `@expo/ui` (already installed) | Native BottomSheet, DateTimePicker, SegmentedControl. Use before reaching for third-party. |
| `react-native-safe-area-context` (already installed) | Wrap every full-screen layout. |
| `@shopify/flash-list` (installed) | All lists >5 items. |
| `expo-crypto` / `expo-secure-store` / AsyncStorage | Already wired via the data layer — don't reinvent. |

When adding a new animation library, prefer Expo-bundled modules. Use `npx expo install <pkg>` to keep versions SDK-compatible.

## 8. Commit discipline

- One commit per cohesive change. Wording: `feat(mobile): …`, `fix(mobile): …`, `chore(mobile): …`, `docs(mobile): …`.
- Always include the verified path before the colon (e.g. `feat(mobile): motion primitives + flashlist retrofit`).
- Each commit must end with `pnpm --filter @camermove/mobile typecheck` clean and `pnpm --filter @camermove/mobile test` green.

## 9. Things NOT to do

- Don't touch files outside `apps/mobile/` without owning the work.
- Don't add raw `fetch` — go through `lib/api/resource.ts`.
- Don't add new dependencies without first running `npx expo install <pkg>` so versions stay aligned with the SDK.
- Don't introduce gradients, shadows, rounded corners, glassmorphism, or cobalt blue accents.
- Don't bypass `useReduceMotion()` to ship fancier animations.
- Don't keep `<ActivityIndicator>` for list / card loading — use skeletons.
- Don't add `console.log` to `apps/mobile` — debug with the devtools logger only.
- Don't commit secrets or `.env` files.
- Don't push to `main` directly — use the `feat/mobile-wave-*` branches.
