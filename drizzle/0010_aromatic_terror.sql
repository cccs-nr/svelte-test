CREATE TABLE `conversation_migration_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`legacy_source` text NOT NULL,
	`legacy_conversation_id` text NOT NULL,
	`related_user_id` text,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`related_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `conversation_migration_reviews_source_check` CHECK (`legacy_source` IN ('assignment', 'gift')),
	CONSTRAINT `conversation_migration_reviews_reason_not_blank` CHECK (length(trim(`reason`)) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_migration_reviews_issue_unique`
	ON `conversation_migration_reviews` (`legacy_source`, `legacy_conversation_id`, `related_user_id`, `reason`);
--> statement-breakpoint
CREATE INDEX `conversation_migration_reviews_status_idx`
	ON `conversation_migration_reviews` (`resolved_at`, `created_at`);
--> statement-breakpoint
CREATE TABLE `wishlist_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
	`wishlist_owner_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`conversation_type` text NOT NULL,
	`title` text NOT NULL,
	`assignment_id` text REFERENCES `assignments`(`id`) ON DELETE CASCADE,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_message_at` integer,
	CONSTRAINT `wishlist_conversations_type_check`
		CHECK (`conversation_type` IN ('wishlist_discussion', 'gift_coordination', 'secret_santa')),
	CONSTRAINT `wishlist_conversations_assignment_type_check`
		CHECK (
			(`conversation_type` = 'secret_santa' AND `assignment_id` IS NOT NULL) OR
			(`conversation_type` <> 'secret_santa' AND `assignment_id` IS NULL)
		),
	CONSTRAINT `wishlist_conversations_title_not_blank` CHECK (length(trim(`title`)) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlist_conversations_event_owner_type_unique`
	ON `wishlist_conversations` (`event_id`, `wishlist_owner_id`, `conversation_type`);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlist_conversations_assignment_unique`
	ON `wishlist_conversations` (`assignment_id`) WHERE `assignment_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `wishlist_conversations_event_activity_idx`
	ON `wishlist_conversations` (`event_id`, `last_message_at`, `updated_at`);
--> statement-breakpoint
CREATE TABLE `wishlist_conversation_participants` (
	`conversation_id` text NOT NULL REFERENCES `wishlist_conversations`(`id`) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`joined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_read_at` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY (`conversation_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `wishlist_conversation_participants_user_idx`
	ON `wishlist_conversation_participants` (`user_id`, `conversation_id`);
--> statement-breakpoint
CREATE TABLE `wishlist_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL REFERENCES `wishlist_conversations`(`id`) ON DELETE CASCADE,
	`sender_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`edited_at` integer,
	CONSTRAINT `wishlist_messages_content_valid`
		CHECK (length(trim(`content`)) > 0 AND length(`content`) <= 2000)
);
--> statement-breakpoint
CREATE INDEX `wishlist_messages_conversation_created_idx`
	ON `wishlist_messages` (`conversation_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `wishlist_messages_sender_created_idx`
	ON `wishlist_messages` (`sender_id`, `created_at`);
--> statement-breakpoint
INSERT INTO `wishlist_conversations` (
	`id`, `event_id`, `wishlist_owner_id`, `conversation_type`, `title`, `assignment_id`,
	`created_at`, `updated_at`, `last_message_at`
)
SELECT
	lower(hex(randomblob(16))),
	a.`event_id`,
	a.`receiver_id`,
	'secret_santa',
	owner.`display_name` || '''s Wishlist — Secret Santa',
	a.`id`,
	COALESCE(legacy.`created_at`, a.`finalized_at`, a.`created_at`),
	max(
		COALESCE(legacy.`updated_at`, a.`created_at`),
		COALESCE(MAX(message.`created_at`), a.`created_at`)
	),
	MAX(message.`created_at`)
FROM `assignments` AS a
INNER JOIN `users` AS owner ON owner.`id` = a.`receiver_id`
LEFT JOIN `conversations` AS legacy ON legacy.`assignment_id` = a.`id`
LEFT JOIN `messages` AS message ON message.`conversation_id` = legacy.`id`
WHERE legacy.`id` IS NOT NULL OR a.`finalized_at` IS NOT NULL
GROUP BY a.`id`;
--> statement-breakpoint
INSERT INTO `wishlist_conversations` (
	`id`, `event_id`, `wishlist_owner_id`, `conversation_type`, `title`, `assignment_id`,
	`created_at`, `updated_at`, `last_message_at`
)
SELECT
	legacy.`id`,
	legacy.`event_id`,
	legacy.`recipient_id`,
	CASE legacy.`type`
		WHEN 'recipient_visible' THEN 'wishlist_discussion'
		ELSE 'gift_coordination'
	END,
	owner.`display_name` || '''s Wishlist — ' ||
		CASE legacy.`type`
			WHEN 'recipient_visible' THEN 'Wishlist Discussion'
			ELSE 'Gift Coordination'
		END,
	NULL,
	legacy.`created_at`,
	max(legacy.`updated_at`, COALESCE(MAX(message.`created_at`), legacy.`updated_at`)),
	MAX(message.`created_at`)
FROM `gift_conversations` AS legacy
INNER JOIN `users` AS owner ON owner.`id` = legacy.`recipient_id`
LEFT JOIN `gift_messages` AS message ON message.`conversation_id` = legacy.`id`
GROUP BY legacy.`id`;
--> statement-breakpoint
INSERT INTO `wishlist_conversation_participants` (
	`conversation_id`, `user_id`, `joined_at`, `last_read_at`
)
SELECT
	conversation.`id`,
	a.`giver_id`,
	COALESCE(legacy.`created_at`, a.`finalized_at`, a.`created_at`),
	COALESCE(MAX(message.`giver_read_at`), 0)
FROM `wishlist_conversations` AS conversation
INNER JOIN `assignments` AS a ON a.`id` = conversation.`assignment_id`
LEFT JOIN `conversations` AS legacy ON legacy.`assignment_id` = a.`id`
LEFT JOIN `messages` AS message ON message.`conversation_id` = legacy.`id`
WHERE conversation.`conversation_type` = 'secret_santa'
GROUP BY conversation.`id`;
--> statement-breakpoint
INSERT INTO `wishlist_conversation_participants` (
	`conversation_id`, `user_id`, `joined_at`, `last_read_at`
)
SELECT
	conversation.`id`,
	a.`receiver_id`,
	COALESCE(legacy.`created_at`, a.`finalized_at`, a.`created_at`),
	COALESCE(MAX(message.`recipient_read_at`), 0)
FROM `wishlist_conversations` AS conversation
INNER JOIN `assignments` AS a ON a.`id` = conversation.`assignment_id`
LEFT JOIN `conversations` AS legacy ON legacy.`assignment_id` = a.`id`
LEFT JOIN `messages` AS message ON message.`conversation_id` = legacy.`id`
WHERE conversation.`conversation_type` = 'secret_santa'
GROUP BY conversation.`id`;
--> statement-breakpoint
INSERT INTO `wishlist_conversation_participants` (
	`conversation_id`, `user_id`, `joined_at`, `last_read_at`
)
SELECT
	legacy.`conversation_id`,
	legacy.`user_id`,
	legacy.`joined_at`,
	COALESCE(read_marker.`last_read_at`, 0)
FROM `gift_conversation_participants` AS legacy
INNER JOIN `wishlist_conversations` AS conversation ON conversation.`id` = legacy.`conversation_id`
INNER JOIN `users` AS member ON member.`id` = legacy.`user_id`
LEFT JOIN `gift_conversation_reads` AS read_marker
	ON read_marker.`conversation_id` = legacy.`conversation_id`
	AND read_marker.`user_id` = legacy.`user_id`
WHERE
	(member.`is_active` = 1 AND (member.`role` = 'participant' OR member.`is_participating` = 1))
	AND NOT (
		conversation.`conversation_type` = 'gift_coordination'
		AND legacy.`user_id` = conversation.`wishlist_owner_id`
	);
--> statement-breakpoint
INSERT OR IGNORE INTO `wishlist_conversation_participants` (
	`conversation_id`, `user_id`, `joined_at`, `last_read_at`
)
SELECT
	conversation.`id`,
	conversation.`wishlist_owner_id`,
	conversation.`created_at`,
	COALESCE(read_marker.`last_read_at`, 0)
FROM `wishlist_conversations` AS conversation
LEFT JOIN `gift_conversation_reads` AS read_marker
	ON read_marker.`conversation_id` = conversation.`id`
	AND read_marker.`user_id` = conversation.`wishlist_owner_id`
WHERE conversation.`conversation_type` = 'wishlist_discussion';
--> statement-breakpoint
INSERT INTO `wishlist_messages` (`id`, `conversation_id`, `sender_id`, `content`, `created_at`)
SELECT
	'santa:' || message.`id`,
	conversation.`id`,
	CASE message.`sender_side`
		WHEN 'giver' THEN assignment.`giver_id`
		ELSE assignment.`receiver_id`
	END,
	message.`content`,
	message.`created_at`
FROM `messages` AS message
INNER JOIN `conversations` AS legacy
	ON legacy.`id` = message.`conversation_id`
INNER JOIN `assignments` AS assignment
	ON assignment.`id` = legacy.`assignment_id`
INNER JOIN `wishlist_conversations` AS conversation
	ON conversation.`assignment_id` = assignment.`id`
WHERE conversation.`conversation_type` = 'secret_santa';
--> statement-breakpoint
INSERT INTO `wishlist_messages` (`id`, `conversation_id`, `sender_id`, `content`, `created_at`)
SELECT
	'gift:' || message.`id`,
	conversation.`id`,
	message.`sender_id`,
	message.`content`,
	message.`created_at`
FROM `gift_messages` AS message
INNER JOIN `wishlist_conversations` AS conversation
	ON conversation.`id` = message.`conversation_id`;
--> statement-breakpoint
INSERT INTO `conversation_migration_reviews` (
	`id`, `legacy_source`, `legacy_conversation_id`, `related_user_id`, `reason`
)
SELECT
	'gift:' || legacy.`id` || ':' || participant.`user_id` || ':excluded',
	'gift',
	legacy.`id`,
	participant.`user_id`,
	CASE
		WHEN participant.`user_id` = legacy.`recipient_id`
			AND legacy.`type` = 'private_coordination'
		THEN 'Wishlist owner was removed from Gift Coordination membership.'
		ELSE 'Inactive or non-participating member was removed during migration.'
	END
FROM `gift_conversation_participants` AS participant
INNER JOIN `gift_conversations` AS legacy
	ON legacy.`id` = participant.`conversation_id`
INNER JOIN `users` AS member ON member.`id` = participant.`user_id`
WHERE NOT EXISTS (
	SELECT 1
	FROM `wishlist_conversation_participants` AS migrated
	WHERE migrated.`conversation_id` = legacy.`id`
	AND migrated.`user_id` = participant.`user_id`
);
