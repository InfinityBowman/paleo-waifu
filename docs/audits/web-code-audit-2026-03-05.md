# Web Package Code Audit

**Date:** 2026-03-05
**Scope:** `web/src/` — routes, components, lib, store

---

## Critical

### ~~1. Duplicate `getEncyclopediaPage` / `loadMoreCreatures` server functions (95%)~~ FIXED

Deleted `getEncyclopediaPage`. Loader now calls `loadMoreCreatures` directly.

---

### ~~2. Admin auth boilerplate duplicated across 4 server functions (90%)~~ FIXED

Added `requireAdminSession()` to `auth-server.ts`. All 4 admin routes now use `const { cfEnv } = await requireAdminSession()`. Removed unused `createAuth`, `getRequest`, `getUserRole`, `getCfEnv` imports from each file.

---

### 3. `expireStaleTradesIfAny` — business logic in route file (85%)

**File:** `web/src/routes/_app/trade.tsx:19-91`

This 70-line function performs multi-step reads, batch writes, and creature-unlock logic. It belongs in a service module (or at minimum `src/lib/`), not at the top of a route file. It cannot be reused, unit-tested, or imported by the bot worker.

---

## Important

### ~~4. `StatCard` copy-pasted across 3 route files (88%)~~ FIXED

Extracted to `web/src/components/shared/StatCard.tsx` with optional `subtitle` prop. Removed local copies and `IconComponent` type from all 3 files.

---

### ~~5. `(session.user as { role?: string }).role` cast repeated 7 times (92%)~~ FIXED

Added `getUserRole()` helper in `auth-server.ts`. Replaced 5 server-side casts; 2 `Nav.tsx` casts remain inline (client component can't import from server module).

---

### ~~6. `refundFossils` is a copy of `grantFossils` (97%)~~ FIXED

`refundFossils` now delegates to `grantFossils`.

---

### 7. `TradeList.tsx` is 625 lines with 4 concerns (85%)

**File:** `web/src/components/trade/TradeList.tsx`

Mixes trade-card rendering, all three trade action flows (create, propose, confirm), load-more logic, and two separate picker modals. Split candidates: `<MarketplaceTab>`, `<IncomingOffersPanel>`, `<MyProposalsPanel>`.

---

### ~~8. XP progress calculation duplicated (82%)~~ FIXED

Added `calcXpProgress(xp, level)` to `@paleo-waifu/shared/xp`. Both profile and leaderboard now use it. Profile also uses existing `xpToNextLevel()` instead of manual calc.

---

### 9. Open-trade query select shape duplicated (88%)

**File:** `web/src/routes/_app/trade.tsx:119-140` and `272-302`

Both queries select the same 8 fields from the same 3-table join with identical column aliases. Only the `where` clause differs. Extract a shared query builder.

---

### 10. Component imports from route module — inverted dependency (80%)

**File:** `web/src/components/encyclopedia/EncyclopediaGrid.tsx`

Imports `loadMoreCreatures` and `getCreatureDetails` from `web/src/routes/_public/encyclopedia.tsx`. Components importing from routes inverts the natural dependency direction. These server functions should live in `src/lib/` or `src/server/`.

---

### ~~11. `count(distinct)` type cast duplicated (83%)~~ FIXED

Extracted `countDistinctSpecies(db, userId)` to `web/src/lib/queries.ts`. Both profile and admin user detail now use it.

---

### 12. Trade expiry runs on every page load (80%)

**File:** `web/src/routes/_app/trade.tsx:98`

`expireStaleTradesIfAny` fires on every `getTradeData` call (every page load, every `router.invalidate()`). Two preflight queries run unconditionally even when nothing is expired. Consider moving to a Cron Trigger or only running on mutations.

---

## Summary

| Priority  | #   | Issue                                     | Status                                            |
| --------- | --- | ----------------------------------------- | ------------------------------------------------- |
| Critical  | 6   | `refundFossils` duplicates `grantFossils` | **FIXED**                                         |
| Critical  | 1   | Duplicate encyclopedia server functions   | **FIXED**                                         |
| Critical  | 5   | Role cast repeated 7 times                | **FIXED** (5/7 server-side; 2 client-side remain) |
| Critical  | 2   | Admin auth boilerplate x4                 | **FIXED**                                         |
| Important | 4   | `StatCard` copy-pasted x3                 | **FIXED**                                         |
| Important | 8   | XP progress calc duplicated               | **FIXED**                                         |
| Important | 11  | `count(distinct)` cast duplicated         | **FIXED**                                         |
| Important | 9   | Trade query shape duplicated              | Open                                              |
| Important | 3   | Business logic in route file              | Open                                              |
| Important | 7   | TradeList.tsx too large (625 lines)       | Open                                              |
| Important | 10  | Component imports from route              | Open                                              |
| Important | 12  | Trade expiry on every page load           | Open                                              |
