CREATE TABLE `trade_proposal` (
	`id` text PRIMARY KEY NOT NULL,
	`trade_id` text NOT NULL,
	`proposer_id` text NOT NULL,
	`proposer_creature_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`trade_id`) REFERENCES `trade_offer`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposer_creature_id`) REFERENCES `user_creature`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tp_trade_proposer_idx` ON `trade_proposal` (`trade_id`,`proposer_id`);--> statement-breakpoint
CREATE INDEX `tp_trade_id_idx` ON `trade_proposal` (`trade_id`);--> statement-breakpoint
CREATE INDEX `tp_proposer_id_idx` ON `trade_proposal` (`proposer_id`);