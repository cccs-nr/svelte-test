CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`giver_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finalized_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`giver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "assignments_no_self_check" CHECK("assignments"."giver_id" <> "assignments"."receiver_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignments_event_giver_unique` ON `assignments` (`event_id`,`giver_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `assignments_event_receiver_unique` ON `assignments` (`event_id`,`receiver_id`);--> statement-breakpoint
CREATE INDEX `assignments_giver_id_idx` ON `assignments` (`giver_id`);