import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import type { UserRole } from '#lib/auth.js';
import type { EventStatus } from '#lib/models/event.js';

export const households = sqliteTable(
	'households',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		uniqueIndex('households_name_unique').on(sql`lower(${table.name})`),
		check('households_name_not_blank', sql`length(trim(${table.name})) > 0`)
	]
);

export const events = sqliteTable(
	'events',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		exchangeDate: text('exchange_date').notNull(),
		giftBudgetCents: integer('gift_budget_cents').notNull(),
		currency: text('currency', { enum: ['CAD'] })
			.notNull()
			.default('CAD'),
		instructions: text('instructions').notNull().default(''),
		status: text('status', {
			enum: ['setup', 'open', 'assignments_generated', 'completed']
		})
			.$type<EventStatus>()
			.notNull()
			.default('setup'),
		revealedAt: integer('revealed_at', { mode: 'timestamp_ms' }),
		revealedBy: text('revealed_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		check('events_single_event_check', sql`${table.id} = 'main'`),
		check('events_name_not_blank', sql`length(trim(${table.name})) > 0`),
		check('events_budget_nonnegative_check', sql`${table.giftBudgetCents} >= 0`),
		check('events_currency_check', sql`${table.currency} = 'CAD'`),
		check(
			'events_status_check',
			sql`${table.status} in ('setup', 'open', 'assignments_generated', 'completed')`
		),
		check(
			'events_exchange_date_check',
			sql`strftime('%Y-%m-%d', ${table.exchangeDate}) is not null and strftime('%Y-%m-%d', ${table.exchangeDate}) = ${table.exchangeDate}`
		)
	]
);

