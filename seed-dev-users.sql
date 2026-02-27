-- Dev test users for multi-user testing
-- Run: pnpm db:seed:dev-users

-- ─── Users ──────────────────────────────────────────────────────────

INSERT OR IGNORE INTO user (id, name, email, emailVerified, image, createdAt, updatedAt)
VALUES ('dev-user-1', 'DinoLover', 'dev1@paleowaifu.test', 0, 'https://api.dicebear.com/9.x/thumbs/svg?seed=DinoLover', unixepoch(), unixepoch());

INSERT OR IGNORE INTO user (id, name, email, emailVerified, image, createdAt, updatedAt)
VALUES ('dev-user-2', 'FossilQueen', 'dev2@paleowaifu.test', 0, 'https://api.dicebear.com/9.x/thumbs/svg?seed=FossilQueen', unixepoch(), unixepoch());

INSERT OR IGNORE INTO user (id, name, email, emailVerified, image, createdAt, updatedAt)
VALUES ('dev-user-3', 'MesozoicMax', 'dev3@paleowaifu.test', 0, 'https://api.dicebear.com/9.x/thumbs/svg?seed=MesozoicMax', unixepoch(), unixepoch());

INSERT OR IGNORE INTO user (id, name, email, emailVerified, image, createdAt, updatedAt)
VALUES ('dev-user-4', 'TradeTyrant', 'dev4@paleowaifu.test', 0, 'https://api.dicebear.com/9.x/thumbs/svg?seed=TradeTyrant', unixepoch(), unixepoch());

-- ─── Discord OAuth accounts (fake provider entries) ─────────────────

INSERT OR IGNORE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
VALUES ('dev-account-1', '100000000000000001', 'discord', 'dev-user-1', unixepoch(), unixepoch());

INSERT OR IGNORE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
VALUES ('dev-account-2', '100000000000000002', 'discord', 'dev-user-2', unixepoch(), unixepoch());

INSERT OR IGNORE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
VALUES ('dev-account-3', '100000000000000003', 'discord', 'dev-user-3', unixepoch(), unixepoch());

INSERT OR IGNORE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
VALUES ('dev-account-4', '100000000000000004', 'discord', 'dev-user-4', unixepoch(), unixepoch());

-- ─── Currency (fossils) ─────────────────────────────────────────────

INSERT OR IGNORE INTO currency (id, user_id, fossils, updated_at)
VALUES ('dev-currency-1', 'dev-user-1', 20, unixepoch());

INSERT OR IGNORE INTO currency (id, user_id, fossils, updated_at)
VALUES ('dev-currency-2', 'dev-user-2', 150, unixepoch());

INSERT OR IGNORE INTO currency (id, user_id, fossils, updated_at)
VALUES ('dev-currency-3', 'dev-user-3', 500, unixepoch());

INSERT OR IGNORE INTO currency (id, user_id, fossils, updated_at)
VALUES ('dev-currency-4', 'dev-user-4', 75, unixepoch());

-- ─── Collections for dev-user-2 (FossilQueen — mid-game) ───────────

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-2a', 'dev-user-2', 'e3b12550114f2ac47e5a8', NULL, unixepoch(), 0, 0);
-- Compy (common)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-2b', 'dev-user-2', '73c2101cb11150082a6ac', NULL, unixepoch(), 0, 0);
-- Raptor-chan (uncommon)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-2c', 'dev-user-2', '93dceb99ae11326c2b94f', NULL, unixepoch(), 1, 0);
-- Velo-chan (rare)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-2d', 'dev-user-2', '948cb61dbae7e6b5bea3a', NULL, unixepoch(), 1, 1);
-- Tri-tan (epic)

-- ─── Collections for dev-user-3 (MesozoicMax — whale) ──────────────

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3a', 'dev-user-3', '5c526097fcdc46eb4c220', NULL, unixepoch(), 0, 0);
-- Trilobi-chan (common)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3b', 'dev-user-3', 'ff5c151ba5f7d38c1bac0', NULL, unixepoch(), 0, 0);
-- Iggy (uncommon)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3c', 'dev-user-3', '9f1da2a89c1bf3afafabb', NULL, unixepoch(), 0, 0);
-- Parasol (rare)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3d', 'dev-user-3', 'cd08a4eaabb034d94ecc3', NULL, unixepoch(), 0, 0);
-- Carno-chan (rare)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3e', 'dev-user-3', '162290ab40ff583160473', NULL, unixepoch(), 1, 0);
-- Stego-tan (epic)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3f', 'dev-user-3', 'b93aab5eb3f01fdd74c6f', NULL, unixepoch(), 1, 1);
-- Anky-chan (epic)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3g', 'dev-user-3', '06b921acce773fc9d5879', NULL, unixepoch(), 1, 1);
-- Rexy-chan (legendary)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3h', 'dev-user-3', '2d424bb39b8dbf6c85776', NULL, unixepoch(), 1, 1);
-- Brachy-chan (legendary)
