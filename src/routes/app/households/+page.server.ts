import { asc, count, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireOrganizerPage } from '#lib/server/page-guards.js';
import { db } from '#lib/server/db/index.js';
import { households, users } from '#lib/server/db/schema.js';

export const load: PageServerLoad = ({ locals }) => {
	requireOrganizerPage(locals.user);

	const householdRows = db.select().from(households).orderBy(asc(households.name)).all();
	const memberCounts = db
		.select({ householdId: users.householdId, memberCount: count() })
		.from(users)
		.where(sql`${users.householdId} is not null`)
		.groupBy(users.householdId)
		.all();
	const countByHousehold = new Map(memberCounts.map((row) => [row.householdId, row.memberCount]));

	return {
		households: householdRows.map((household) => ({
			id: household.id,
			name: household.name,
			memberCount: countByHousehold.get(household.id) ?? 0
		}))
	};
};