export const users = sqliteTable(
	'users',
	{
		id: text('id').primaryKey(),
		username: text('username').notNull(),
		displayName: text('display_name').notNull(),
		passwordHash: text('password_hash').notNull(),
		avatarKey: text('avatar_key'),
		avatarMimeType: text('avatar_mime_type', {
			enum: ['image/jpeg', 'image/png', 'image/webp']
		}),
		role: text('role', { enum: ['organizer', 'participant'] })
			.$type<UserRole>()
			.notNull(),
		isParticipating: integer('is_participating', { mode: 'boolean' }).notNull().default(false),
		householdId: text('household_id').references(() => households.id, { onDelete: 'set null' }),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		welcomeAcknowledgedAt: integer('welcome_acknowledged_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		uniqueIndex('users_username_unique').on(table.username),
		uniqueIndex('users_avatar_key_unique').on(table.avatarKey),
		index('users_household_id_idx').on(table.householdId),
		check('users_role_check', sql`${table.role} in ('organizer', 'participant')`)
	]
);

export const participantCodenames = sqliteTable(
	'participant_codenames',
	{
		id: text('id').primaryKey(),
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		codename: text('codename').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		uniqueIndex('participant_codenames_event_user_unique').on(table.eventId, table.userId),
		uniqueIndex('participant_codenames_event_codename_unique').on(table.eventId, table.codename),
		check('participant_codenames_codename_not_blank', sql`length(trim(${table.codename})) > 0`)
	]
);

export const codenameAuditLog = sqliteTable(
	'codename_audit_log',
	{
		id: text('id').primaryKey(),
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		actorId: text('actor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }),
		action: text('action', {
			enum: ['mapping_accessed', 'codename_updated', 'reveal_started']
		})
			.$type<'mapping_accessed' | 'codename_updated' | 'reveal_started'>()
			.notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		index('codename_audit_log_event_created_idx').on(table.eventId, table.createdAt),
		check(
			'codename_audit_log_action_check',
			sql`${table.action} in ('mapping_accessed', 'codename_updated', 'reveal_started')`
		)
	]
);

export const assignments = sqliteTable(
	'assignments',
	{
		id: text('id').primaryKey(),
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		giverId: text('giver_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		receiverId: text('receiver_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		finalizedAt: integer('finalized_at', { mode: 'timestamp_ms' }),
		giftPurchasedAt: integer('gift_purchased_at', { mode: 'timestamp_ms' }),
		giverWishlistViewedAt: integer('giver_wishlist_viewed_at', { mode: 'timestamp_ms' }),
		receiverGiftStatusSeenAt: integer('receiver_gift_status_seen_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		uniqueIndex('assignments_event_giver_unique').on(table.eventId, table.giverId),
		uniqueIndex('assignments_event_receiver_unique').on(table.eventId, table.receiverId),
		index('assignments_giver_id_idx').on(table.giverId),
		check('assignments_no_self_check', sql`${table.giverId} <> ${table.receiverId}`)
	]
);

export const giftSuggestions = sqliteTable(
	'gift_suggestions',
	{
		id: text('id').primaryKey(),
		ownerId: text('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description').notNull().default(''),
		url: text('url'),
		imageKey: text('image_key'),
		imageMimeType: text('image_mime_type', {
			enum: ['image/jpeg', 'image/png', 'image/webp']
		}),
		estimatedPriceCents: integer('estimated_price_cents'),
		notes: text('notes').notNull().default(''),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		index('gift_suggestions_owner_updated_idx').on(table.ownerId, table.updatedAt),
		uniqueIndex('gift_suggestions_image_key_unique').on(table.imageKey),
		check('gift_suggestions_title_not_blank', sql`length(trim(${table.title})) > 0`),
		check(
			'gift_suggestions_price_nonnegative',
			sql`${table.estimatedPriceCents} is null or ${table.estimatedPriceCents} >= 0`
		),
		check(
			'gift_suggestions_image_pair_check',
			sql`(${table.imageKey} is null) = (${table.imageMimeType} is null)`
		),
		check(
			'gift_suggestions_image_mime_check',
			sql`${table.imageMimeType} is null or ${table.imageMimeType} in ('image/jpeg', 'image/png', 'image/webp')`
		)
	]
);

export const legacyConversations = sqliteTable(
	'conversations',
	{
		id: text('id').primaryKey(),
		assignmentId: text('assignment_id')
			.notNull()
			.references(() => assignments.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [uniqueIndex('conversations_assignment_unique').on(table.assignmentId)]
);

export const legacyMessages = sqliteTable(
	'messages',
	{
		id: text('id').primaryKey(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => legacyConversations.id, { onDelete: 'cascade' }),
		senderSide: text('sender_side', { enum: ['giver', 'recipient'] }).notNull(),
		content: text('content').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		giverReadAt: integer('giver_read_at', { mode: 'timestamp_ms' }),
		recipientReadAt: integer('recipient_read_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		index('messages_conversation_created_idx').on(table.conversationId, table.createdAt),
		index('messages_giver_unread_idx').on(
			table.conversationId,
			table.senderSide,
			table.giverReadAt
		),
		index('messages_recipient_unread_idx').on(
			table.conversationId,
			table.senderSide,
			table.recipientReadAt
		),
		check(
			'messages_content_valid',
			sql`length(trim(${table.content})) > 0 and length(${table.content}) <= 2000`
		),
		check('messages_sender_side_check', sql`${table.senderSide} in ('giver', 'recipient')`)
	]
);

export const giftReservations = sqliteTable(
	'gift_reservations',
	{
		id: text('id').primaryKey(),
		giftSuggestionId: text('gift_suggestion_id')
			.notNull()
			.references(() => giftSuggestions.id, { onDelete: 'restrict' }),
		reserverId: text('reserver_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		status: text('status', { enum: ['reserved', 'released', 'purchased'] })
			.$type<'reserved' | 'released' | 'purchased'>()
			.notNull()
			.default('reserved'),
		reservedAt: integer('reserved_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		releasedAt: integer('released_at', { mode: 'timestamp_ms' }),
		purchasedAt: integer('purchased_at', { mode: 'timestamp_ms' }),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		uniqueIndex('gift_reservations_active_suggestion_unique')
			.on(table.giftSuggestionId)
			.where(sql`${table.status} in ('reserved', 'purchased')`),
		index('gift_reservations_reserver_status_idx').on(table.reserverId, table.status),
		check(
			'gift_reservations_status_check',
			sql`${table.status} in ('reserved', 'released', 'purchased')`
		),
		check(
			'gift_reservations_timestamps_check',
			sql`(${table.status} = 'reserved' and ${table.releasedAt} is null and ${table.purchasedAt} is null) or (${table.status} = 'released' and ${table.releasedAt} is not null and ${table.purchasedAt} is null) or (${table.status} = 'purchased' and ${table.releasedAt} is null and ${table.purchasedAt} is not null)`
		)
	]
);

export const giftReservationAuditLog = sqliteTable(
	'gift_reservation_audit_log',
	{
		id: text('id').primaryKey(),
		reservationId: text('reservation_id')
			.notNull()
			.references(() => giftReservations.id, { onDelete: 'cascade' }),
		actorId: text('actor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		fromStatus: text('from_status', { enum: ['reserved', 'released', 'purchased'] })
			.$type<'reserved' | 'released' | 'purchased'>()
			.notNull(),
		toStatus: text('to_status', { enum: ['reserved', 'released', 'purchased'] })
			.$type<'reserved' | 'released' | 'purchased'>()
			.notNull(),
		reason: text('reason').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		index('gift_reservation_audit_log_reservation_idx').on(table.reservationId, table.createdAt),
		check(
			'gift_reservation_audit_log_status_check',
			sql`${table.fromStatus} in ('reserved', 'released', 'purchased') and ${table.toStatus} in ('reserved', 'released', 'purchased')`
		)
	]
);

export const legacyGiftConversations = sqliteTable(
	'gift_conversations',
	{
		id: text('id').primaryKey(),
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		recipientId: text('recipient_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		type: text('type', { enum: ['recipient_visible', 'private_coordination'] })
			.$type<'recipient_visible' | 'private_coordination'>()
			.notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		uniqueIndex('gift_conversations_event_recipient_type_unique').on(
			table.eventId,
			table.recipientId,
			table.type
		),
		index('gift_conversations_event_type_idx').on(table.eventId, table.type),
		check(
			'gift_conversations_type_check',
			sql`${table.type} in ('recipient_visible', 'private_coordination')`
		)
	]
);

export const legacyGiftConversationParticipants = sqliteTable(
	'gift_conversation_participants',
	{
		conversationId: text('conversation_id')
			.notNull()
			.references(() => legacyGiftConversations.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		joinedAt: integer('joined_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.userId] }),
		index('gift_conversation_participants_user_idx').on(table.userId, table.conversationId)
	]
);

export const legacyGiftMessages = sqliteTable(
	'gift_messages',
	{
		id: text('id').primaryKey(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => legacyGiftConversations.id, { onDelete: 'cascade' }),
		senderId: text('sender_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		content: text('content').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		index('gift_messages_conversation_created_idx').on(table.conversationId, table.createdAt),
		check(
			'gift_messages_content_valid',
			sql`length(trim(${table.content})) > 0 and length(${table.content}) <= 2000`
		)
	]
);

export const legacyGiftConversationReads = sqliteTable(
	'gift_conversation_reads',
	{
		conversationId: text('conversation_id')
			.notNull()
			.references(() => legacyGiftConversations.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		lastReadAt: integer('last_read_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.userId] }),
		index('gift_conversation_reads_user_idx').on(table.userId)
	]
);

export const wishlistConversations = sqliteTable(
	'wishlist_conversations',
	{
		id: text('id').primaryKey(),
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		wishlistOwnerId: text('wishlist_owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		type: text('conversation_type', {
			enum: ['wishlist_discussion', 'gift_coordination']
		})
			.$type<'wishlist_discussion' | 'gift_coordination'>()
			.notNull(),
		title: text('title').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		lastMessageAt: integer('last_message_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		uniqueIndex('wishlist_conversations_event_owner_type_unique').on(
			table.eventId,
			table.wishlistOwnerId,
			table.type
		),
		index('wishlist_conversations_event_activity_idx').on(
			table.eventId,
			table.lastMessageAt,
			table.updatedAt
		),
		check(
			'wishlist_conversations_type_check',
			sql`${table.type} in ('wishlist_discussion', 'gift_coordination')`
		),
		check('wishlist_conversations_title_not_blank', sql`length(trim(${table.title})) > 0`)
	]
);

export const wishlistConversationParticipants = sqliteTable(
	'wishlist_conversation_participants',
	{
		conversationId: text('conversation_id')
			.notNull()
			.references(() => wishlistConversations.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		joinedAt: integer('joined_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		lastReadAt: integer('last_read_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`0`)
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.userId] }),
		index('wishlist_conversation_participants_user_idx').on(table.userId, table.conversationId)
	]
);

export const wishlistMessages = sqliteTable(
	'wishlist_messages',
	{
		id: text('id').primaryKey(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => wishlistConversations.id, { onDelete: 'cascade' }),
		senderId: text('sender_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		content: text('content').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		editedAt: integer('edited_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		index('wishlist_messages_conversation_created_idx').on(table.conversationId, table.createdAt),
		index('wishlist_messages_sender_created_idx').on(table.senderId, table.createdAt),
		check(
			'wishlist_messages_content_valid',
			sql`length(trim(${table.content})) > 0 and length(${table.content}) <= 2000`
		)
	]
);

export const conversationMigrationReviews = sqliteTable(
	'conversation_migration_reviews',
	{
		id: text('id').primaryKey(),
		legacySource: text('legacy_source', { enum: ['assignment', 'gift'] })
			.$type<'assignment' | 'gift'>()
			.notNull(),
		legacyConversationId: text('legacy_conversation_id').notNull(),
		relatedUserId: text('related_user_id').references(() => users.id, { onDelete: 'set null' }),
		reason: text('reason').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' })
	},
	(table) => [
		uniqueIndex('conversation_migration_reviews_issue_unique').on(
			table.legacySource,
			table.legacyConversationId,
			table.relatedUserId,
			table.reason
		),
		index('conversation_migration_reviews_status_idx').on(table.resolvedAt, table.createdAt),
		check(
			'conversation_migration_reviews_source_check',
			sql`${table.legacySource} in ('assignment', 'gift')`
		),
		check('conversation_migration_reviews_reason_not_blank', sql`length(trim(${table.reason})) > 0`)
	]
);

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
		index('sessions_user_id_idx').on(table.userId),
		index('sessions_expires_at_idx').on(table.expiresAt)
	]
);

export type UserRecord = typeof users.$inferSelect;
export type HouseholdRecord = typeof households.$inferSelect;
export type EventRecord = typeof events.$inferSelect;
export type AssignmentRecord = typeof assignments.$inferSelect;
export type GiftSuggestionRecord = typeof giftSuggestions.$inferSelect;
export type ConversationRecord = typeof wishlistConversations.$inferSelect;
export type ConversationParticipantRecord = typeof wishlistConversationParticipants.$inferSelect;
export type MessageRecord = typeof wishlistMessages.$inferSelect;
export type ParticipantCodenameRecord = typeof participantCodenames.$inferSelect;
export type CodenameAuditRecord = typeof codenameAuditLog.$inferSelect;
export type GiftReservationRecord = typeof giftReservations.$inferSelect;
export type GiftReservationAuditRecord = typeof giftReservationAuditLog.$inferSelect;
