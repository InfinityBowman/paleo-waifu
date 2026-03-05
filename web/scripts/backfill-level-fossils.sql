-- One-time backfill: grant 1 fossil per level to all existing users.
-- Since no users have reached level 5 yet, no milestone bonuses apply.
--
-- Dry-run first:
--   wrangler d1 execute paleo-waifu-db --remote --command "SELECT u.name, ux.level, c.fossils AS current, ux.level AS to_add FROM user_xp ux JOIN currency c ON c.user_id = ux.user_id JOIN user u ON u.id = ux.user_id WHERE ux.level > 0 ORDER BY ux.level DESC"
--
-- Execute:
--   wrangler d1 execute paleo-waifu-db --remote --file=./scripts/backfill-level-fossils.sql
--
-- WARNING: Not idempotent — run exactly once.

UPDATE currency
SET
  fossils = fossils + (
    SELECT user_xp.level
    FROM user_xp
    WHERE user_xp.user_id = currency.user_id
  ),
  updated_at = unixepoch()
WHERE EXISTS (
  SELECT 1 FROM user_xp
  WHERE user_xp.user_id = currency.user_id
    AND user_xp.level > 0
);
