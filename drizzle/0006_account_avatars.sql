ALTER TABLE `users` ADD `avatar_key` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_mime_type` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_avatar_key_unique` ON `users` (`avatar_key`);