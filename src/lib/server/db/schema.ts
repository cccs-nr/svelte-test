import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
		role: text('role', { enum: ['organizer', 'participant'] })
			.$type<UserRole>()
			.notNull(),
		householdId: text('household_id').references(() => households.id, { onDelete: 'set null' }),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		uniqueIndex('users_username_unique').on(table.username),
		index('users_household_id_idx').on(table.householdId),
		check('users_role_check', sql`${table.role} in ('organizer', 'participant')`)
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
		finalizedAt: integer('finalized_at', { mode: 'timestamp_ms' })
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
