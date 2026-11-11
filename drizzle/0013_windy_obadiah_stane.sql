ALTER TABLE `users` ADD `last_login_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `previous_login_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `managed_by_user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `users_managed_by_idx` ON `users` (`managed_by_user_id`);