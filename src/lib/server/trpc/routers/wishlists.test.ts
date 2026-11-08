import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AuthenticatedUser } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { TRPCContext } from '#lib/server/trpc/context.js';
import { createDatabase } from '#lib/server/db/connection.js';
import { assignments, events, giftSuggestions, users } from '#lib/server/db/schema.js';
import type { SessionCookieStore } from '#lib/server/auth/session.js';
import { canViewWishlist } from '#lib/server/wishlist-access.js';
import { appRouter } from '#lib/server/trpc/router.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];

function createContext(user: AuthenticatedUser): TRPCContext {
	const request = new Request('http://localhost/api/trpc/wishlists.mine', {
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
			getClientAddress: () => '192.0.2.94',
			cookies
		}
	};
}

const organizer: AuthenticatedUser = {
	id: 'organizer-id',
	username: 'organizer',
	displayName: 'Organizer',
	role: 'organizer'
};

const participants: AuthenticatedUser[] = [
	{ id: 'alice', username: 'alice', displayName: 'Alice', role: 'participant' },
	{ id: 'bob', username: 'bob', displayName: 'Bob', role: 'participant' },
	{ id: 'carol', username: 'carol', displayName: 'Carol', role: 'participant' },
	{ id: 'dave', username: 'dave', displayName: 'Dave', role: 'participant' }
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
				passwordHash: 'not-used-by-wishlist-test'
			}))
		)
		.run();
}

function finalizeAssignments(): void {
	const finalizedAt = new Date();
	db.insert(assignments)
		.values([
			{
				id: 'assignment-alice',
				eventId: SINGLE_EVENT_ID,
				giverId: 'alice',
				receiverId: 'bob',
				finalizedAt
			},
			{
				id: 'assignment-bob',
				eventId: SINGLE_EVENT_ID,
				giverId: 'bob',
				receiverId: 'carol',
				finalizedAt
			},
			{
				id: 'assignment-carol',
				eventId: SINGLE_EVENT_ID,
				giverId: 'carol',
				receiverId: 'dave',
				finalizedAt
			},
			{
				id: 'assignment-dave',
				eventId: SINGLE_EVENT_ID,
				giverId: 'dave',
				receiverId: 'alice',
				finalizedAt
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

describe('wishlists router', () => {
	it('lets participants create, update, and delete only their own gift ideas', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const created = await alice.wishlists.create({
			title: 'Warm socks',
			url: 'https://shop.example/socks',
			estimatedPrice: '18.50'
		});

		expect(created).toMatchObject({
			title: 'Warm socks',
			url: 'https://shop.example/socks',
			estimatedPriceCents: 1850,
			imageKey: null
		});
		expect(created).not.toHaveProperty('ownerId');
		expect(canViewWishlist(db, participants[0], participants[0].id)).toBe(true);
		await expect(bob.wishlists.mine()).resolves.toEqual([]);
		await expect(
			bob.wishlists.update({ id: created.id, title: 'Changed by Bob' })
		).rejects.toMatchObject({ code: 'NOT_FOUND' });

		const updated = await alice.wishlists.update({
			id: created.id,
			title: 'Updated socks',
			description: 'Merino wool'
		});
		expect(updated).toMatchObject({
			id: created.id,
			title: 'Updated socks',
			description: 'Merino wool'
		});

		await expect(alice.wishlists.delete({ id: created.id })).resolves.toEqual({ success: true });
		expect(db.select().from(giftSuggestions).all()).toHaveLength(0);
	});

	it('exposes an assigned recipient wishlist only after assignments are finalized', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const carol = appRouter.createCaller(createContext(participants[2]));

		const bobIdea = await bob.wishlists.create({ title: 'A new cookbook' });
		await carol.wishlists.create({ title: 'Noise-cancelling headphones' });
		await expect(alice.wishlists.assignedRecipient()).resolves.toEqual({
			recipient: null,
			suggestions: []
		});
		expect(canViewWishlist(db, participants[0], 'bob')).toBe(false);

		finalizeAssignments();
		const aliceView = await alice.wishlists.assignedRecipient();
		expect(aliceView.recipient?.displayName).toBe('Bob');
		expect(aliceView.suggestions.map((suggestion) => suggestion.id)).toEqual([bobIdea.id]);
		expect(aliceView.suggestions[0]).not.toHaveProperty('ownerId');
		expect(canViewWishlist(db, participants[0], 'bob')).toBe(true);
		expect(canViewWishlist(db, participants[0], 'carol')).toBe(false);
		expect(canViewWishlist(db, organizer, organizer.id)).toBe(false);
		await expect(carol.wishlists.assignedRecipient()).resolves.toMatchObject({
			recipient: { displayName: 'Dave' },
			suggestions: []
		});
	});

	it('rejects organizer access to participant wishlist procedures', async () => {
		const organizerCaller = appRouter.createCaller(createContext(organizer));

		await expect(organizerCaller.wishlists.mine()).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(organizerCaller.wishlists.assignedRecipient()).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
	});

	it('does not expose wishlist data to unrelated participants', async () => {
		finalizeAssignments();
		const carol = appRouter.createCaller(createContext(participants[2]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const bobIdea = await bob.wishlists.create({ title: 'A model train' });

		const carolView = await carol.wishlists.assignedRecipient();
		expect(carolView.recipient?.displayName).toBe('Dave');
		expect(carolView.suggestions.map((suggestion) => suggestion.id)).not.toContain(bobIdea.id);
		expect(
			db
				.select({ id: giftSuggestions.id })
				.from(giftSuggestions)
				.where(eq(giftSuggestions.ownerId, 'bob'))
				.all()
		).toHaveLength(1);
	});
});
