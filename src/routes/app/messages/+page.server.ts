import type { PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { requireParticipantPage } from '#lib/server/page-guards.js';
import { users } from '#lib/server/db/schema.js';

export const load: PageServerLoad = ({ locals }) => {
	const participant = requireParticipantPage(locals.user);
	const avatar = db
		.select({ key: users.avatarKey, updatedAt: users.updatedAt })
		.from(users)
		.where(eq(users.id, participant.id))
		.get();

	return {
		displayName: participant.displayName,
		hasAvatar: Boolean(avatar?.key),
		avatarVersion: avatar?.updatedAt.getTime() ?? 0
	};
};
