CREATE TABLE `ability_template` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`target` text,
	`multiplier` real,
	`cooldown` integer,
	`duration` integer,
	`stat_affected` text,
	`effect_value` real,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `battle_challenge` (
	`id` text PRIMARY KEY NOT NULL,
	`challenger_id` text NOT NULL,
	`defender_id` text NOT NULL,
	`status` text NOT NULL,
	`challenger_team` text NOT NULL,
	`defender_team` text,
	`result` text,
	`winner_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	`resolved_at` integer,
	FOREIGN KEY (`challenger_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`defender_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bc_challenger_id_idx` ON `battle_challenge` (`challenger_id`);--> statement-breakpoint
CREATE INDEX `bc_defender_id_idx` ON `battle_challenge` (`defender_id`);--> statement-breakpoint
CREATE INDEX `bc_status_idx` ON `battle_challenge` (`status`);--> statement-breakpoint
CREATE TABLE `battle_rating` (
	`user_id` text PRIMARY KEY NOT NULL,
	`rating` integer DEFAULT 1000 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `creature_ability` (
	`id` text PRIMARY KEY NOT NULL,
	`creature_id` text NOT NULL,
	`template_id` text NOT NULL,
	`slot` text NOT NULL,
	`display_name` text NOT NULL,
	FOREIGN KEY (`creature_id`) REFERENCES `creature`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `ability_template`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ca_creature_slot_idx` ON `creature_ability` (`creature_id`,`slot`);--> statement-breakpoint
CREATE INDEX `ca_creature_id_idx` ON `creature_ability` (`creature_id`);--> statement-breakpoint
CREATE TABLE `creature_battle_stats` (
	`creature_id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`hp` integer NOT NULL,
	`atk` integer NOT NULL,
	`def` integer NOT NULL,
	`spd` integer NOT NULL,
	`abl` integer NOT NULL,
	FOREIGN KEY (`creature_id`) REFERENCES `creature`(`id`) ON UPDATE no action ON DELETE no action
);
