import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AuthenticatedUser } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { TRPCContext } from '#lib/server/trpc/context.js';
import { createDatabase } from '#lib/server/db/connection.js';
import {
	assignments,
	conversationMigrationReviews,
	events,
	participantCodenames,
	users,
	wishlistConversationParticipants,
	wishlistMessages
} from '#lib/server/db/schema.js';
import type { SessionCookieStore } from '#lib/server/auth/session.js';
import { appRouter } from '#lib/server/trpc/router.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];

const participants: AuthenticatedUser[] = [
	{
		id: 'alice',
		username: 'alice-user',
		displayName: 'Alice',
		role: 'participant',
		isParticipating: true
	},
	{
		id: 'bob',
		username: 'bob-user',
		displayName: 'Bob',
		role: 'participant',
		isParticipating: true
	},
	{
		id: 'carol',
		username: 'carol-user',
		displayName: 'Carol',
		role: 'participant',
		isParticipating: true
	},
	{
		id: 'dave',
		username: 'dave-user',
		displayName: 'Dave',
		role: 'participant',
		isParticipating: true
	}
];

const organizer: AuthenticatedUser = {
	id: 'organizer',
	username: 'organizer-user',
	displayName: 'Organizer',
	role: 'organizer',
	isParticipating: false
};

function createContext(user: AuthenticatedUser): TRPCContext {
	const request = new Request('http://localhost/api/trpc/conversations.list', {
		method: 'POST',
		headers: { origin: 'http://localhost' }
	});
	const cookies: SessionCookieStore = {
		get: () => undefined,
		set: () => undefined,
		delete: () => undefined
	};
	return {
		db,
		user,
		event: {
			request,
			url: new URL(request.url),
			getClientAddress: () => '192.0.2.111',
			cookies
		}
	};
}

function createCaller(user: AuthenticatedUser) {
	return appRouter.createCaller(createContext(user));
}

