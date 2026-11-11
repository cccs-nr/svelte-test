import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AuthenticatedUser } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import {
	ACTING_AS_COOKIE_NAME,
	resolveActingUser,
	type SessionCookieStore
} from '#lib/server/auth/session.js';
import { hashPassword } from '#lib/server/auth/password.js';
import { createDatabase } from '#lib/server/db/connection.js';
import {
	assignments,
	events,
	giftReservationAuditLog,
	giftReservations,
	giftSuggestions,
	households,
	users,
	wishlistConversationParticipants,
	wishlistConversations,
	wishlistMessages
} from '#lib/server/db/schema.js';
import type { TRPCContext } from '#lib/server/trpc/context.js';
import { appRouter } from '#lib/server/trpc/router.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];
let cookieValues: Map<string, string>;

const mom: AuthenticatedUser = {
	id: 'mom',
	username: 'mom',
	displayName: 'Mom',
	role: 'participant',
	isParticipating: true
};
const sam: AuthenticatedUser = {
	id: 'sam',
	username: 'sam',
	displayName: 'Sam',
	role: 'participant',
	isParticipating: true
};
const organizer: AuthenticatedUser = {
	id: 'organizer',
	username: 'organizer',
	displayName: 'Organizer',
	role: 'organizer',
	isParticipating: false
};

function createCookies(): SessionCookieStore {
	return {
		get: (name) => cookieValues.get(name),
		set: (name, value) => void cookieValues.set(name, value),
		delete: (name) => void cookieValues.delete(name)
	};
}

function createCaller(user: AuthenticatedUser, accountUser: AuthenticatedUser = user) {
	const request = new Request('http://localhost/api/trpc/members.add', {
		method: 'POST',
		headers: { origin: 'http://localhost' }
	});
	const context: TRPCContext = {
		db,
		user,
		accountUser,
		event: {
			request,
			url: new URL(request.url),
			getClientAddress: () => '192.0.2.50',
			cookies: createCookies()
		}
	};
	return appRouter.createCaller(context);
}

