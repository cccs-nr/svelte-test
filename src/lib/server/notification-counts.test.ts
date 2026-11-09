import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { createDatabase } from '#lib/server/db/connection.js';
import {
	assignments,
	conversations,
	events,
	giftConversationParticipants,
	giftConversationReads,
	giftConversations,
	giftMessages,
	giftSuggestions,
	messages,
	users
} from '#lib/server/db/schema.js';
import { getParticipantBadgeCounts } from '#lib/server/notification-counts.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];

beforeEach(() => {
	const database = createDatabase(':memory:');
	client = database.client;
	db = database.db;
	migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });

	db.insert(events)
		.values({
			id: SINGLE_EVENT_ID,
			name: 'Family Exchange',
			exchangeDate: '2026-12-24',
			giftBudgetCents: 5000,
			status: 'assignments_generated'
		})
		.run();
	db.insert(users)
		.values(
			['alice', 'bob', 'carol'].map((id) => ({
				id,
				username: id,
				displayName: id,
				passwordHash: 'not-used-by-notification-test',
				role: 'participant' as const,
				isParticipating: true
			}))
		)
		.run();
	db.insert(assignments)
		.values([
			{
				id: 'alice-assignment',
				eventId: SINGLE_EVENT_ID,
				giverId: 'alice',
				receiverId: 'bob',
				finalizedAt: new Date()
			},
			{
				id: 'bob-assignment',
				eventId: SINGLE_EVENT_ID,
				giverId: 'bob',
				receiverId: 'carol',
				finalizedAt: new Date()
			},
			{
				id: 'carol-assignment',
				eventId: SINGLE_EVENT_ID,
				giverId: 'carol',
				receiverId: 'alice',
				finalizedAt: new Date()
			}
		])
		.run();
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('participant notification counts', () => {
	it('counts new recipient ideas, unread messages, and unseen gift status separately', () => {
		db.insert(giftSuggestions)
			.values({ id: 'bob-idea', ownerId: 'bob', title: 'Warm mittens' })
			.run();
		expect(getParticipantBadgeCounts(db, 'alice')).toEqual({ wishlist: 0, gift: 1, messages: 0 });

		db.update(assignments)
			.set({ giverWishlistViewedAt: new Date() })
			.where(eq(assignments.id, 'alice-assignment'))
			.run();

		const purchasedAt = new Date(Date.now() + 1000);
		db.update(assignments)
			.set({ giftPurchasedAt: purchasedAt })
			.where(eq(assignments.id, 'carol-assignment'))
			.run();
		db.insert(conversations)
			.values({ id: 'carol-conversation', assignmentId: 'carol-assignment' })
			.run();
		db.insert(messages)
			.values({
				id: 'santa-message',
				conversationId: 'carol-conversation',
				senderSide: 'giver',
				content: 'Your gift is on its way.',
				giverReadAt: new Date()
			})
			.run();

		expect(getParticipantBadgeCounts(db, 'alice')).toEqual({ wishlist: 2, gift: 0, messages: 1 });

		db.update(assignments)
			.set({ receiverGiftStatusSeenAt: purchasedAt })
			.where(eq(assignments.id, 'carol-assignment'))
			.run();
		db.update(messages)
			.set({ recipientReadAt: new Date() })
			.where(and(eq(messages.id, 'santa-message'), eq(messages.senderSide, 'giver')))
			.run();

		expect(getParticipantBadgeCounts(db, 'alice')).toEqual({ wishlist: 0, gift: 0, messages: 0 });
	});

	it('includes unread family conversation messages in the Wishlist badge', () => {
		db.insert(giftConversations)
			.values({
				id: 'family-conversation',
				eventId: SINGLE_EVENT_ID,
				recipientId: 'bob',
				type: 'recipient_visible'
			})
			.run();
		db.insert(giftConversationParticipants)
			.values([
				{ conversationId: 'family-conversation', userId: 'alice' },
				{ conversationId: 'family-conversation', userId: 'bob' }
			])
			.run();
		db.insert(giftConversationReads)
			.values([
				{
					conversationId: 'family-conversation',
					userId: 'alice',
					lastReadAt: new Date(0)
				},
				{
					conversationId: 'family-conversation',
					userId: 'bob',
					lastReadAt: new Date(0)
				}
			])
			.run();
		db.insert(giftMessages)
			.values({
				id: 'family-message',
				conversationId: 'family-conversation',
				senderId: 'bob',
				content: 'Which color would you like?',
				createdAt: new Date()
			})
			.run();

		expect(getParticipantBadgeCounts(db, 'alice')).toEqual({ wishlist: 1, gift: 0, messages: 1 });

		db.update(giftConversationReads)
			.set({ lastReadAt: new Date(Date.now() + 1000) })
			.where(eq(giftConversationReads.userId, 'alice'))
			.run();
		expect(getParticipantBadgeCounts(db, 'alice')).toEqual({ wishlist: 0, gift: 0, messages: 0 });
	});
});
