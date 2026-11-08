import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) {
		return new Response(null, {
			status: 401,
			headers: { 'cache-control': 'no-store' }
		});
	}

	return json(
		{ userId: locals.user.id, role: locals.user.role },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
