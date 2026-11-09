import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AuthenticatedUser } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { TRPCContext } from '#lib/server/trpc/context.js';
import { createDatabase } from '#lib/server/db/connection.js';
import { assignments, events, participantCodenames, users } from '#lib/server/db/schema.js';
import type { SessionCookieStore } from '#lib/server/auth/session.js';
import { appRouter } from '#lib/server/trpc/router.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];

function createContext(user: AuthenticatedUser): TRPCContext {
	const request = new Request('http://localhost/api/trpc/giftConversations.list', {
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
			getClientAddress: () => '192.0.2.97',
			cookies
		}
	};
}

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
	{ id: 'dave', username: 'dave', displayName: 'Dave', role: 'participant', isParticipating: true }
];

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
			currency: 'CAD',
			status: 'assignments_generated'
		})
		.run();
	db.insert(users)
		.values(
			participants.map((participant) => ({
				...participant,
				passwordHash: 'not-used-by-gift-conversations-test'
			}))
		)
		.run();
	db.insert(assignments)
		.values(
			participants.map((participant, index) => ({
				id: `assignment-${participant.id}`,
				eventId: SINGLE_EVENT_ID,
				giverId: participant.id,
				receiverId: participants[(index + 1) % participants.length]?.id ?? 'alice',
				finalizedAt: new Date()
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
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('family gift conversations', () => {
	it('lets family members discuss suggestions with the recipient while displaying codenames', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const carol = appRouter.createCaller(createContext(participants[2]));

		const aliceThread = await alice.giftConversations.openDiscussion({ recipientId: 'bob' });
		expect(aliceThread.recipientLabel).toBe('Jingle');
		await alice.giftConversations.send({
			conversationId: aliceThread.id,
			content: 'Which color would you prefer?'
		});
		const aliceDirectory = await alice.giftConversations.list();
		expect(aliceDirectory[0]).toMatchObject({
			recipientId: 'bob',
			recipientCodename: 'Jingle',
			recipientLabel: 'Jingle',
			lastMessagePreview: 'Which color would you prefer?',
			lastMessageSenderLabel: 'You',
			lastMessageAt: expect.any(String)
		});
		expect(JSON.stringify(aliceDirectory)).not.toContain('alice');

		const bobThread = await bob.giftConversations.openDiscussion({ recipientId: 'bob' });
		expect(bobThread.id).toBe(aliceThread.id);
		expect(bobThread.recipientLabel).toBe('Jingle');
		expect(bobThread.messages[0]).toMatchObject({
			content: 'Which color would you prefer?',
			senderLabel: 'Frosty'
		});
		expect(JSON.stringify(bobThread)).not.toContain('alice');

		await bob.giftConversations.send({
			conversationId: bobThread.id,
			content: 'Blue, please.'
		});
		const carolThread = await carol.giftConversations.openDiscussion({ recipientId: 'bob' });
		expect(carolThread.messages.map((message) => message.senderLabel)).toEqual([
			'Frosty',
			'Jingle'
		]);
		expect(carolThread.unreadCount).toBe(2);

		db.update(events).set({ revealedAt: new Date() }).where(eq(events.id, SINGLE_EVENT_ID)).run();
		const revealedDirectory = await alice.giftConversations.list();
		expect(revealedDirectory[0]).toMatchObject({
			recipientLabel: 'Bob',
			recipientCodename: null
		});
		expect(JSON.stringify(revealedDirectory)).not.toContain('Jingle');
		const revealedThread = await alice.giftConversations.thread({
			conversationId: aliceThread.id
		});
		expect(revealedThread.messages[0]).toMatchObject({
			senderLabel: 'You',
			senderCodename: null
		});
		expect(JSON.stringify(revealedThread)).not.toContain('Jingle');
	});

	it('keeps the recipient out of private coordination and restricts threads to members', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const carol = appRouter.createCaller(createContext(participants[2]));
		const aliceThread = await alice.giftConversations.joinCoordination({ recipientId: 'bob' });

		await expect(
			bob.giftConversations.joinCoordination({ recipientId: 'bob' })
		).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
		await alice.giftConversations.send({
			conversationId: aliceThread.id,
			content: 'I reserved the headphones.'
		});
		await expect(
			bob.giftConversations.thread({ conversationId: aliceThread.id })
		).rejects.toMatchObject({ code: 'NOT_FOUND' });
		await expect(carol.giftConversations.list()).resolves.toEqual([]);

		const carolThread = await carol.giftConversations.joinCoordination({ recipientId: 'bob' });
		expect(carolThread.messages[0]?.senderLabel).toBe('Frosty');
		expect(carolThread.unreadCount).toBe(1);
		await carol.giftConversations.markRead({ conversationId: aliceThread.id });
		await expect(
			carol.giftConversations.thread({ conversationId: aliceThread.id })
		).resolves.toMatchObject({
			unreadCount: 0
		});
	});

	it('uses real names after reveal and blocks sending after event completion', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const thread = await alice.giftConversations.openDiscussion({ recipientId: 'bob' });
		await alice.giftConversations.send({
			conversationId: thread.id,
			content: 'A question before the reveal.'
		});
		const revealedAt = new Date();
		db.update(events)
			.set({ status: 'completed', revealedAt })
			.where(eq(events.id, SINGLE_EVENT_ID))
			.run();

		await expect(
			bob.giftConversations.thread({ conversationId: thread.id })
		).resolves.toMatchObject({
			messages: [{ senderLabel: 'Alice' }]
		});
		await expect(
			alice.giftConversations.send({
				conversationId: thread.id,
				content: 'A message after the event.'
			})
		).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
	});
});
