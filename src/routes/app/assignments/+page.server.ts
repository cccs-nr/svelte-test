import type { PageServerLoad } from './$types';
import { requireOrganizerPage } from '#lib/server/page-guards.js';

export const load: PageServerLoad = ({ locals }) => {
	requireOrganizerPage(locals.user);
	return {};
};
