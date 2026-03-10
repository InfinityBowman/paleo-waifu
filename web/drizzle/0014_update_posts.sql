CREATE TABLE `update_post` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`tag` text,
	`published_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `up_published_at_idx` ON `update_post` (`published_at`);
--> statement-breakpoint
CREATE INDEX `up_tag_idx` ON `update_post` (`tag`);