beforeEach(async () => {
	cookieValues = new Map();
	const database = createDatabase(':memory:');
	client = database.client;
	db = database.db;
	migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
	db.insert(events)
		.values({
			id: SINGLE_EVENT_ID,
			name: 'Exchange',
			exchangeDate: '2026-12-24',
			giftBudgetCents: 5000,
			currency: 'CAD',
			status: 'open'
		})
		.run();
	const passwordHash = await hashPassword('secret123');
	db.insert(users)
		.values([mom, sam, organizer].map((user) => ({ ...user, passwordHash })))
		.run();
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('household members', () => {
	it('adds a managed participant to the same household without a login', async () => {
		const caller = createCaller(mom);
		const dad = await caller.members.add({ displayName: 'Dad' });

		const rows = db.select().from(users).all();
		const momRow = rows.find((row) => row.id === 'mom');
		const dadRow = rows.find((row) => row.id === dad.id);
		expect(dadRow?.managedByUserId).toBe('mom');
		expect(dadRow?.householdId).toBeTruthy();
		expect(dadRow?.householdId).toBe(momRow?.householdId);
		expect(db.select().from(households).all()).toHaveLength(1);

		await expect(
			createCaller(organizer).auth.login({
				identifier: 'Dad',
				password: '!managed-by-household-account'
			})
		).rejects.toThrow();
	});

	it('refuses a household member whose name is already used', async () => {
		const caller = createCaller(mom);
		await expect(caller.members.add({ displayName: 'sam' })).rejects.toThrow(/already taken/);
		await caller.members.add({ displayName: 'Dad' });
		await expect(caller.members.add({ displayName: 'DAD' })).rejects.toThrow(/already taken/);
	});

	it('lets the account switch to a managed participant and back', async () => {
		const caller = createCaller(mom);
		const dad = await caller.members.add({ displayName: 'Dad' });

		await caller.members.switchTo({ userId: dad.id });
		expect(cookieValues.get(ACTING_AS_COOKIE_NAME)).toBe(dad.id);
		expect(resolveActingUser(db, mom, createCookies())?.displayName).toBe('Dad');

		await caller.members.switchTo({ userId: 'mom' });
		expect(cookieValues.has(ACTING_AS_COOKIE_NAME)).toBe(false);

		cookieValues.set(ACTING_AS_COOKIE_NAME, dad.id);
		expect(resolveActingUser(db, sam, createCookies())?.id).toBe('sam');
		expect(cookieValues.has(ACTING_AS_COOKIE_NAME)).toBe(false);
	});

	it('manages wishlists on behalf of the managed participant', async () => {
		const dad = await createCaller(mom).members.add({ displayName: 'Dad' });
		const asDad: AuthenticatedUser = {
			id: dad.id,
			username: 'dad',
			displayName: 'Dad',
			role: 'participant',
			isParticipating: true
		};
		await createCaller(asDad, mom).wishlists.create({ title: 'Warm socks' });
		const dadItems = db
			.select()
			.from(giftSuggestions)
			.where(eq(giftSuggestions.ownerId, dad.id))
			.all();
		expect(dadItems).toHaveLength(1);
		expect(
			db.select().from(giftSuggestions).where(eq(giftSuggestions.ownerId, 'mom')).all()
		).toHaveLength(0);
	});

	it('blocks changes once the draw exists', async () => {
		db.insert(assignments)
			.values({ id: 'a1', eventId: SINGLE_EVENT_ID, giverId: 'mom', receiverId: 'sam' })
			.run();
		await expect(createCaller(mom).members.add({ displayName: 'Dad' })).rejects.toThrow(/draw/);
	});

	it('removes a managed participant and their data', async () => {
		const caller = createCaller(mom);
		const dad = await caller.members.add({ displayName: 'Dad' });
		await caller.members.remove({ userId: dad.id });
		expect(db.select().from(users).where(eq(users.id, dad.id)).all()).toHaveLength(0);
		await expect(caller.members.remove({ userId: 'sam' })).rejects.toThrow(/not found/);
	});
});

describe('organizer account deletion', () => {
	it('deletes an account with its household members and every related record', async () => {
		const momCaller = createCaller(mom);
		const dad = await momCaller.members.add({ displayName: 'Dad' });
		const asDad: AuthenticatedUser = { ...mom, id: dad.id, username: 'dad', displayName: 'Dad' };
		await createCaller(asDad, mom).wishlists.create({ title: 'Warm socks' });
		const suggestion = db
			.select()
			.from(giftSuggestions)
			.where(eq(giftSuggestions.ownerId, dad.id))
			.get()!;
		db.insert(giftReservations)
			.values({ id: 'reservation-1', giftSuggestionId: suggestion.id, reserverId: 'sam' })
			.run();
		db.insert(giftReservationAuditLog)
			.values({
				id: 'audit-1',
				reservationId: 'reservation-1',
				actorId: 'sam',
				fromStatus: 'released',
				toStatus: 'reserved',
				reason: 'test'
			})
			.run();
		db.insert(wishlistConversations)
			.values({
				id: 'conversation-1',
				eventId: SINGLE_EVENT_ID,
				wishlistOwnerId: 'mom',
				type: 'wishlist_discussion',
				title: 'Talk to Mom'
			})
			.run();
		db.insert(wishlistConversationParticipants)
			.values([
				{ conversationId: 'conversation-1', userId: 'mom' },
				{ conversationId: 'conversation-1', userId: 'sam' }
			])
			.run();
		db.insert(wishlistMessages)
			.values({ id: 'message-1', conversationId: 'conversation-1', senderId: 'sam', content: 'Hi' })
			.run();

		const result = await createCaller(organizer).participants.delete({ id: 'mom' });
		expect(result.deleted).toBe(2);
		expect(db.select().from(users).where(eq(users.id, 'mom')).all()).toHaveLength(0);
		expect(db.select().from(users).where(eq(users.id, dad.id)).all()).toHaveLength(0);
		expect(db.select().from(wishlistConversations).all()).toHaveLength(0);
		expect(db.select().from(wishlistMessages).all()).toHaveLength(0);
		expect(db.select().from(giftReservations).all()).toHaveLength(0);
		expect(db.all(sql`pragma foreign_key_check`)).toEqual([]);
	});

	it('protects the organizer, assigned participants, and the last organizer', async () => {
		const caller = createCaller(organizer);
		await expect(caller.participants.delete({ id: 'organizer' })).rejects.toThrow(/own account/);

		db.insert(assignments)
			.values({ id: 'a1', eventId: SINGLE_EVENT_ID, giverId: 'mom', receiverId: 'sam' })
			.run();
		await expect(caller.participants.delete({ id: 'sam' })).rejects.toThrow(/Reset assignments/);
	});
});
