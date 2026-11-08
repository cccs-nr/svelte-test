import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AuthenticatedUser } from '#lib/auth.js';
import type { TRPCContext } from '#lib/server/trpc/context.js';
import { createDatabase } from '#lib/server/db/connection.js';
import { verifyPassword } from '#lib/server/auth/password.js';
import { createUserSession, type SessionCookieStore } from '#lib/server/auth/session.js';
import { sessions, users } from '#lib/server/db/schema.js';
import { appRouter } from '#lib/server/trpc/router.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];

function createCookieStore(): SessionCookieStore {
	const values = new Map<string, string>();

	return {
		get: (name) => values.get(name),
		set: (name, value) => values.set(name, value),
		delete: (name) => values.delete(name)
	};
}

function createContext(user: AuthenticatedUser): TRPCContext {
	const request = new Request('http://localhost/api/trpc/participants.list', {
		method: 'POST',
		headers: { origin: 'http://localhost' }
	});

	return {
		db,
		user,
		event: {
			request,
			url: new URL(request.url),
			getClientAddress: () => '192.0.2.92',
			cookies: createCookieStore()
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
	db.insert(users)
		.values({
			id: organizer.id,
			username: organizer.username,
			displayName: organizer.displayName,
			passwordHash: 'not-used-by-participant-router-test',
			role: organizer.role
		})
		.run();
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('participant management', () => {
	it('creates accounts from names with internal usernames and never returns password hashes', async () => {
		const caller = appRouter.createCaller(createContext(organizer));
		const account = await caller.participants.create({
			displayName: 'New Member',
			password: 'a-strong-initial-password',
			role: 'participant',
			householdId: null
		});

		expect(account).toMatchObject({
			displayName: 'New Member',
			role: 'participant',
			isParticipating: true,
			isActive: true,
			householdId: null,
			householdName: null
		});
		expect(account).not.toHaveProperty('passwordHash');

		const savedUser = db.select().from(users).where(eq(users.id, account.id)).get();
		if (!savedUser) throw new Error('Expected the new account to be stored.');
		expect(savedUser.username).toBe('new.member');
		await expect(verifyPassword('a-strong-initial-password', savedUser.passwordHash)).resolves.toBe(
			true
		);

		const organizerAccount = await caller.participants.create({
			displayName: 'Second Organizer',
			password: 'a-strong-organizer-password',
			role: 'organizer',
			householdId: null
		});
		expect(organizerAccount.isParticipating).toBe(false);
	});

	it('prevents disabling or demoting the last active organizer', async () => {
		const caller = appRouter.createCaller(createContext(organizer));

		await expect(
			caller.participants.update({
				id: organizer.id,
				displayName: organizer.displayName,
				role: 'participant',
				isActive: true,
				householdId: null
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });

		await expect(
			caller.participants.update({
				id: organizer.id,
				displayName: organizer.displayName,
				role: 'organizer',
				isActive: false,
				householdId: null
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('deactivates accounts and revokes their sessions', async () => {
		const participantId = 'participant-id';
		db.insert(users)
			.values({
				id: participantId,
				username: participant.username,
				displayName: participant.displayName,
				passwordHash: 'not-used-by-session-revocation-test',
				role: participant.role
			})
			.run();
		const cookies = createCookieStore();
		createUserSession(db, participantId, cookies);

		await appRouter.createCaller(createContext(organizer)).participants.update({
			id: participantId,
			displayName: participant.displayName,
			role: participant.role,
			isActive: false,
			householdId: null
		});

		const savedUser = db.select().from(users).where(eq(users.id, participantId)).get();
		const activeSessions = db
			.select()
			.from(sessions)
			.where(eq(sessions.userId, participantId))
			.all();
		expect(savedUser?.isActive).toBe(false);
		expect(activeSessions).toHaveLength(0);
	});

	it('restricts account administration to organizers', async () => {
		const caller = appRouter.createCaller(createContext(participant));

		await expect(caller.participants.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});
});
