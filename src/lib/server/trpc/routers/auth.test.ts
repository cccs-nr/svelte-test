import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AuthenticatedUser } from '#lib/auth.js';
import type { TRPCContext } from '#lib/server/trpc/context.js';
import { createDatabase } from '#lib/server/db/connection.js';
import { assignments, events, sessions, users } from '#lib/server/db/schema.js';
import { hashPassword } from '#lib/server/auth/password.js';
import { SESSION_COOKIE_NAME, type SessionCookieStore } from '#lib/server/auth/session.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { appRouter } from '#lib/server/trpc/router.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];
let requestNumber = 0;

function createCookieStore(): SessionCookieStore {
	const values = new Map<string, string>();

	return {
		get: (name) => values.get(name),
		set: (name, value) => values.set(name, value),
		delete: (name) => values.delete(name)
	};
}

function createContext(
	cookies: SessionCookieStore,
	requestOrigin = 'http://localhost',
	user: AuthenticatedUser | null = null
): TRPCContext {
	requestNumber += 1;
	const request = new Request('http://localhost/api/trpc/auth.login', {
		method: 'POST',
		headers: { origin: requestOrigin }
	});

	return {
		db,
		user,
		event: {
			request,
			url: new URL(request.url),
			getClientAddress: () => `192.0.2.${requestNumber}`,
			cookies
		}
	};
}