beforeEach(async () => {
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
			currency: 'CAD',
			status: 'assignments_generated'
		})
		.run();
	db.insert(users)
		.values(
			participants.map((participant) => ({
				...participant,
				passwordHash: 'not-used-by-conversations-test'
			}))
		)
		.run();
	db.insert(assignments)
		.values(
			participants.map((participant, index) => ({
				id: `assignment-${participant.id}`,
				eventId: SINGLE_EVENT_ID,
				giverId: participant.id,
				receiverId: participants[(index + 1) % participants.length]?.id ?? 'alice'
			}))
		)
		.run();
	db.insert(participantCodenames)
		.values(
			participants.map((participant, index) => ({
				id: `codename-${participant.id}`,
				eventId: SINGLE_EVENT_ID,
				userId: participant.id,
				codename: ['Frosty', 'Jingle', 'Tinsel', 'Holly'][index] ?? 'Snowflake'
			}))
		)
		.run();
	await createCaller(organizer).assignments.finalize();
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('wishlist-centric conversations', () => {
	it('puts the assigned Santa in the participant conversation and resolves identities for each viewer', async () => {
		const alice = createCaller(participants[0]!);
		const bob = createCaller(participants[1]!);
		const conversation = (await alice.conversations.list()).find(
			(item) => item.wishlistOwner.userId === 'bob' && item.type === 'wishlist_discussion'
		);
		if (!conversation) throw new Error('Expected Alice to have a conversation for Bob’s wishlist.');
		expect(conversation.title).toBe('Bob — Talk to Bob');

		await alice.conversations.send({
			conversationId: conversation.id,
			content: 'Would you prefer a local gift?'
		});
		const bobThread = await bob.conversations.thread({ conversationId: conversation.id });
		expect(bobThread).toMatchObject({
			type: 'wishlist_discussion',
			title: 'Bob — Talk to Bob',
			wishlistOwner: { displayName: 'Bob', userId: 'bob' },
			messages: [
				{
					senderLabel: 'Secret Santa',
					senderAvatar: { type: 'secret' },
					content: 'Would you prefer a local gift?'
				}
			]
		});
		expect(JSON.stringify(bobThread)).not.toContain('Alice');
		expect(JSON.stringify(bobThread)).not.toContain('alice-user');
		expect(bobThread.messages[0]).not.toHaveProperty('senderId');

		await bob.conversations.send({
			conversationId: conversation.id,
			content: 'Something local would be great.'
		});
		const aliceThread = await alice.conversations.thread({ conversationId: conversation.id });
		expect(aliceThread.messages.map((message) => message.senderLabel)).toEqual(['Frosty', 'Bob']);
		expect(aliceThread.messages[0]).toMatchObject({
			isOwnMessage: true,
			senderAvatar: { type: 'codename', codename: 'Frosty' }
		});
		expect(
			db
				.select({ senderId: wishlistMessages.senderId })
				.from(wishlistMessages)
				.where(eq(wishlistMessages.conversationId, conversation.id))
				.all()
		).toEqual([{ senderId: 'alice' }, { senderId: 'bob' }]);
	});

	it('includes the wishlist owner in discussions and shows other gifters only by codename', async () => {
		const alice = createCaller(participants[0]!);
		const bob = createCaller(participants[1]!);
		const carol = createCaller(participants[2]!);
		const aliceThread = await alice.conversations.openDiscussion({ wishlistOwnerId: 'bob' });
		const carolThread = await carol.conversations.openDiscussion({ wishlistOwnerId: 'bob' });
		expect(carolThread.id).toBe(aliceThread.id);
		expect(
			db
				.select({ userId: wishlistConversationParticipants.userId })
				.from(wishlistConversationParticipants)
				.where(eq(wishlistConversationParticipants.conversationId, aliceThread.id))
				.all()
				.map(({ userId }) => userId)
				.sort()
		).toEqual(['alice', 'bob', 'carol']);

		await alice.conversations.send({
			conversationId: aliceThread.id,
			content: 'Which color would you like?'
		});
		await carol.conversations.send({
			conversationId: carolThread.id,
			content: 'I can buy the wrapping paper.'
		});
		const bobThread = await bob.conversations.thread({ conversationId: aliceThread.id });
		expect(bobThread.messages.map((message) => message.senderLabel)).toEqual([
			'Secret Santa',
			'Tinsel'
		]);
		expect(bobThread.participants.map((participant) => participant.label).sort()).toEqual([
			'Bob',
			'Secret Santa',
			'Tinsel'
		]);
		expect(JSON.stringify(bobThread)).not.toContain('Alice');
		expect(JSON.stringify(bobThread)).not.toContain('Carol');
		expect(JSON.stringify(bobThread)).not.toContain('alice-user');
		expect(JSON.stringify(bobThread)).not.toContain('carol-user');

		await bob.conversations.send({
			conversationId: bobThread.id,
			content: 'Blue would be perfect.'
		});
		const carolView = await carol.conversations.thread({ conversationId: carolThread.id });
		expect(carolView.messages.at(-1)?.senderLabel).toBe('Bob');

		db.update(events).set({ revealedAt: new Date() }).where(eq(events.id, SINGLE_EVENT_ID)).run();
		const revealedView = await bob.conversations.thread({ conversationId: bobThread.id });
		expect(revealedView.messages.map((message) => message.senderLabel)).toEqual([
			'Secret Santa',
			'Tinsel',
			'Bob'
		]);
	});

	it('excludes wishlist owners from private gift planning and checks membership server-side', async () => {
		const alice = createCaller(participants[0]!);
		const bob = createCaller(participants[1]!);
		const carol = createCaller(participants[2]!);
		const dave = createCaller(participants[3]!);
		const aliceThread = await alice.conversations.joinCoordination({ wishlistOwnerId: 'bob' });
		await carol.conversations.joinCoordination({ wishlistOwnerId: 'bob' });

		expect(
			db
				.select({ userId: wishlistConversationParticipants.userId })
				.from(wishlistConversationParticipants)
				.where(eq(wishlistConversationParticipants.conversationId, aliceThread.id))
				.all()
				.map(({ userId }) => userId)
				.sort()
		).toEqual(['alice', 'carol']);
		await carol.conversations.send({
			conversationId: aliceThread.id,
			content: 'I can take that gift.'
		});
		const aliceDirectory = await alice.wishlists.familyDirectory({ search: '' });
		const bobInAliceDirectory = aliceDirectory.find((member) => member.id === 'bob');
		if (!bobInAliceDirectory) throw new Error('Expected Bob in Alice’s wishlist directory.');
		expect(bobInAliceDirectory.conversations).toContainEqual({
			id: aliceThread.id,
			type: 'gift_coordination',
			unreadCount: 1
		});
		const bobDirectory = await bob.wishlists.familyDirectory({ search: '' });
		const bobInOwnDirectory = bobDirectory.find((member) => member.id === 'bob');
		if (!bobInOwnDirectory) throw new Error('Expected Bob in his wishlist directory.');
		expect(bobInOwnDirectory.conversations.some(({ id }) => id === aliceThread.id)).toBe(false);

		await expect(
			bob.conversations.joinCoordination({ wishlistOwnerId: 'bob' })
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(
			bob.conversations.thread({ conversationId: aliceThread.id })
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(
			dave.conversations.thread({ conversationId: aliceThread.id })
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		db.insert(wishlistConversationParticipants)
			.values({ conversationId: aliceThread.id, userId: 'bob' })
			.run();
		await expect(
			bob.conversations.thread({ conversationId: aliceThread.id })
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('tracks unread messages by conversation membership and restricts migration review to organizers', async () => {
		const alice = createCaller(participants[0]!);
		const bob = createCaller(participants[1]!);
		const organizerCaller = createCaller(organizer);
		const conversation = await alice.conversations.openDiscussion({ wishlistOwnerId: 'bob' });
		await alice.conversations.send({
			conversationId: conversation.id,
			content: 'A new question.'
		});
		await expect(bob.conversations.unreadCount()).resolves.toEqual({ count: 1 });
		const bobThread = await bob.conversations.thread({ conversationId: conversation.id });
		await bob.conversations.markRead({ conversationId: conversation.id });
		await expect(bob.conversations.unreadCount()).resolves.toEqual({ count: 0 });
		expect(bobThread.unreadCount).toBe(1);

		await expect(organizerCaller.conversations.migrationReview()).resolves.toEqual([]);
		await expect(alice.conversations.migrationReview()).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
		db.insert(conversationMigrationReviews)
			.values({
				id: 'review-entry',
				legacySource: 'gift',
				legacyConversationId: 'legacy-id',
				relatedUserId: 'bob',
				reason: 'Wishlist owner was removed from Gift Coordination membership.'
			})
			.run();
		await expect(organizerCaller.conversations.migrationReview()).resolves.toMatchObject([
			{
				id: 'review-entry',
				displayName: 'Bob',
				reason: 'Wishlist owner was removed from private gift planning membership.'
			}
		]);
		await expect(
			organizerCaller.conversations.resolveMigrationReview({ id: 'review-entry' })
		).resolves.toEqual({ updated: true });
		await expect(organizerCaller.conversations.migrationReview()).resolves.toEqual([]);
	});

	it('shows who has seen each message', async () => {
		const alice = createCaller(participants[0]!);
		const bob = createCaller(participants[1]!);
		const opened = await alice.conversations.openDiscussion({ wishlistOwnerId: 'bob' });
		await alice.conversations.send({ conversationId: opened.id, content: 'Hello Bob' });

		const beforeRead = await alice.conversations.thread({ conversationId: opened.id });
		expect(beforeRead.messages.at(-1)?.receipt).toEqual({ seenLabels: [], recipientCount: 1 });
		expect(beforeRead.messages.at(-1)?.seenBy).toEqual([]);

		await bob.conversations.markRead({ conversationId: opened.id });
		const afterRead = await alice.conversations.thread({ conversationId: opened.id });
		const last = afterRead.messages.at(-1);
		expect(last?.receipt?.seenLabels).toEqual(['Bob']);
		expect(last?.seenBy.map((reader) => reader.label)).toEqual(['Bob']);

		await bob.conversations.send({ conversationId: opened.id, content: 'Hi Alice' });
		const bobsReply = await alice.conversations.thread({ conversationId: opened.id });
		expect(bobsReply.messages[0]?.seenBy).toEqual([]);
		expect(bobsReply.messages.at(-1)?.seenBy.map((reader) => reader.label)).toEqual(['Bob']);
	});
});
