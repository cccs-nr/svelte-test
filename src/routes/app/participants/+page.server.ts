import { asc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireOrganizerPage } from '#lib/server/page-guards.js';
import { db } from '#lib/server/db/index.js';
import { households, users } from '#lib/server/db/schema.js';

export const load: PageServerLoad = ({ locals }) => {
	const organizer = requireOrganizerPage(locals.user);
	const accounts = db
		.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			role: users.role,
			isActive: users.isActive,
			householdId: users.householdId,
			householdName: households.name
		})
		.from(users)
		.leftJoin(households, eq(users.householdId, households.id))
		.orderBy(asc(users.displayName), asc(users.username))
		.all();
	const householdOptions = db
		.select({ id: households.id, name: households.name })
		.from(households)
		.orderBy(asc(households.name))
		.all();

	return { accounts, householdOptions, currentUserId: organizer.id };
};
