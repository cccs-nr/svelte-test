import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AuthenticatedUser } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { TRPCContext } from '#lib/server/trpc/context.js';
import { createDatabase } from '#lib/server/db/connection.js';
import { assignments, conversations, events, messages, users } from '#lib/server/db/schema.js';
import type { SessionCookieStore } from '#lib/server/auth/session.js';
import { appRouter } from '#lib/server/trpc/router.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];

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
			getClientAddress: () => '192.0.2.95',
			cookies
		}
	};
}

const organizer: AuthenticatedUser = {
	id: 'organizer-id',
	username: 'organizer',
	displayName: 'Organizer',
	role: 'organizer',
	isParticipating: false
};

const participants: AuthenticatedUser[] = [
	{
		id: 'alice',
		username: 'alice',
		displayName: 'Alice',
		role: 'participant',
		isParticipating: true
	},
	{ id: 'bob', username: 'bob', displayName: 'Bob', role: 'participant', isParticipating: true },
	{
		id: 'carol',
		username: 'carol',
		displayName: 'Carol',
		role: 'participant',
		isParticipating: true
	},
	{ id: 'dave', username: 'dave', displayName: 'Dave', role: 'participant', isParticipating: true },
	{ id: 'erin', username: 'erin', displayName: 'Erin', role: 'participant', isParticipating: true }
];

function seedEventAndParticipants(): void {
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
				passwordHash: 'not-used-by-messaging-test'
			}))
		)
		.run();
	db.insert(assignments)
		.values([
			{
				id: 'assignment-alice',
				eventId: SINGLE_EVENT_ID,
				giverId: 'alice',
				receiverId: 'bob',
				finalizedAt: new Date()
			},
			{
				id: 'assignment-bob',
				eventId: SINGLE_EVENT_ID,
				giverId: 'bob',
				receiverId: 'carol',
				finalizedAt: new Date()
			},
			{
				id: 'assignment-carol',
				eventId: SINGLE_EVENT_ID,
				giverId: 'carol',
				receiverId: 'dave',
				finalizedAt: new Date()
			},
			{
				id: 'assignment-dave',
				eventId: SINGLE_EVENT_ID,
				giverId: 'dave',
				receiverId: 'alice',
				finalizedAt: new Date()
			}
		])
		.run();
}

