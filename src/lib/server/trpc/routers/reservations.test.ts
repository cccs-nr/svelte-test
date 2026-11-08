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
	events,
	giftReservationAuditLog,
	giftReservations,
	participantCodenames,
	users
} from '#lib/server/db/schema.js';
import type { SessionCookieStore } from '#lib/server/auth/session.js';
import { appRouter } from '#lib/server/trpc/router.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];

function createContext(user: AuthenticatedUser): TRPCContext {
	const request = new Request('http://localhost/api/trpc/reservations.mine', {
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
			getClientAddress: () => '192.0.2.96',
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

const organizer: AuthenticatedUser = {
	id: 'organizer',
	username: 'organizer',
	displayName: 'Organizer',
	role: 'organizer',
	isParticipating: false
};

function seedEvent(): void {
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
			[...participants, organizer].map((user) => ({
				...user,
				passwordHash: 'not-used-by-reservation-test'
			}))
		)
		.run();
	const finalizedAt = new Date();
	db.insert(assignments)
		.values(
			participants.map((participant, index) => ({
				id: `assignment-${participant.id}`,
				eventId: SINGLE_EVENT_ID,
				giverId: participant.id,
				receiverId: participants[(index + 1) % participants.length]?.id ?? 'alice',
				finalizedAt
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
}

beforeEach(() => {
	const database = createDatabase(':memory:');
	client = database.client;
	db = database.db;
	migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
	seedEvent();
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('family wishlist reservations', () => {
	it('lets another participant reserve and purchase an idea without exposing the buyer to its owner', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const carol = appRouter.createCaller(createContext(participants[2]));
		const idea = await bob.wishlists.create({ title: 'Warm scarf' });

		await expect(alice.reservations.reserve({ giftSuggestionId: idea.id })).resolves.toMatchObject({
			reservationId: expect.any(String)
		});
		const bobWishlist = await bob.wishlists.familyWishlist({ recipientId: 'bob' });
		expect(bobWishlist.suggestions[0]).toMatchObject({
			reservationStatus: null,
			reservedBy: null,
			reservedByMe: false
		});
		expect(JSON.stringify(bobWishlist)).not.toContain('alice');

		const carolView = await carol.wishlists.familyWishlist({ recipientId: 'bob' });
		expect(carolView.suggestions[0]).toMatchObject({
			reservationStatus: 'reserved',
			reservedBy: 'Frosty',
			reservedByMe: false
		});
		expect(JSON.stringify(carolView)).not.toContain('alice');
		await expect(carol.reservations.reserve({ giftSuggestionId: idea.id })).rejects.toMatchObject({
			code: 'CONFLICT'
		});

		const reservation = db.select().from(giftReservations).all()[0];
		if (!reservation) throw new Error('Expected the reservation to be created.');
		await expect(
			alice.reservations.markPurchased({ reservationId: reservation.id })
		).resolves.toMatchObject({ success: true, purchasedAt: expect.any(String) });
		await expect(
			alice.reservations.release({ reservationId: reservation.id })
		).rejects.toMatchObject({ code: 'CONFLICT' });
		const ownerViewAfterPurchase = await bob.wishlists.familyWishlist({ recipientId: 'bob' });
		expect(ownerViewAfterPurchase.suggestions[0]).toMatchObject({
			reservationStatus: null,
			reservedBy: null
		});
	});

	it('allows releasing and re-reserving an idea while retaining its reservation history', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const carol = appRouter.createCaller(createContext(participants[2]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const idea = await bob.wishlists.create({ title: 'Travel mug' });
		const first = await alice.reservations.reserve({ giftSuggestionId: idea.id });

		await expect(
			alice.reservations.release({ reservationId: first.reservationId })
		).resolves.toEqual({
			success: true
		});
		const second = await carol.reservations.reserve({ giftSuggestionId: idea.id });
		expect(second.reservationId).not.toBe(first.reservationId);
		expect(db.select().from(giftReservations).all()).toHaveLength(2);
	});

	it('allows only one winner when two participants try to reserve concurrently', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const carol = appRouter.createCaller(createContext(participants[2]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const idea = await bob.wishlists.create({ title: 'Winter boots' });

		const results = await Promise.allSettled([
			alice.reservations.reserve({ giftSuggestionId: idea.id }),
			carol.reservations.reserve({ giftSuggestionId: idea.id })
		]);

		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
		expect(db.select().from(giftReservations).all()).toHaveLength(1);
	});

	it('supports audited organizer corrections without showing the status of the organizer own wishlist', async () => {
		db.update(users).set({ isParticipating: true }).where(eq(users.id, organizer.id)).run();
		db.update(assignments)
			.set({ receiverId: organizer.id })
			.where(eq(assignments.giverId, 'dave'))
			.run();
		db.insert(assignments)
			.values({
				id: 'assignment-organizer',
				eventId: SINGLE_EVENT_ID,
				giverId: organizer.id,
				receiverId: 'alice',
				finalizedAt: new Date()
			})
			.run();
		db.insert(participantCodenames)
			.values({
				id: 'codename-organizer',
				eventId: SINGLE_EVENT_ID,
				userId: organizer.id,
				codename: 'Snowball'
			})
			.run();
		const organizerUser = { ...organizer, isParticipating: true };
		const organizerCaller = appRouter.createCaller(createContext(organizerUser));
		const alice = appRouter.createCaller(createContext(participants[0]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const organizerIdea = await organizerCaller.wishlists.create({ title: 'Notebook' });
		const bobIdea = await bob.wishlists.create({ title: 'Water bottle' });
		const reservation = await alice.reservations.reserve({ giftSuggestionId: bobIdea.id });
		await alice.reservations.reserve({ giftSuggestionId: organizerIdea.id });

		const organizerReservations = await organizerCaller.reservations.adminList();
		expect(organizerReservations).toHaveLength(1);
		expect(organizerReservations[0]).toMatchObject({
			title: 'Water bottle',
			reserverLabel: 'Frosty'
		});
		await expect(
			organizerCaller.reservations.adminSetStatus({
				reservationId: reservation.reservationId,
				status: 'purchased',
				reason: 'Organizer confirmed that the item was already purchased.'
			})
		).resolves.toEqual({ success: true });
		expect(db.select().from(giftReservationAuditLog).all()).toHaveLength(1);
	});

	it('rejects attempts to reserve an idea from the same participant', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const idea = await alice.wishlists.create({ title: 'A new book' });

		await expect(alice.reservations.reserve({ giftSuggestionId: idea.id })).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
	});

	it('preserves gift ideas with reservation history', async () => {
		const alice = appRouter.createCaller(createContext(participants[0]));
		const bob = appRouter.createCaller(createContext(participants[1]));
		const idea = await bob.wishlists.create({ title: 'Collectible ornament' });
		await alice.reservations.reserve({ giftSuggestionId: idea.id });

		await expect(bob.wishlists.delete({ id: idea.id })).rejects.toMatchObject({
			code: 'CONFLICT'
		});
		expect(db.select().from(giftReservations).all()).toHaveLength(1);
	});
});
