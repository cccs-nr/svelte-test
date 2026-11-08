import { eq } from 'drizzle-orm';
import { createUsernameCandidate } from '#lib/auth.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { users } from '#lib/server/db/schema.js';

export function createUniqueUsername(database: AppDatabase, displayName: string): string {
	for (let suffix = 1; ; suffix += 1) {
		const candidate = createUsernameCandidate(displayName, suffix);
		const existing = database
			.select({ id: users.id })
			.from(users)
			.where(eq(users.username, candidate))
			.get();
		if (!existing) return candidate;
	}
}
