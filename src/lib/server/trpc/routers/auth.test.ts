import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { TRPCContext } from '#lib/server/trpc/context.js';
import { createDatabase } from '#lib/server/db/connection.js';
import { users } from '#lib/server/db/schema.js';
import { hashPassword } from '#lib/server/auth/password.js';
import { SESSION_COOKIE_NAME, type SessionCookieStore } from '#lib/server/auth/session.js';
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
	requestOrigin = 'http://localhost'
): TRPCContext {
	requestNumber += 1;
	const request = new Request('http://localhost/api/trpc/auth.login', {
		method: 'POST',
		headers: { origin: requestOrigin }
	});

	return {
		db,
		user: null,
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
			role: 'organizer'
		})
		.run();
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('auth router', () => {
	it('signs in with normalized usernames and creates a secure session cookie', async () => {
		const cookies = createCookieStore();
		const caller = appRouter.createCaller(createContext(cookies));

		const user = await caller.auth.login({
			username: ' ORGANIZER ',
			password: 'correct-horse-battery-staple'
		});

		expect(user).toEqual({
			id: 'organizer-id',
			username: 'organizer',
			displayName: 'Organizer',
			role: 'organizer'
		});
		expect(cookies.get(SESSION_COOKIE_NAME)).toBeDefined();
	});

	it('uses a generic error for invalid credentials', async () => {
		const caller = appRouter.createCaller(createContext(createCookieStore()));

		await expect(
			caller.auth.login({ username: 'unknown-user', password: 'correct-horse-battery-staple' })
		).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
			message: 'The username or password is not correct.'
		});
	});

	it('rejects cross-origin authentication mutations', async () => {
		const cookies = createCookieStore();
		const context = createContext(cookies, 'http://attacker.example');

		await expect(
			appRouter.createCaller(context).auth.login({
				username: 'organizer',
				password: 'correct-horse-battery-staple'
			})
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});
});
