CREATE TABLE `_wishlist_conversation_merge_map` (
	`old_id` text PRIMARY KEY NOT NULL,
	`new_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `_wishlist_conversation_merge_map` (`old_id`, `new_id`)
SELECT
	conversation.`id`,
	CASE
		WHEN conversation.`conversation_type` = 'secret_santa' THEN COALESCE(
			(
				SELECT discussion.`id`
				FROM `wishlist_conversations` AS discussion
				WHERE discussion.`event_id` = conversation.`event_id`
					AND discussion.`wishlist_owner_id` = conversation.`wishlist_owner_id`
					AND discussion.`conversation_type` = 'wishlist_discussion'
			),
			conversation.`id`
		)
		ELSE conversation.`id`
	END
FROM `wishlist_conversations` AS conversation;
--> statement-breakpoint
CREATE TABLE `_wishlist_conversation_source_counts` AS
SELECT `new_id`, COUNT(*) AS `source_count`
FROM `_wishlist_conversation_merge_map`
GROUP BY `new_id`;
--> statement-breakpoint
INSERT OR IGNORE INTO `conversation_migration_reviews` (
	`id`, `legacy_source`, `legacy_conversation_id`, `related_user_id`, `reason`
)
SELECT
	'merge:' || conversation.`id` || ':' || participant.`user_id`,
	CASE conversation.`conversation_type`
		WHEN 'secret_santa' THEN 'assignment'
		ELSE 'gift'
	END,
	conversation.`id`,
	participant.`user_id`,
	CASE
		WHEN conversation.`conversation_type` = 'gift_coordination'
			AND participant.`user_id` = conversation.`wishlist_owner_id`
		THEN 'Wishlist owner was removed from private gift planning membership during consolidation.'
		ELSE 'Inactive or non-participating member was removed during consolidation.'
	END
FROM `wishlist_conversation_participants` AS participant
INNER JOIN `wishlist_conversations` AS conversation
	ON conversation.`id` = participant.`conversation_id`
INNER JOIN `users` AS member ON member.`id` = participant.`user_id`
WHERE
	(conversation.`conversation_type` = 'gift_coordination'
		AND participant.`user_id` = conversation.`wishlist_owner_id`)
	OR (
		NOT (
			conversation.`conversation_type` IN ('wishlist_discussion', 'secret_santa')
			AND participant.`user_id` = conversation.`wishlist_owner_id`
		)
		AND NOT (
			member.`is_active` = 1
			AND (member.`role` = 'participant' OR member.`is_participating` = 1)
		)
	);
--> statement-breakpoint
ALTER TABLE `wishlist_conversation_participants`
	RENAME TO `__legacy_wishlist_conversation_participants`;
--> statement-breakpoint
ALTER TABLE `wishlist_messages` RENAME TO `__legacy_wishlist_messages`;
--> statement-breakpoint
ALTER TABLE `wishlist_conversations` RENAME TO `__legacy_wishlist_conversations`;
--> statement-breakpoint
CREATE TABLE `wishlist_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL REFERENCES `events`(`id`) ON DELETE CASCADE,
	`wishlist_owner_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`conversation_type` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_message_at` integer,
	CONSTRAINT `wishlist_conversations_type_check`
		CHECK (`conversation_type` IN ('wishlist_discussion', 'gift_coordination')),
	CONSTRAINT `wishlist_conversations_title_not_blank` CHECK (length(trim(`title`)) > 0)
);
--> statement-breakpoint
CREATE TABLE `wishlist_conversation_participants` (
	`conversation_id` text NOT NULL REFERENCES `wishlist_conversations`(`id`) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
	`joined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_read_at` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY (`conversation_id`, `user_id`)
);
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
INSERT INTO `wishlist_conversations` (
	`id`, `event_id`, `wishlist_owner_id`, `conversation_type`, `title`,
	`created_at`, `updated_at`, `last_message_at`
)
SELECT
	MIN(merge_map.`new_id`),
	conversation.`event_id`,
	conversation.`wishlist_owner_id`,
	CASE conversation.`conversation_type`
		WHEN 'secret_santa' THEN 'wishlist_discussion'
		ELSE conversation.`conversation_type`
	END,
	owner.`display_name` || ' — ' ||
		CASE conversation.`conversation_type`
			WHEN 'gift_coordination' THEN 'Private gift planning'
			ELSE 'Talk to ' || owner.`display_name`
		END,
	MIN(conversation.`created_at`),
	MAX(
		CASE
			WHEN message.`created_at` > conversation.`updated_at`
			THEN message.`created_at`
			ELSE conversation.`updated_at`
		END
	),
	MAX(
		CASE
			WHEN message.`created_at` IS NOT NULL
				AND (
					conversation.`last_message_at` IS NULL
					OR message.`created_at` > conversation.`last_message_at`
				)
			THEN message.`created_at`
			ELSE conversation.`last_message_at`
		END
	)
