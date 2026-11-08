import type { PageServerLoad } from './$types';
import { requireParticipantPage } from '#lib/server/page-guards.js';

export const load: PageServerLoad = ({ locals }) => {
	requireParticipantPage(locals.user);
	return {};
};