beforeEach(() => {
	const database = createDatabase(':memory:');
	client = database.client;
	db = database.db;
	migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
	seedEventAndParticipants();
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('anonymous messaging router', () => {
	it('lets the giver start a private conversation and hides sender identity from the recipient', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		db.update(users)
			.set({
				avatarKey: '00000000-0000-4000-8000-000000000001',
				avatarMimeType: 'image/png'
			})
			.where(eq(users.id, 'bob'))
			.run();

		await expect(
			bob.messages.send({ direction: 'asRecipient', content: 'Hello!' })
		).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
		await expect(
			alice.messages.send({ direction: 'asGiver', content: 'Do you have a favorite color?' })
		).resolves.toEqual({ success: true });

		const aliceThreads = await alice.conversations.list();
		expect(aliceThreads.asGiver).toMatchObject({
			hasConversation: true,
			recipientDisplayName: 'Bob',
			recipientHasAvatar: true
		});
		expect(aliceThreads.asGiver?.messages[0]?.senderLabel).toBe('You');

		const bobThreads = await bob.conversations.list();
		expect(bobThreads.asRecipient?.messages[0]).toMatchObject({
			content: 'Do you have a favorite color?',
			senderLabel: 'Your Secret Santa'
		});
		expect(bobThreads.asRecipient).not.toHaveProperty('recipientHasAvatar');
		expect(Object.keys(bobThreads.asRecipient?.messages[0] ?? {}).sort()).toEqual([
			'content',
			'id',
			'senderLabel',
			'sentAt'
		]);
		expect(JSON.stringify(bobThreads.asRecipient)).not.toContain('alice');
		expect(JSON.stringify(bobThreads.asRecipient)).not.toContain('senderSide');
		expect(db.select().from(conversations).all()).toHaveLength(1);
	});

	it('lets the recipient reply while keeping the sender anonymous in the recipient view', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const bob = appRouter.createCaller(createContext(participants[1]));

		await alice.messages.send({ direction: 'asGiver', content: 'Would you enjoy a cookbook?' });
		await bob.messages.send({ direction: 'asRecipient', content: 'Yes, I love baking.' });

		const bobThread = (await bob.conversations.list()).asRecipient;
		expect(bobThread?.messages.map((message) => message.senderLabel)).toEqual([
			'Your Secret Santa',
			'You'
		]);
		expect(JSON.stringify(bobThread)).not.toContain('alice');

		const aliceThread = (await alice.conversations.list()).asGiver;
		expect(aliceThread?.messages.map((message) => message.senderLabel)).toEqual(['You', 'Bob']);
		expect(aliceThread?.messages[1]?.content).toBe('Yes, I love baking.');
	});

	it('tracks unread messages by participant side and respects the read-through timestamp', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const dave = appRouter.createCaller(createContext(participants[3]));

		await alice.messages.send({ direction: 'asGiver', content: 'First note.' });
		const firstBobMessage = (await bob.conversations.list()).asRecipient?.messages[0];
		if (!firstBobMessage) throw new Error('Expected Bob to receive the first message.');
		await alice.messages.send({ direction: 'asGiver', content: 'Second note.' });
		await dave.messages.send({ direction: 'asGiver', content: 'Hello, Alice.' });
		await bob.messages.send({ direction: 'asRecipient', content: 'Thanks, Alice.' });

		await expect(bob.conversations.unreadCount()).resolves.toEqual({ count: 2 });
		await expect(alice.conversations.unreadCount()).resolves.toEqual({ count: 2 });

		await bob.messages.markRead({
			direction: 'asRecipient',
			throughCreatedAt: firstBobMessage.sentAt
		});
		await expect(bob.conversations.unreadCount()).resolves.toEqual({ count: 1 });

		const bobLatestMessage = (await bob.conversations.list()).asRecipient?.messages.at(-1);
		if (!bobLatestMessage) throw new Error('Expected Bob to have messages in the thread.');
		await bob.messages.markRead({
			direction: 'asRecipient',
			throughCreatedAt: bobLatestMessage.sentAt
		});
		await expect(bob.conversations.unreadCount()).resolves.toEqual({ count: 0 });

		const aliceLatestReply = (await alice.conversations.list()).asGiver?.messages.at(-1);
		if (!aliceLatestReply) throw new Error('Expected Alice to receive Bob’s reply.');
		await alice.messages.markRead({
			direction: 'asGiver',
			throughCreatedAt: aliceLatestReply.sentAt
		});
		await expect(alice.conversations.unreadCount()).resolves.toEqual({ count: 1 });

		const incomingFromDave = (await alice.conversations.list()).asRecipient?.messages.at(-1);
		if (!incomingFromDave) throw new Error('Expected Alice to receive Dave’s message.');
		await alice.messages.markRead({
			direction: 'asRecipient',
			throughCreatedAt: incomingFromDave.sentAt
		});
		await expect(alice.conversations.unreadCount()).resolves.toEqual({ count: 0 });
	});

	it('denies organizer access and returns no conversations for unrelated participants', async () => {
		const organizerCaller = appRouter.createCaller(createContext(organizer));
		const erin = appRouter.createCaller(createContext(participants[4]));

		await expect(organizerCaller.conversations.list()).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
		await expect(
			organizerCaller.messages.send({ direction: 'asGiver', content: 'Not allowed.' })
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(erin.conversations.list()).resolves.toEqual({
			asGiver: null,
			asRecipient: null
		});
		await expect(
			erin.messages.send({ direction: 'asGiver', content: 'Not assigned.' })
		).rejects.toMatchObject({
			code: 'PRECONDITION_FAILED'
		});
		expect(db.select().from(messages).all()).toEqual([]);
	});

	it('rejects blank and oversized messages', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));

		await expect(
			alice.messages.send({ direction: 'asGiver', content: '   ' })
		).rejects.toMatchObject({
			code: 'BAD_REQUEST'
		});
		await expect(
			alice.messages.send({ direction: 'asGiver', content: 'x'.repeat(2001) })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});
});
