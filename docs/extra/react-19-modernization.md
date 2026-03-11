# React 19 Modernization Analysis

Current stack: **React 19.2.4**, **TanStack Start 1.166.6**, **Vite 7.3.1**

All the latest React 19 features are available but largely unused.

---

## 1. React Compiler (High Impact, Medium Risk)

**Current state:** Manual `useMemo` and `useCallback` scattered throughout — `EncyclopediaGrid`, `CollectionGrid`, `PullAnimation`, gacha route, etc.

**Opportunity:** Enable the React Compiler in `vite.config.ts` via the `viteReact()` plugin. It auto-memoizes components, eliminating most manual `useMemo`/`useCallback`.

**Pros:**

- Remove boilerplate memoization code across the codebase
- Catches re-render issues the manual approach misses
- Zero runtime cost — it's a compile-time transform
- Production-ready (v1.0.0, stable since Oct 2025, battle-tested at Meta)
- `@vitejs/plugin-react` 5.x has built-in support

**Cons — Development Experience:**

- **Forces Babel, slows HMR.** The compiler only ships as a Babel plugin (no SWC support yet). This adds **1-4 seconds of HMR latency** per file save compared to SWC-only pipelines. Significant dev experience regression.
- **TanStack Router incompatibility.** `useMatchRoute` has a [known bug](https://github.com/TanStack/router/issues/4499) where compiler memoization causes stale UI — match results only evaluate on initial render. Affected components need `"use no memo"` opt-outs.
- **Silent skips.** When the compiler can't optimize a component, it silently skips it (no error, no warning). The only way to check is the React DevTools "Memo (sparkle)" badge. This creates invisible "performance regressions" that are hard to debug.
- **Opt-in mode trades one boilerplate for another.** `compilationMode: "annotation"` only compiles functions with `"use memo"` directive — avoids global HMR slowdown but means manually annotating functions instead of manually memoizing them.

**Library compatibility:**

- Framer Motion / motion — Compatible
- Zustand — Compatible (uses `useSyncExternalStore` internally)
- TanStack Router — Mostly compatible, except `useMatchRoute` (see above)
- TanStack Table/Virtual — Known incompatible (compiler auto-detects and skips)

**Recommendation: Worth adopting, but weigh the HMR tradeoff.** The production performance wins are real. Consider `compilationMode: "annotation"` to opt-in incrementally and avoid slowing down all file saves during dev. Or accept the HMR hit and use `"all"` mode with `"use no memo"` escape hatches where needed.

---

## 2. `useTransition` for Mutations (Medium Impact, Low Risk)

**Current state:** Manual `pulling`/`claiming`/`loading` boolean flags everywhere:

```ts
// gacha.tsx
const [pulling, setPulling] = useState(false)
const [claiming, setClaiming] = useState(false)
// trade.tsx
const [loading, setLoading] = useState<string | null>(null)
```

**Opportunity:** Replace with `useTransition` — React manages the pending state and keeps the UI responsive during the transition.

```ts
const [isPending, startTransition] = useTransition()
const handleClaim = () =>
  startTransition(async () => {
    const res = await fetch('/api/gacha', { method: 'POST', body: ... })
    // update state...
    router.invalidate()
  })
// isPending replaces the manual boolean
```

**Pros:**

- Eliminates try/finally boilerplate for loading flags
- React can interrupt/deprioritize if user navigates away
- Built-in pending state is more reliable (no missed `finally` edge cases)

**Cons:**

- Transitions are non-blocking — if you _need_ to block the UI (e.g., prevent double-pulls), you still need a guard
- Slightly different mental model

**Recommendation: Adopt for trade operations and daily claim.** Keep manual state for gacha pulls where the animation sequence needs explicit phase control.

---

## 3. `useOptimistic` for Trade/Collection Actions (Medium Impact, Medium Risk)

**Current state:** All mutations wait for server response before updating UI. Trade accept/cancel, fossil balance changes, etc. all show spinners until the server round-trip completes.

**Opportunity:** Show the expected result immediately, roll back on error:

```ts
const [optimisticTrades, addOptimistic] = useOptimistic(
  trades,
  (state, cancelledId) => state.filter((t) => t.id !== cancelledId),
)
```

**Pros:**

- Instant UI feedback — feels much snappier
- Clean rollback on failure with toast notification
- Great for trade cancel, collection favorite/unfavorite

**Cons:**

- Adds complexity for error recovery
- Not worth it for gacha pulls (the animation IS the feedback)
- Requires careful thought about what "expected result" means

**Recommendation: Good fit for trade cancel/accept and collection toggles.** Skip for gacha (animation handles perceived speed) and admin actions (you want confirmation before reflecting changes).

---

## 4. `useActionState` + Form Actions (Low-Medium Impact, Low Risk)

**Current state:** Admin dialogs (`BanUserDialog`, etc.) use manual controlled inputs + `fetch()`:

```ts
const [reason, setReason] = useState('')
// ... on submit: fetch('/api/admin', { body: JSON.stringify({ reason }) })
```

**Opportunity:** Use `useActionState` with server functions for form-like operations:

```ts
const [state, formAction, isPending] = useActionState(banUserAction, initialState)
return <form action={formAction}>...</form>
```

**Pros:**

- Built-in pending state, error state, progressive enhancement
- Cleaner code for simple forms (admin dialogs, profile settings)
- Works without JS for basic submissions

**Cons:**

- TanStack Start's `createServerFn` doesn't natively integrate with React form actions yet (would need adapter code)
- Overkill for the simple admin dialogs we have
- Most of our "forms" are really just button clicks with parameters

**Recommendation: Low priority.** Admin forms are simple enough that the current approach works fine. Revisit if we add user-facing forms (profile editing, trade messaging, etc.).

---

## 5. Suspense Boundaries (Medium Impact, Medium Risk)

**Current state:** Only implicit Suspense via TanStack Router's `pendingComponent`. No component-level Suspense boundaries. Root route has `errorComponent` but no nested error boundaries.

**Opportunity:** Add Suspense boundaries around independently-loading sections:

- Encyclopedia page: Suspense around the grid while filters load more
- Admin analytics: Each stat card could suspend independently
- Collection page: Separate suspension for stats vs grid

**Pros:**

- Granular loading states — header loads first, then content sections stream in
- Better perceived performance on slow connections
- Can show skeleton UI per-section instead of full-page pending

**Cons:**

- TanStack Router already handles route-level Suspense well with `pendingComponent`
- Adding component-level Suspense requires refactoring data fetching (need to throw promises)
- Could cause layout shift if not designed carefully with proper skeleton dimensions

**Recommendation: Consider for admin analytics page** where multiple independent data queries run. Not needed for gacha/collection/trade routes where the loader provides all data at once.

---

## 6. `use()` Hook (Low Impact, Niche Use)

**Current state:** No usage of the `use()` hook for reading promises or context in conditionals.

**Opportunity:** Could replace some `useContext` calls and enable reading async data inside render without `useEffect`.

**Recommendation: Skip for now.** Data flow through TanStack Router loaders is clean and doesn't need this.

---

## 7. Activities API (Experimental — Not Ready)

The `<Activity>` component (for keeping off-screen UI alive) is still in React Labs / Canary. It's **not in the stable 19.x release**. It would be useful for:

- Keeping the encyclopedia grid state alive when navigating to a creature modal
- Preserving collection scroll position when viewing detail

**Recommendation: Watch but don't adopt.** Not stable. Route masking already handles the modal case well.

---

## Priority Summary

| Feature                   | Impact         | Risk   | Priority                             |
| ------------------------- | -------------- | ------ | ------------------------------------ |
| `useTransition`           | Medium         | Low    | **1 — Easiest quick win**            |
| `content-visibility`      | Medium         | None   | **2 — One-line CSS, CollectionGrid** |
| React Compiler            | High           | Medium | **3 — Big win, weigh HMR cost**      |
| `useOptimistic`           | Medium         | Medium | **4 — Trade/Collection**             |
| Suspense boundaries       | Medium         | Medium | 5 — Admin analytics                  |
| `useActionState`          | Low            | Low    | 6 — Future forms                     |
| `React.memo` CreatureCard | Medium         | Low    | Unnecessary w/ Compiler              |
| Code-splitting            | Low            | Low    | Skip (route splitting suffices)      |
| `use()` hook              | Low            | Low    | Skip                                 |
| Activities                | High potential | High   | Wait for stable                      |

`useTransition` is the safest starting point — zero dev experience cost, immediate cleanup of manual loading booleans. `content-visibility` is a free CSS win for CollectionGrid. The React Compiler offers the biggest production performance gains but comes with a real HMR slowdown tradeoff during development — consider `compilationMode: "annotation"` for incremental adoption.

---

## Additional Findings (Vercel Best Practices Cross-Reference)

The following items come from Vercel's React performance guidelines. Some are Next.js-specific (noted as N/A), but many apply directly to TanStack Start.

### 8. `content-visibility: auto` for Long Lists (Medium Impact, Low Risk)

**Current state:** Masonry grids render all items without virtualization. No `content-visibility` CSS property used anywhere.

**Context:** Encyclopedia uses incremental pagination (30 items per load, appended via infinite scroll). After 5 loads, ~150 items are in the DOM. CollectionGrid renders all items at once (no pagination), so item count depends on collection size.

**Opportunity:** Add to masonry grid items:

```css
.grid-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 320px; /* estimated card height */
}
```

**Impact:** Browser skips layout/paint for off-screen items. For Encyclopedia, benefit grows as users scroll and accumulate items. For CollectionGrid (no pagination, all items rendered at once), the benefit is more immediate — especially for large collections.

**Recommendation: Worth doing for CollectionGrid** where all items render at once. Lower priority for Encyclopedia since pagination already limits the initial DOM size.

**Files:** `CollectionGrid.tsx` (primary), `EncyclopediaGrid.tsx` (secondary)

---

### 9. Code-Splitting Heavy Components (Low Impact for This App)

**Current state:** No `React.lazy()` or dynamic `import()` anywhere.

**Context:** TanStack Router already does **route-based code splitting** — the gacha route's JS bundle is only loaded when navigating to `/gacha`. `PullAnimation` is always mounted when a banner is active (it idles until a pull happens), and users visit the gacha page specifically to pull. Splitting PullAnimation further within the route would only shave bytes off the initial gacha page load before the first pull — minimal real-world benefit.

**Possible candidates if bundle size becomes an issue:**

- `CreaturePickerModal` — Only opened on demand in trade flows
- Admin route components — Already behind auth + route-split

**Recommendation: Skip for now.** Route-level code splitting already handles the heavy lifting. Revisit only if bundle analysis shows the gacha route is too large.

---

### 10. Functional `setState` for Stable Callbacks (Low Impact, Low Risk)

**Current state:** Most `setState` calls are direct value assignments. Some callbacks depend on current state, requiring them in dependency arrays.

**Opportunity:** Use functional form to eliminate stale closures and stabilize callbacks:

```ts
// Instead of:
setItems([...items, newItem]) // depends on `items`

// Use:
setItems((curr) => [...curr, newItem]) // no dependency needed
```

**Already done well in:** Countdown timer (`setSecondsLeft(s => s <= 1 ? 0 : s - 1)`)

**Recommendation: Minor cleanup.** Apply where it would simplify dependency arrays in `useCallback`/`useEffect`.

---

### 11. Lazy State Initialization (Low Impact, Low Risk)

**Current state:** Not audited for expensive initializers, but likely minimal since most data comes from server loaders.

**Opportunity:** If any `useState` calls compute initial values (e.g., building a search index, parsing JSON), pass a function:

```ts
// Expensive: runs on every render
const [index] = useState(buildSearchIndex(items))

// Correct: runs only on mount
const [index] = useState(() => buildSearchIndex(items))
```

**Recommendation: Check during React Compiler adoption.** The compiler may flag these automatically.

---

### 12. `React.memo` for `CreatureCard` (Medium Impact, Low Risk)

**Current state:** `CreatureCard` is rendered hundreds of times in grids but is not wrapped in `React.memo`. Parent re-renders (filter changes, scroll-triggered state updates) cause all cards to re-render.

**Opportunity:** Wrap in `React.memo` since card props rarely change:

```ts
export const CreatureCard = memo(function CreatureCard({ creature, ... }) {
  // ...
})
```

**Note:** If React Compiler is enabled (item #1), this becomes unnecessary — the compiler handles it automatically.

**Recommendation: Skip if adopting React Compiler. Otherwise, add `memo` to `CreatureCard`.**

---

### What's Already Done Well

These Vercel best practices are **already followed** in the codebase:

| Practice                           | Status    | Notes                                                                      |
| ---------------------------------- | --------- | -------------------------------------------------------------------------- |
| `Promise.all` for parallel fetches | Excellent | Used in every loader — gacha, encyclopedia, analytics (14-query parallel!) |
| Map/Set for O(1) lookups           | Excellent | `TEMPLATE_MAP` in encyclopedia, `Set` for era deduplication                |
| No barrel file anti-pattern        | Good      | Direct file imports throughout, only `icons/index.tsx` re-exports          |
| Preloading on hover                | Good      | TanStack Router `preload="intent"` on encyclopedia links                   |
| Image preloading                   | Good      | Manual `new Image()` preload during gacha pull animation                   |
| No RegExp in render                | Good      | All regex is in utility functions, not render paths                        |
| Conditional `&&` safety            | Good      | Boolean coercion (`!!`) used correctly                                     |
| No localStorage in render          | Good      | All persistence via server/DB, not client storage                          |
| No third-party analytics blocking  | Good      | No analytics scripts to defer                                              |
| Derived state during render        | Good      | `useMemo` for filtered lists, not useState + useEffect                     |
| CSS animations over JS             | Good      | All animations via Tailwind keyframes or Framer Motion                     |

### N/A for TanStack Start (Next.js-Specific)

These Vercel rules don't apply to our stack:

- **`server-cache-react`** — `React.cache()` is RSC-only; we use TanStack Router loaders
- **`server-dedup-props`** — RSC serialization concern; not applicable
- **`server-after-nonblocking`** — `after()` is a Next.js API; Cloudflare Workers has `ctx.waitUntil()` (already available via `env`)
- **`bundle-barrel-imports` optimizePackageImports** — Next.js config; Vite treeshakes well by default
- **`server-hoist-static-io`** — Less relevant in Workers (no filesystem), but could apply to R2 reads
- **`client-swr-dedup`** — We use TanStack Router loaders, not SWR/React Query
- **`rendering-hydration-no-flicker`** — Relevant if we add theme toggle; not needed currently

---

## Files Most Affected

- `web/vite.config.ts` — Enable React Compiler
- `web/src/routes/_app/gacha.tsx` — useTransition for daily claim
- `web/src/routes/_app/trade.tsx` — useTransition + useOptimistic for trade ops
- `web/src/routes/_app/collection.tsx` — useOptimistic for favorites
- `web/src/components/encyclopedia/EncyclopediaGrid.tsx` — content-visibility on grid items, remove manual memos after compiler
- `web/src/components/collection/CollectionGrid.tsx` — content-visibility on grid items, remove manual memos after compiler
- `web/src/components/gacha/PullAnimation.tsx` — Code-split candidate, remove manual useCallback after compiler
- `web/src/components/shared/CreatureCard.tsx` — React.memo candidate (or let compiler handle)
- `web/src/routes/admin/analytics.tsx` — Suspense boundaries candidate
- `web/src/components/admin/BanUserDialog.tsx` — Future useActionState candidate
