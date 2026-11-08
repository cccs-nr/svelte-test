import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { countUnreadMessages } from '#lib/server/messaging.js';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	const avatar = db
		.select({ key: users.avatarKey, updatedAt: users.updatedAt })
		.from(users)
		.where(eq(users.id, locals.user.id))
		.get();
	const unreadMessageCount =
		locals.user.role === 'participant' || locals.user.isParticipating
			? countUnreadMessages(db, locals.user.id)
			: 0;
	return {
		user: locals.user,
		hasAvatar: Boolean(avatar?.key),
		avatarVersion: avatar?.updatedAt.getTime() ?? 0,
		unreadMessageCount
	};
};
