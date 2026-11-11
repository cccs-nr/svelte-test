import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireOrganizerPage } from '#lib/server/page-guards.js';

export const load: PageServerLoad = ({ locals }) => {
	requireOrganizerPage(locals.user);
	redirect(303, resolve('/app/dashboard#event'));
};
