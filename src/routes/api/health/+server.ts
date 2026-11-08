import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { client } from '#lib/server/db/index.js';

export const GET: RequestHandler = () => {
	client.prepare('SELECT 1').get();
	return json({ status: 'ok' });
};
