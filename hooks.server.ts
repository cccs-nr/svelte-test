import type { Handle } from '@sveltejs/kit/hooks';
import { resolveSessionUser } from '#lib/server/auth/session.js';
import { db } from '#lib/server/db/index.js';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = resolveSessionUser(db, event.cookies);
	return resolve(event);
};
