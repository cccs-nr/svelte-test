import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The help page became the welcome page; keep old links working.
export const GET: RequestHandler = () => {
	redirect(308, resolve('/app/welcome'));
};
