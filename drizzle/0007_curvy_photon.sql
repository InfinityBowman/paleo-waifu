CREATE TABLE `user_xp` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_xp_user_id_unique` ON `user_xp` (`user_id`);