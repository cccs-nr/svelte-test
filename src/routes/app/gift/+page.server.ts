import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireParticipantPage } from '#lib/server/page-guards.js';

export const load: PageServerLoad = ({ locals }) => {
	requireParticipantPage(locals.user);
	redirect(303, '/app/wishlist?tab=recipient');
};
