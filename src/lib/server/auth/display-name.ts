import { and, ne, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { users } from '#lib/server/db/schema.js';

/**
 * Rejects a display name that another account already uses (ignoring case), either as a name or as
 * an account name, because people sign in with either and duplicates would be ambiguous.
 */
export function assertDisplayNameAvailable(
	database: Pick<AppDatabase, 'select'>,
	displayName: string,
	exceptUserId?: string
): void {
	const name = displayName.trim();
	const clash = database
		.select({ id: users.id })
		.from(users)
		.where(
			and(
				or(
					sql`lower(${users.displayName}) = lower(${name})`,
					sql`lower(${users.username}) = lower(${name})`
				),
				exceptUserId ? ne(users.id, exceptUserId) : undefined
			)
		)
		.get();

	if (clash) {
		throw new TRPCError({
			code: 'CONFLICT',
			message:
				'That name is already taken. If this is you, sign in instead. Otherwise, add something to your name, such as your last name.'
		});
	}
}
