import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDatabase } from '#lib/server/db/connection.js';
import { sessions, users } from '#lib/server/db/schema.js';
import {
	createUserSession,
	deleteUserSession,
	resolveSessionUser,
	SESSION_COOKIE_NAME,
	type SessionCookieOptions,
	type SessionCookieStore
} from './session.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];
const cookieValues = new Map<string, string>();
let cookieOptions: SessionCookieOptions | undefined;

const cookies: SessionCookieStore = {
	get(name) {
		return cookieValues.get(name);
	},
	set(name, value, options) {
		cookieValues.set(name, value);
		cookieOptions = options;
	},
	delete(name) {
		cookieValues.delete(name);
	}
};

beforeEach(() => {
	const database = createDatabase(':memory:');
	client = database.client;
	db = database.db;
	cookieValues.clear();
	cookieOptions = undefined;
	migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
	db.insert(users)
		.values({
			id: 'participant-id',
			username: 'participant',
			displayName: 'Participant',
			passwordHash: 'not-used-by-session-test',
			role: 'participant',
			isParticipating: true
		})
		.run();
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('session management', () => {
	it('stores only a token hash and returns the minimum user details', () => {
		createUserSession(db, 'participant-id', cookies);

		const rawToken = cookies.get(SESSION_COOKIE_NAME);
		const storedSession = db.select().from(sessions).get();

		expect(rawToken).toBeDefined();
		expect(storedSession?.tokenHash).not.toBe(rawToken);
		expect(cookieOptions).toMatchObject({
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 24 * 60 * 60
		});
		expect(resolveSessionUser(db, cookies)).toEqual({
			id: 'participant-id',
			username: 'participant',
			displayName: 'Participant',
			role: 'participant',
			isParticipating: true
		});
	});

	it('renews a session that is past half of its lifetime', () => {
		createUserSession(db, 'participant-id', cookies);
		const storedSession = db.select().from(sessions).get();
		if (!storedSession) throw new Error('Expected a session record to be created.');
		const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
		db.update(sessions).set({ expiresAt: soon }).where(eq(sessions.id, storedSession.id)).run();

		expect(resolveSessionUser(db, cookies)).not.toBeNull();
		const renewed = db.select().from(sessions).get();
		expect(renewed?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 24 * 60 * 60 * 1000);
	});

	it('revokes the server session and clears the cookie on logout', () => {
		createUserSession(db, 'participant-id', cookies);
		deleteUserSession(db, cookies);

		expect(cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
		expect(db.select().from(sessions).all()).toHaveLength(0);
	});

	it('clears expired sessions instead of authenticating the user', () => {
		createUserSession(db, 'participant-id', cookies);
		const storedSession = db.select().from(sessions).get();
		if (!storedSession) throw new Error('Expected a session record to be created.');

		db.update(sessions)
			.set({ expiresAt: new Date(Date.now() - 1_000) })
			.where(eq(sessions.id, storedSession.id))
			.run();

		expect(resolveSessionUser(db, cookies)).toBeNull();
		expect(cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
	});
});
