import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db/index.js';
import { households, users } from '#lib/server/db/schema.js';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');

	const profile = db
		.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			role: users.role,
			householdName: households.name
		})
		.from(users)
		.leftJoin(households, eq(users.householdId, households.id))
		.where(eq(users.id, locals.user.id))
		.get();

	if (!profile) redirect(303, '/login');
	return { profile };
};
