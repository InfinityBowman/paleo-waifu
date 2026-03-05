CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `banner` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`image_url` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`is_active` integer DEFAULT true,
	`rate_up_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`rate_up_id`) REFERENCES `creature`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `banner_pool` (
	`id` text PRIMARY KEY NOT NULL,
	`banner_id` text NOT NULL,
	`creature_id` text NOT NULL,
	FOREIGN KEY (`banner_id`) REFERENCES `banner`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creature_id`) REFERENCES `creature`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `creature` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`scientific_name` text NOT NULL,
	`era` text NOT NULL,
	`period` text,
	`diet` text NOT NULL,
	`size_meters` real,
	`weight_kg` real,
	`rarity` text NOT NULL,
	`description` text NOT NULL,
	`fun_facts` text,
	`image_url` text,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `currency` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`fossils` integer DEFAULT 0 NOT NULL,
	`last_daily_claim` integer,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `currency_user_id_unique` ON `currency` (`user_id`);--> statement-breakpoint
CREATE TABLE `pity_counter` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`banner_id` text NOT NULL,
	`pulls_since_rare` integer DEFAULT 0 NOT NULL,
	`pulls_since_legendary` integer DEFAULT 0 NOT NULL,
	`total_pulls` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`banner_id`) REFERENCES `banner`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pity_user_banner_idx` ON `pity_counter` (`user_id`,`banner_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `trade_history` (
	`id` text PRIMARY KEY NOT NULL,
	`trade_offer_id` text NOT NULL,
	`giver_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`given_creature_id` text NOT NULL,
	`received_creature_id` text NOT NULL,
	`completed_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`trade_offer_id`) REFERENCES `trade_offer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`giver_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`given_creature_id`) REFERENCES `user_creature`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_creature_id`) REFERENCES `user_creature`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trade_offer` (
	`id` text PRIMARY KEY NOT NULL,
	`offerer_id` text NOT NULL,
	`receiver_id` text,
	`offered_creature_id` text NOT NULL,
	`wanted_creature_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`expires_at` integer,
	FOREIGN KEY (`offerer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`offered_creature_id`) REFERENCES `user_creature`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wanted_creature_id`) REFERENCES `creature`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false,
	`image` text,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_creature` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`creature_id` text NOT NULL,
	`banner_id` text,
	`pulled_at` integer DEFAULT (unixepoch()),
	`is_favorite` integer DEFAULT false,
	`is_locked` integer DEFAULT false,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creature_id`) REFERENCES `creature`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`banner_id`) REFERENCES `banner`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `wishlist` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`creature_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creature_id`) REFERENCES `creature`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlist_user_creature_idx` ON `wishlist` (`user_id`,`creature_id`);