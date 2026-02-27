ALTER TABLE `creature` ADD `image_aspect_ratio` real;--> statement-breakpoint
CREATE INDEX `trade_offer_status_idx` ON `trade_offer` (`status`);--> statement-breakpoint
CREATE INDEX `trade_offer_offerer_idx` ON `trade_offer` (`offerer_id`);--> statement-breakpoint
CREATE INDEX `uc_user_id_idx` ON `user_creature` (`user_id`);