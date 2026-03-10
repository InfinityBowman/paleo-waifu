CREATE TABLE `battle_log` (
	`id` text PRIMARY KEY NOT NULL,
	`attacker_id` text NOT NULL,
	`defender_id` text NOT NULL,
	`mode` text NOT NULL,
	`attacker_team` text NOT NULL,
	`defender_team` text NOT NULL,
	`result` text NOT NULL,
	`winner_id` text,
	`rating_change` integer,
	`discord_message_id` text,
	`discord_channel_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`attacker_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`defender_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bl_attacker_id_idx` ON `battle_log` (`attacker_id`);--> statement-breakpoint
CREATE INDEX `bl_defender_id_idx` ON `battle_log` (`defender_id`);--> statement-breakpoint
CREATE INDEX `bl_mode_idx` ON `battle_log` (`mode`);--> statement-breakpoint
CREATE TABLE `battle_team` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slot` text NOT NULL,
	`members` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bt_user_slot_idx` ON `battle_team` (`user_id`,`slot`);--> statement-breakpoint
ALTER TABLE `battle_rating` ADD `arena_attacks_today` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `battle_rating` ADD `last_attack_date` text;