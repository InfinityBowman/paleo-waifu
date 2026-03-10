DROP TABLE `battle_challenge`;--> statement-breakpoint
DROP TABLE `battle_team_preset`;--> statement-breakpoint
ALTER TABLE `creature` ADD `slug` text;--> statement-breakpoint
CREATE UNIQUE INDEX `creature_slug_idx` ON `creature` (`slug`);