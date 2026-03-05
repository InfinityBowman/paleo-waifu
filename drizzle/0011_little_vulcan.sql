PRAGMA foreign_keys=OFF;--> statement-breakpoint
DELETE FROM `creature_ability`;--> statement-breakpoint
DROP TABLE `ability_template`;--> statement-breakpoint
CREATE TABLE `__new_creature_ability` (
	`id` text PRIMARY KEY NOT NULL,
	`creature_id` text NOT NULL,
	`template_id` text NOT NULL,
	`slot` text NOT NULL,
	`display_name` text NOT NULL,
	FOREIGN KEY (`creature_id`) REFERENCES `creature`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
DROP TABLE `creature_ability`;--> statement-breakpoint
ALTER TABLE `__new_creature_ability` RENAME TO `creature_ability`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `ca_creature_slot_idx` ON `creature_ability` (`creature_id`,`slot`);--> statement-breakpoint
CREATE INDEX `ca_creature_id_idx` ON `creature_ability` (`creature_id`);--> statement-breakpoint
ALTER TABLE `creature_battle_stats` DROP COLUMN `abl`;
