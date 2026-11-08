import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AuthenticatedUser } from '#lib/auth.js';
import type { TRPCContext } from '#lib/server/trpc/context.js';
import { createDatabase } from '#lib/server/db/connection.js';
import { users } from '#lib/server/db/schema.js';
import type { SessionCookieStore } from '#lib/server/auth/session.js';
import { appRouter } from '#lib/server/trpc/router.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];

function createContext(user: AuthenticatedUser): TRPCContext {
	const request = new Request('http://localhost/api/trpc/households.list', {
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
			getClientAddress: () => '192.0.2.91',
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

const participant: AuthenticatedUser = {
	id: 'participant-id',
	username: 'participant',
	displayName: 'Participant',
	role: 'participant',
	isParticipating: true
};

beforeEach(() => {
	const database = createDatabase(':memory:');
	client = database.client;
	db = database.db;
	migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('household router', () => {
	it('creates and edits household membership in one operation', async () => {
		db.insert(users)
			.values([
				{
					id: 'participant-one',
					username: 'participant-one',
					displayName: 'Participant One',
					passwordHash: 'not-used-by-household-test',
					role: 'participant'
				},
				{
					id: 'participant-two',
					username: 'participant-two',
					displayName: 'Participant Two',
					passwordHash: 'not-used-by-household-test',
					role: 'participant'
				}
			])
			.run();
		const caller = appRouter.createCaller(createContext(organizer));
		const household = await caller.households.create({
			name: 'Family A',
			participantIds: ['participant-one']
		});

		expect(household.members).toEqual([{ id: 'participant-one', displayName: 'Participant One' }]);
		await caller.households.update({
			id: household.id,
			name: 'Family B',
			participantIds: ['participant-two']
		});

		const members = await caller.households.list();
		expect(members).toMatchObject([
			{
				id: household.id,
				name: 'Family B',
				memberCount: 1,
				members: [{ id: 'participant-two', displayName: 'Participant Two' }]
			}
		]);
		const previousMember = db
			.select({ householdId: users.householdId })
			.from(users)
			.where(eq(users.id, 'participant-one'))
			.get();
		expect(previousMember?.householdId).toBeNull();
	});

	it('creates households with case-insensitive unique names', async () => {
		const caller = appRouter.createCaller(createContext(organizer));
		const household = await caller.households.create({ name: 'The Lees' });

		expect(household).toMatchObject({ name: 'The Lees', memberCount: 0 });
		await expect(caller.households.create({ name: ' the lees ' })).rejects.toMatchObject({
			code: 'CONFLICT'
		});
	});

	it('updates names and clears member links when a household is removed', async () => {
		const caller = appRouter.createCaller(createContext(organizer));
		const household = await caller.households.create({ name: 'Family A' });
		db.insert(users)
			.values({
				id: 'participant-id',
				username: 'participant',
				displayName: 'Participant',
				passwordHash: 'not-used-by-household-test',
				role: 'participant',
				householdId: household.id
			})
			.run();

		await expect(caller.households.list()).resolves.toMatchObject([
			{ id: household.id, name: 'Family A', memberCount: 1 }
		]);
		await caller.households.update({ id: household.id, name: 'Family B' });
		await caller.households.remove(household.id);

		const member = db.select().from(users).where(eq(users.id, 'participant-id')).get();
		expect(member?.householdId).toBeNull();
		await expect(caller.households.list()).resolves.toEqual([]);
	});

	it('restricts household management to organizers', async () => {
		const caller = appRouter.createCaller(createContext(participant));

		await expect(caller.households.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});
});