FROM `__legacy_wishlist_conversations` AS conversation
INNER JOIN `_wishlist_conversation_merge_map` AS merge_map
	ON merge_map.`old_id` = conversation.`id`
INNER JOIN `users` AS owner ON owner.`id` = conversation.`wishlist_owner_id`
LEFT JOIN `__legacy_wishlist_messages` AS message
	ON message.`conversation_id` = conversation.`id`
GROUP BY
	conversation.`event_id`,
	conversation.`wishlist_owner_id`,
	CASE conversation.`conversation_type`
		WHEN 'secret_santa' THEN 'wishlist_discussion'
		ELSE conversation.`conversation_type`
	END,
	owner.`display_name`;
--> statement-breakpoint
INSERT INTO `wishlist_conversation_participants` (
	`conversation_id`, `user_id`, `joined_at`, `last_read_at`
)
SELECT
	merge_map.`new_id`,
	participant.`user_id`,
	MIN(participant.`joined_at`),
	CASE
		WHEN COUNT(DISTINCT participant.`conversation_id`) < source_count.`source_count` THEN 0
		ELSE MIN(participant.`last_read_at`)
	END
FROM `__legacy_wishlist_conversation_participants` AS participant
INNER JOIN `__legacy_wishlist_conversations` AS conversation
	ON conversation.`id` = participant.`conversation_id`
INNER JOIN `_wishlist_conversation_merge_map` AS merge_map
	ON merge_map.`old_id` = conversation.`id`
INNER JOIN `_wishlist_conversation_source_counts` AS source_count
	ON source_count.`new_id` = merge_map.`new_id`
INNER JOIN `users` AS member ON member.`id` = participant.`user_id`
WHERE
	NOT (
		conversation.`conversation_type` = 'gift_coordination'
		AND participant.`user_id` = conversation.`wishlist_owner_id`
	)
	AND (
		(
			conversation.`conversation_type` IN ('wishlist_discussion', 'secret_santa')
			AND participant.`user_id` = conversation.`wishlist_owner_id`
		)
		OR (
			member.`is_active` = 1
			AND (member.`role` = 'participant' OR member.`is_participating` = 1)
		)
	)
GROUP BY merge_map.`new_id`, participant.`user_id`, source_count.`source_count`;
--> statement-breakpoint
INSERT OR IGNORE INTO `wishlist_conversation_participants` (
	`conversation_id`, `user_id`, `joined_at`, `last_read_at`
)
SELECT
	conversation.`id`,
	conversation.`wishlist_owner_id`,
	conversation.`created_at`,
	0
FROM `wishlist_conversations` AS conversation
WHERE conversation.`conversation_type` = 'wishlist_discussion';
--> statement-breakpoint
INSERT INTO `wishlist_messages` (
	`id`, `conversation_id`, `sender_id`, `content`, `created_at`, `edited_at`
)
SELECT
	message.`id`,
	merge_map.`new_id`,
	message.`sender_id`,
	message.`content`,
	message.`created_at`,
	message.`edited_at`
FROM `__legacy_wishlist_messages` AS message
INNER JOIN `_wishlist_conversation_merge_map` AS merge_map
	ON merge_map.`old_id` = message.`conversation_id`;
--> statement-breakpoint
DROP TABLE `__legacy_wishlist_messages`;
--> statement-breakpoint
DROP TABLE `__legacy_wishlist_conversation_participants`;
--> statement-breakpoint
DROP TABLE `__legacy_wishlist_conversations`;
--> statement-breakpoint
DROP TABLE `_wishlist_conversation_merge_map`;
--> statement-breakpoint
DROP TABLE `_wishlist_conversation_source_counts`;
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlist_conversations_event_owner_type_unique`
	ON `wishlist_conversations` (`event_id`, `wishlist_owner_id`, `conversation_type`);
--> statement-breakpoint
CREATE INDEX `wishlist_conversations_event_activity_idx`
	ON `wishlist_conversations` (`event_id`, `last_message_at`, `updated_at`);
--> statement-breakpoint
CREATE INDEX `wishlist_conversation_participants_user_idx`
	ON `wishlist_conversation_participants` (`user_id`, `conversation_id`);
--> statement-breakpoint
CREATE INDEX `wishlist_messages_conversation_created_idx`
	ON `wishlist_messages` (`conversation_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `wishlist_messages_sender_created_idx`
	ON `wishlist_messages` (`sender_id`, `created_at`);
