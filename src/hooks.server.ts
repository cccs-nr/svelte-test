import type { Handle } from '@sveltejs/kit/hooks';
import { resolveActingUser, resolveSessionUser } from '#lib/server/auth/session.js';
import { db } from '#lib/server/db/index.js';

export const handle: Handle = async ({ event, resolve }) => {
	const accountUser = resolveSessionUser(db, event.cookies);
	event.locals.accountUser = accountUser;
	event.locals.user = resolveActingUser(db, accountUser, event.cookies);
	return resolve(event);
};
