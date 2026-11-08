import type { RequestEvent } from '@sveltejs/kit';
import type { AuthenticatedUser } from '#lib/auth.js';
import { db } from '#lib/server/db/index.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import type { SessionCookieStore } from '#lib/server/auth/session.js';

export interface TRPCRequestContext {
	request: Request;
	url: URL;
	getClientAddress(): string;
	cookies: SessionCookieStore;
}

export interface TRPCContext {
	event: TRPCRequestContext;
	user: AuthenticatedUser | null;
	db: AppDatabase;
}

export function createTRPCContext(event: RequestEvent): TRPCContext {
	return {
		event: {
			request: event.request,
			url: event.url,
			getClientAddress: () => event.getClientAddress(),
			cookies: {
				get: (name) => event.cookies.get(name),
				set: (name, value, options) => event.cookies.set(name, value, options),
				delete: (name, options) => event.cookies.delete(name, options)
			}
		},
		user: event.locals.user,
		db
	};
}
