ALTER TABLE `events` ADD `revealed_at` integer;
--> statement-breakpoint
ALTER TABLE `events` ADD `revealed_by` text REFERENCES `users`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE `participant_codenames` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`codename` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `participant_codenames_codename_not_blank` CHECK (length(trim(`codename`)) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_codenames_event_user_unique` ON `participant_codenames` (`event_id`, `user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_codenames_event_codename_unique` ON `participant_codenames` (`event_id`, `codename`);
--> statement-breakpoint
WITH active_participants AS (
	SELECT
		`id`,
		row_number() OVER (ORDER BY random()) AS `position`
	FROM `users`
	WHERE `is_active` = 1 AND (`role` = 'participant' OR `is_participating` = 1)
),
names (`position`, `codename`) AS (
	VALUES
		(1, 'Frosty'),
		(2, 'Jingle'),
		(3, 'Tinsel'),
		(4, 'Mistletoe'),
		(5, 'Snowflake'),
		(6, 'Candy Cane'),
		(7, 'Gingerbread'),
		(8, 'Peppermint'),
		(9, 'Nutcracker'),
		(10, 'Snowball'),
		(11, 'Holly'),
		(12, 'Evergreen'),
		(13, 'Kringle'),
		(14, 'Reindeer'),
		(15, 'Yule'),
		(16, 'Twinkle'),
		(17, 'Blizzard'),
		(18, 'North Star'),
		(19, 'Sugarplum'),
		(20, 'Figgy Pudding')
)
INSERT INTO `participant_codenames` (`id`, `event_id`, `user_id`, `codename`, `created_at`, `updated_at`)
SELECT
	lower(hex(randomblob(16))),
	'main',
	`active_participants`.`id`,
	CASE
		WHEN `active_participants`.`position` <= 20 THEN
			(SELECT `codename` FROM `names` WHERE `position` = `active_participants`.`position`)
		ELSE
			(SELECT `codename` FROM `names` WHERE `position` = ((`active_participants`.`position` - 1) % 20) + 1)
				|| ' ' || CAST(((`active_participants`.`position` - 1) / 20) + 1 AS text)
	END,
	unixepoch() * 1000,
	unixepoch() * 1000
FROM `active_participants`;
--> statement-breakpoint
CREATE TABLE `gift_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`gift_suggestion_id` text NOT NULL REFERENCES `gift_suggestions`(`id`) ON DELETE RESTRICT,
	`reserver_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`status` text DEFAULT 'reserved' NOT NULL,
	`reserved_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`released_at` integer,
	`purchased_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `gift_reservations_status_check` CHECK (`status` IN ('reserved', 'released', 'purchased')),
	CONSTRAINT `gift_reservations_timestamps_check` CHECK (
		(`status` = 'reserved' AND `released_at` IS NULL AND `purchased_at` IS NULL) OR
		(`status` = 'released' AND `released_at` IS NOT NULL AND `purchased_at` IS NULL) OR
		(`status` = 'purchased' AND `released_at` IS NULL AND `purchased_at` IS NOT NULL)
	)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gift_reservations_active_suggestion_unique`
	ON `gift_reservations` (`gift_suggestion_id`)
	WHERE `status` IN ('reserved', 'purchased');
--> statement-breakpoint
CREATE INDEX `gift_reservations_reserver_status_idx`
	ON `gift_reservations` (`reserver_id`, `status`);
--> statement-breakpoint
CREATE TABLE `gift_reservation_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`reservation_id` text NOT NULL REFERENCES `gift_reservations`(`id`) ON DELETE CASCADE,
	`actor_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `gift_reservation_audit_log_status_check` CHECK (
		`from_status` IN ('reserved', 'released', 'purchased') AND
		`to_status` IN ('reserved', 'released', 'purchased')
	)
);
--> statement-breakpoint
CREATE INDEX `gift_reservation_audit_log_reservation_idx`
	ON `gift_reservation_audit_log` (`reservation_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `gift_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
	`recipient_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`type` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `gift_conversations_type_check` CHECK (`type` IN ('recipient_visible', 'private_coordination'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gift_conversations_event_recipient_type_unique`
	ON `gift_conversations` (`event_id`, `recipient_id`, `type`);
--> statement-breakpoint
CREATE INDEX `gift_conversations_event_type_idx`
	ON `gift_conversations` (`event_id`, `type`);
--> statement-breakpoint
CREATE TABLE `gift_conversation_participants` (
	`conversation_id` text NOT NULL REFERENCES `gift_conversations`(`id`) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`joined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY (`conversation_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `gift_conversation_participants_user_idx`
	ON `gift_conversation_participants` (`user_id`, `conversation_id`);
--> statement-breakpoint
CREATE TABLE `gift_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL REFERENCES `gift_conversations`(`id`) ON DELETE CASCADE,
	`sender_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `gift_messages_content_valid`
		CHECK (length(trim(`content`)) > 0 AND length(`content`) <= 2000)
);
--> statement-breakpoint
CREATE INDEX `gift_messages_conversation_created_idx`
	ON `gift_messages` (`conversation_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `gift_conversation_reads` (
	`conversation_id` text NOT NULL REFERENCES `gift_conversations`(`id`) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`last_read_at` integer NOT NULL,
	PRIMARY KEY (`conversation_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `gift_conversation_reads_user_idx`
	ON `gift_conversation_reads` (`user_id`);
--> statement-breakpoint
CREATE TABLE `codename_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
	`actor_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`target_user_id` text REFERENCES `users`(`id`) ON DELETE SET NULL,
	`action` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `codename_audit_log_action_check`
		CHECK (`action` IN ('mapping_accessed', 'codename_updated', 'reveal_started'))
);
--> statement-breakpoint
CREATE INDEX `codename_audit_log_event_created_idx`
	ON `codename_audit_log` (`event_id`, `created_at`);
