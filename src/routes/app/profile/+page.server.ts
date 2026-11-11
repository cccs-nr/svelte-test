import { eq } from 'drizzle-orm';
import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { MAX_IMAGE_BYTES } from '$app/env/private';
import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db/index.js';
import { getAvailableCodenames, getParticipantCodename } from '#lib/server/codenames.js';
import { assignments, events, households, users } from '#lib/server/db/schema.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { isActiveExchangeParticipant } from '#lib/server/wishlist-access.js';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, resolve('/login'));

	const profile = db
		.select({
			id: users.id,
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

	if (!profile) redirect(303, resolve('/login'));
	const { avatarKey, avatarVersion, ...profileDetails } = profile;
	const hasAssignments = Boolean(
		db
			.select({ id: assignments.id })
			.from(assignments)
			.where(eq(assignments.eventId, SINGLE_EVENT_ID))
			.get()
	);
	const event = db
		.select({ status: events.status, revealedAt: events.revealedAt })
		.from(events)
		.where(eq(events.id, SINGLE_EVENT_ID))
		.get();
	const hasParticipantAccess = isActiveExchangeParticipant(db, locals.user.id);
	const codename = hasParticipantAccess
		? (getParticipantCodename(db, locals.user.id)?.codename ?? null)
		: null;
	const canChangeCodename = Boolean(
		codename && event && event.status !== 'completed' && !event.revealedAt
	);
	const availableCodenameCount = canChangeCodename
		? getAvailableCodenames(db, locals.user.id).length
		: 0;
	return {
		profile: {
			...profileDetails,
			hasAvatar: Boolean(avatarKey),
			avatarVersion: avatarVersion.getTime(),
			codename
		},
		maxImageBytes: MAX_IMAGE_BYTES,
		canChangeParticipation: !hasAssignments,
		canChangeCodename,
		availableCodenameCount
	};
};
