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

INSERT OR IGNORE INTO user (id, name, email, emailVerified, image, createdAt, updatedAt, role)
VALUES ('dev-user-5', 'AdminRex', 'dev5@paleowaifu.test', 0, 'https://api.dicebear.com/9.x/thumbs/svg?seed=AdminRex', unixepoch(), unixepoch(), 'admin');

-- ─── Discord OAuth accounts (fake provider entries) ─────────────────

INSERT OR IGNORE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
VALUES ('dev-account-1', '100000000000000001', 'discord', 'dev-user-1', unixepoch(), unixepoch());

INSERT OR IGNORE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
VALUES ('dev-account-2', '100000000000000002', 'discord', 'dev-user-2', unixepoch(), unixepoch());

INSERT OR IGNORE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
VALUES ('dev-account-3', '100000000000000003', 'discord', 'dev-user-3', unixepoch(), unixepoch());

INSERT OR IGNORE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
VALUES ('dev-account-4', '100000000000000004', 'discord', 'dev-user-4', unixepoch(), unixepoch());

INSERT OR IGNORE INTO account (id, accountId, providerId, userId, createdAt, updatedAt)
VALUES ('dev-account-5', '100000000000000005', 'discord', 'dev-user-5', unixepoch(), unixepoch());

-- ─── Currency (fossils) ─────────────────────────────────────────────

INSERT OR IGNORE INTO currency (id, user_id, fossils, updated_at)
VALUES ('dev-currency-1', 'dev-user-1', 20, unixepoch());

INSERT OR IGNORE INTO currency (id, user_id, fossils, updated_at)
VALUES ('dev-currency-2', 'dev-user-2', 150, unixepoch());

INSERT OR IGNORE INTO currency (id, user_id, fossils, updated_at)
VALUES ('dev-currency-3', 'dev-user-3', 500, unixepoch());

INSERT OR IGNORE INTO currency (id, user_id, fossils, updated_at)
VALUES ('dev-currency-4', 'dev-user-4', 75, unixepoch());

INSERT OR IGNORE INTO currency (id, user_id, fossils, updated_at)
VALUES ('dev-currency-5', 'dev-user-5', 9999, unixepoch());

-- ─── Collections for dev-user-2 (FossilQueen — mid-game) ───────────

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-2a', 'dev-user-2', '562c2967d043c0cf11aef', NULL, unixepoch(), 0, 0);
-- Achillobator (common)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-2b', 'dev-user-2', '73c2101cb11150082a6ac', NULL, unixepoch(), 0, 0);
-- Deinonychus (epic)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-2c', 'dev-user-2', '7e9d3072faa34a482239a', NULL, unixepoch(), 1, 0);
-- Alamosaurus (rare)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-2d', 'dev-user-2', '001ba030720b0583fdadb', NULL, unixepoch(), 1, 1);
-- Allosaurus (epic)

-- ─── Collections for dev-user-3 (MesozoicMax — whale) ──────────────

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3a', 'dev-user-3', '2ed0a2a127b9daaeae62d', NULL, unixepoch(), 0, 0);
-- Agilisaurus (common)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3b', 'dev-user-3', 'a3f9623817f9deddd9e00', NULL, unixepoch(), 0, 0);
-- Aardonyx (uncommon)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3c', 'dev-user-3', 'e296fc855c7c5eb18d525', NULL, unixepoch(), 0, 0);
-- Apatosaurus (rare)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3d', 'dev-user-3', 'cd08a4eaabb034d94ecc3', NULL, unixepoch(), 0, 0);
-- Carnotaurus (epic)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3e', 'dev-user-3', 'b93aab5eb3f01fdd74c6f', NULL, unixepoch(), 1, 0);
-- Ankylosaurus (epic)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3f', 'dev-user-3', '2eaa4cbac5a71f5adb46c', NULL, unixepoch(), 1, 1);
-- Diplodocus (epic)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3g', 'dev-user-3', '8d2d6a354f29a724a74f4', NULL, unixepoch(), 1, 1);
-- Spinosaurus (legendary)

INSERT OR IGNORE INTO user_creature (id, user_id, creature_id, banner_id, pulled_at, is_favorite, is_locked)
VALUES ('dev-uc-3h', 'dev-user-3', '2d424bb39b8dbf6c85776', NULL, unixepoch(), 1, 1);
-- Brachiosaurus (legendary)
