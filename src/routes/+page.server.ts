import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The first page visitors see is the "create an account" welcome page.
export const load: PageServerLoad = ({ locals }) => {
	redirect(303, resolve(locals.user ? '/app' : '/register'));
};
