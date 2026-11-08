import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isExchangeParticipant } from '#lib/auth.js';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getParticipantBadgeCounts } from '#lib/server/notification-counts.js';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	const avatar = db
		.select({ key: users.avatarKey, updatedAt: users.updatedAt })
		.from(users)
		.where(eq(users.id, locals.user.id))
		.get();
	const badgeCounts = isExchangeParticipant(locals.user)
		? getParticipantBadgeCounts(db, locals.user.id)
		: { wishlist: 0, gift: 0 };
	return {
		user: locals.user,
		hasAvatar: Boolean(avatar?.key),
		avatarVersion: avatar?.updatedAt.getTime() ?? 0,
		badgeCounts
	};
};
