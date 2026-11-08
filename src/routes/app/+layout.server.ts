import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { countUnreadMessages } from '#lib/server/messaging.js';
import { db } from '#lib/server/db/index.js';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	return {
		user: locals.user,
		unreadMessageCount:
			locals.user.role === 'participant' || locals.user.isParticipating
				? countUnreadMessages(db, locals.user.id)
				: 0
	};
};
