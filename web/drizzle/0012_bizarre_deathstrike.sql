CREATE TABLE `battle_team_preset` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`members` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `btp_user_id_idx` ON `battle_team_preset` (`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_battle_rating` (
	`user_id` text PRIMARY KEY NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_battle_rating`("user_id", "rating", "wins", "losses", "updated_at") SELECT "user_id", "rating", "wins", "losses", "updated_at" FROM `battle_rating`;--> statement-breakpoint
DROP TABLE `battle_rating`;--> statement-breakpoint
ALTER TABLE `__new_battle_rating` RENAME TO `battle_rating`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `battle_challenge` ADD `discord_message_id` text;--> statement-breakpoint
ALTER TABLE `battle_challenge` ADD `discord_channel_id` text;