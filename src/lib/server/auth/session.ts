import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import type { AuthenticatedUser } from '#lib/auth.js';
import { sessions, users } from '#lib/server/db/schema.js';
import type { AppDatabase } from '#lib/server/db/connection.js';

export const SESSION_COOKIE_NAME = 'secret_santa_session';

const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

export interface SessionCookieOptions {
	path: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'lax' | 'strict' | 'none';
	maxAge?: number;
}

export interface SessionCookieStore {
	get(name: string): string | undefined;
	set(name: string, value: string, options: SessionCookieOptions): void;
	delete(name: string, options: { path: string }): void;
}

function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function clearSessionCookie(cookies: SessionCookieStore): void {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

export function createUserSession(
	database: AppDatabase,
	userId: string,
	cookies: SessionCookieStore
): void {
	const now = new Date();
	const token = randomBytes(32).toString('base64url');

	database.delete(sessions).where(lt(sessions.expiresAt, now)).run();
	database
		.insert(sessions)
		.values({
			id: randomUUID(),
			userId,
			tokenHash: hashSessionToken(token),
			expiresAt: new Date(now.getTime() + SESSION_TTL_MS)
		})
		.run();

	cookies.set(SESSION_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: SESSION_TTL_SECONDS
	});
}

export function deleteUserSession(database: AppDatabase, cookies: SessionCookieStore): void {
	const token = cookies.get(SESSION_COOKIE_NAME);

	if (token) {
		database
			.delete(sessions)
			.where(eq(sessions.tokenHash, hashSessionToken(token)))
			.run();
	}

	clearSessionCookie(cookies);
}

export function resolveSessionUser(
	database: AppDatabase,
	cookies: SessionCookieStore
): AuthenticatedUser | null {
	const token = cookies.get(SESSION_COOKIE_NAME);
	if (!token) return null;

	const tokenHash = hashSessionToken(token);
	const session = database.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).get();

	if (!session || session.expiresAt.getTime() <= Date.now()) {
		if (session) database.delete(sessions).where(eq(sessions.id, session.id)).run();
		clearSessionCookie(cookies);
		return null;
	}

	const user = database
		.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			role: users.role,
			isParticipating: users.isParticipating
		})
		.from(users)
		.where(and(eq(users.id, session.userId), eq(users.isActive, true)))
		.get();

	if (!user) {
		database.delete(sessions).where(eq(sessions.id, session.id)).run();
		clearSessionCookie(cookies);
		return null;
	}

	return {
		...user,
		isParticipating: user.role === 'participant' || user.isParticipating
	};
}
