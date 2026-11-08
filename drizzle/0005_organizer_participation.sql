ALTER TABLE `users` ADD `is_participating` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `users`
SET `is_participating` = CASE WHEN `role` = 'participant' THEN 1 ELSE 0 END;