beforeEach(async () => {
	const database = createDatabase(':memory:');
	client = database.client;
	db = database.db;
	migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });

	db.insert(users)
		.values({
			id: 'organizer-id',
			username: 'organizer',
			displayName: 'Organizer',
			passwordHash: await hashPassword('correct-horse-battery-staple'),
			role: 'organizer',
			isParticipating: false
		})
		.run();
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('auth router', () => {
	it('signs in with a display name and supports legacy usernames', async () => {
		const cookies = createCookieStore();
		const caller = appRouter.createCaller(createContext(cookies));

		const user = await caller.auth.login({
			identifier: ' Organizer ',
			password: 'correct-horse-battery-staple'
		});

		expect(user).toEqual({
			id: 'organizer-id',
			username: 'organizer',
			displayName: 'Organizer',
			role: 'organizer',
			isParticipating: false,
			hasAvatar: false
		});
		expect(cookies.get(SESSION_COOKIE_NAME)).toBeDefined();
		await expect(
			caller.auth.login({ identifier: 'organizer', password: 'correct-horse-battery-staple' })
		).resolves.toMatchObject({ id: user.id });
	});

	it('allows open participant registration and signs the new participant in', async () => {
		const cookies = createCookieStore();
		const caller = appRouter.createCaller(createContext(cookies));

		const user = await caller.auth.register({
			displayName: 'New Member',
			password: ' !a'
		});

		expect(user).toMatchObject({
			displayName: 'New Member',
			role: 'participant',
			isParticipating: true,
			hasAvatar: false
		});
		expect(cookies.get(SESSION_COOKIE_NAME)).toBeDefined();

		const savedUser = db.select().from(users).where(eq(users.id, user.id)).get();
		expect(savedUser?.username).toBe('new.member');
		expect(savedUser?.role).toBe('participant');
		expect(savedUser?.isActive).toBe(true);
		await expect(
			caller.auth.login({ identifier: 'New Member', password: ' !a' })
		).resolves.toMatchObject({ id: user.id });

		const duplicateNameUser = await caller.auth.register({
			displayName: 'New Member',
			password: ' !b'
		});
		const duplicateNameAccount = db
			.select()
			.from(users)
			.where(eq(users.id, duplicateNameUser.id))
			.get();
		expect(duplicateNameAccount?.username).toBe('new.member.2');
		await expect(
			caller.auth.login({ identifier: 'New Member', password: ' !b' })
		).resolves.toMatchObject({ id: duplicateNameUser.id });
	});

	it('rejects passwords shorter than three characters', async () => {
		const caller = appRouter.createCaller(createContext(createCookieStore()));

		await expect(
			caller.auth.register({
				displayName: 'Short Pass',
				password: 'ab'
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('lets users update their display name and change their password', async () => {
		const cookies = createCookieStore();
		const anonymousContext = createContext(cookies);
		const caller = appRouter.createCaller(anonymousContext);
		const user = await caller.auth.login({
			identifier: 'Organizer',
			password: 'correct-horse-battery-staple'
		});
		const signedInCaller = appRouter.createCaller({ ...anonymousContext, user });

		await expect(
			signedInCaller.auth.updateProfile({ displayName: 'Family Organizer' })
		).resolves.toMatchObject({ displayName: 'Family Organizer' });
		await signedInCaller.auth.changePassword({
			currentPassword: 'correct-horse-battery-staple',
			newPassword: '? ='
		});

		const savedUser = db.select().from(users).where(eq(users.id, user.id)).get();
		expect(savedUser?.displayName).toBe('Family Organizer');
		expect(savedUser?.passwordHash).toBeDefined();
		expect(db.select().from(sessions).all()).toHaveLength(1);
		expect(cookies.get(SESSION_COOKIE_NAME)).toBeDefined();
		await expect(
			caller.auth.login({ identifier: 'Organizer', password: '? =' })
		).resolves.toMatchObject({ id: user.id });
	});

	it('lets an organizer opt in before assignments and prevents participant opt-out', async () => {
		const organizerCookies = createCookieStore();
		const organizerContext = createContext(organizerCookies);
		const organizer = await appRouter
			.createCaller(organizerContext)
			.auth.login({ identifier: 'Organizer', password: 'correct-horse-battery-staple' });
		const organizerCaller = appRouter.createCaller({ ...organizerContext, user: organizer });

		await expect(
			organizerCaller.auth.updateProfile({
				displayName: 'Organizer',
				isParticipating: true
			})
		).resolves.toMatchObject({ role: 'organizer', isParticipating: true });

		const participantCookies = createCookieStore();
		const participantContext = createContext(participantCookies);
		const participant = await appRouter.createCaller(participantContext).auth.register({
			displayName: 'Member',
			password: 'a-strong-registration-password'
		});
		const participantCaller = appRouter.createCaller({
			...participantContext,
			user: participant
		});

		await expect(
			participantCaller.auth.updateProfile({
				displayName: 'Member',
				isParticipating: false
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('prevents an organizer from changing participation while assignments exist', async () => {
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
			.values({
				id: 'participant-id',
				username: 'participant',
				displayName: 'Participant',
				passwordHash: 'not-used-by-participation-test',
				role: 'participant',
				isParticipating: true
			})
			.run();
		db.insert(assignments)
			.values({
				id: 'assignment',
				eventId: SINGLE_EVENT_ID,
				giverId: 'organizer-id',
				receiverId: 'participant-id',
				finalizedAt: new Date()
			})
			.run();
		const cookies = createCookieStore();
		const context = createContext(cookies);
		const organizer = await appRouter
			.createCaller(context)
			.auth.login({ identifier: 'Organizer', password: 'correct-horse-battery-staple' });
		const caller = appRouter.createCaller({ ...context, user: organizer });

		await expect(
			caller.auth.updateProfile({ displayName: 'Organizer', isParticipating: true })
		).rejects.toMatchObject({ code: 'CONFLICT' });
	});

	it('uses a generic error for invalid credentials', async () => {
		const caller = appRouter.createCaller(createContext(createCookieStore()));

		await expect(
			caller.auth.login({
				identifier: 'unknown-user',
				password: 'correct-horse-battery-staple'
			})
		).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
			message: 'The name or password is not correct.'
		});
	});

	it('rejects cross-origin authentication mutations', async () => {
		const cookies = createCookieStore();
		const context = createContext(cookies, 'http://attacker.example');

		await expect(
			appRouter.createCaller(context).auth.login({
				identifier: 'organizer',
				password: 'correct-horse-battery-staple'
			})
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});
});
