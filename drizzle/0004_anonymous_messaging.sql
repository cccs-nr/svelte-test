CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_assignment_unique` ON `conversations` (`assignment_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_side` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`giver_read_at` integer,
	`recipient_read_at` integer,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "messages_content_valid" CHECK(length(trim("messages"."content")) > 0 and length("messages"."content") <= 2000),
	CONSTRAINT "messages_sender_side_check" CHECK("messages"."sender_side" in ('giver', 'recipient'))
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_giver_unread_idx` ON `messages` (`conversation_id`,`sender_side`,`giver_read_at`);--> statement-breakpoint
CREATE INDEX `messages_recipient_unread_idx` ON `messages` (`conversation_id`,`sender_side`,`recipient_read_at`);