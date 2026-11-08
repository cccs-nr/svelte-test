import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import { MAX_IMAGE_BYTES } from '$app/env/private';
import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db/index.js';
import { assignments, households, users } from '#lib/server/db/schema.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');

	const profile = db
		.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			role: users.role,
			isParticipating: users.isParticipating,
			avatarKey: users.avatarKey,
			avatarVersion: users.updatedAt,
			householdName: households.name
		})
		.from(users)
		.leftJoin(households, eq(users.householdId, households.id))
		.where(eq(users.id, locals.user.id))
		.get();

	if (!profile) redirect(303, '/login');
	const { avatarKey, avatarVersion, ...profileDetails } = profile;
	const hasAssignments = Boolean(
		db
			.select({ id: assignments.id })
			.from(assignments)
			.where(eq(assignments.eventId, SINGLE_EVENT_ID))
			.get()
	);
	return {
		profile: {
			...profileDetails,
			hasAvatar: Boolean(avatarKey),
			avatarVersion: avatarVersion.getTime()
		},
		maxImageBytes: MAX_IMAGE_BYTES,
		canChangeParticipation: !hasAssignments
	};
};
