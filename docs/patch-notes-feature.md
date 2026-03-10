# Patch Notes / Updates Feature

Player-facing update posts (patch notes) with admin CRUD and a public `/updates` route.

## Overview

Admins write update posts via the admin dashboard. Players view them on a public `/updates` page. A notification dot in the nav indicates unread updates (tracked via `localStorage`).

## Schema

New `update_post` table in `packages/shared/src/db/schema.ts`:

| Column        | Type                  | Notes                                                 |
| ------------- | --------------------- | ----------------------------------------------------- |
| `id`          | `text` PK             | `nanoid()`                                            |
| `title`       | `text` NOT NULL       |                                                       |
| `body`        | `text` NOT NULL       | Raw markdown                                          |
| `tag`         | `text` nullable       | `'feature'` \| `'balance'` \| `'bugfix'` \| `'event'` |
| `publishedAt` | `integer` (timestamp) | Explicit publish date (allows backdating/scheduling)  |
| `createdAt`   | `integer` (timestamp) | Default `unixepoch()`                                 |
| `updatedAt`   | `integer` (timestamp) | Default `unixepoch()`                                 |

Indexes: `published_at` (for ordering), `tag` (for filtering).

Posts with `publishedAt` in the future are hidden from the public page — this doubles as a draft/scheduling mechanism without needing a separate `isDraft` flag.

## Routes

### Public

- **`/updates`** — List all published posts, newest first. Cached at edge (`s-maxage=60, stale-while-revalidate=300`). On mount, writes `localStorage.lastUpdatesVisit = Date.now()` to clear the nav badge.
- **`/updates/$postId`** — Single post detail with full rendered markdown. Dynamic `<title>` and OG meta from post content.

Both routes live under the `_public` layout group.

### Admin

- **`/admin/updates`** — List all posts (no publish filter), with create/edit/delete actions.

### API

- **`POST /api/updates`** — Admin-only CRUD. Actions: `create`, `update`, `delete`. Follows the same pattern as `/api/admin`.

## Components

### New Files

| File                                              | Purpose                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `web/src/components/updates/UpdatePostList.tsx`   | Renders list of post cards with date, tag badge, title, and body excerpt          |
| `web/src/components/updates/UpdatePostCard.tsx`   | Full post view with rendered markdown body                                        |
| `web/src/components/updates/MarkdownRenderer.tsx` | Thin wrapper: `marked.parse(body)` → `dangerouslySetInnerHTML` with prose styling |
| `web/src/components/admin/UpdatePostDialog.tsx`   | Dialog for creating/editing posts with Write/Preview tabs                         |
| `web/src/components/ui/textarea.tsx`              | shadcn Textarea primitive (doesn't exist yet)                                     |

### Modified Files

| File                                    | Change                                                              |
| --------------------------------------- | ------------------------------------------------------------------- |
| `packages/shared/src/db/schema.ts`      | Add `updatePost` table                                              |
| `web/src/components/layout/Nav.tsx`     | Add "Updates" link with `Newspaper` icon + `NotificationDot` badge  |
| `web/src/components/admin/AdminNav.tsx` | Add "Updates" item to `NAV_ITEMS`                                   |
| `web/src/lib/badges.ts`                 | Add `latestUpdateAt` to `BadgeData` + query for `MAX(published_at)` |

## Tag Colors

Reuse the existing rarity CSS variables for tag badges:

```ts
const TAG_STYLES: Record<string, string> = {
  feature: 'bg-rarity-rare/20 text-rarity-rare',
  balance: 'bg-rarity-epic/20 text-rarity-epic',
  bugfix: 'bg-destructive/20 text-destructive',
  event: 'bg-rarity-legendary/20 text-rarity-legendary',
}
```

## "New Update" Badge

The nav badge uses client-side tracking to avoid a per-user DB table:

1. `getBadges()` server fn returns `latestUpdateAt: number | null` (unix timestamp of most recent published post)
2. `Nav.tsx` compares this against `localStorage.getItem('lastUpdatesVisit')`
3. If the latest post is newer → show `NotificationDot` on the Updates link
4. Visiting `/updates` writes `localStorage.lastUpdatesVisit = Date.now()`, clearing the dot

This works for both authenticated and anonymous users.

## Markdown Rendering

- Use `marked` package for parsing markdown → HTML
- Style with Tailwind Typography (`@tailwindcss/typography`) or a hand-written `.prose-updates` class
- `dangerouslySetInnerHTML` is acceptable since only admins can author content
- Consider adding `DOMPurify` for defense-in-depth

## Admin Editor

- Plain `<textarea>` for the markdown body (no heavyweight WYSIWYG)
- Two tabs: **Write** (form fields) and **Preview** (rendered markdown)
- `publishedAt` field uses `datetime-local` input, defaults to now for new posts
- Conversion: `datetime-local` string ↔ unix timestamp (`Math.floor(new Date(val).getTime() / 1000)`)

## Data Flow

```
Public read:
  /updates loader → getUpdatePosts() serverFn
    → SELECT * FROM update_post WHERE published_at <= unixepoch() ORDER BY published_at DESC

Admin CRUD:
  UpdatePostDialog → fetch('/api/updates', { action, ... })
    → requireAdminSession() → INSERT/UPDATE/DELETE → router.invalidate()

Badge check:
  Nav.tsx → getBadges() serverFn
    → SELECT MAX(published_at) FROM update_post WHERE published_at <= unixepoch()
    → client compares to localStorage → show/hide NotificationDot
```

## Implementation Order

1. **Data layer** — Schema + migration + `pnpm db:migrate:local`
2. **API route** — `POST /api/updates` with admin auth guard
3. **Admin UI** — Textarea component, admin nav item, admin route + dialog
4. **Markdown** — Add `marked` dep, create `MarkdownRenderer`
5. **Public routes** — `/updates` list + `/updates/$postId` detail
6. **Nav badge** — Modify `badges.ts` + `Nav.tsx`
7. **Validate** — Typecheck, lint, test locally, migrate prod, deploy

## Implementation Notes

- Check `web/src/routes/api/admin.ts` for the exact API route export pattern before writing the updates API route
- `localStorage` access must be guarded for SSR (`typeof window !== 'undefined'` or inside `useEffect`)
- The `Textarea` component should mirror the existing `Input` component's styling
- Type: `type UpdatePostRow = typeof updatePost.$inferSelect` (inferred from schema)
