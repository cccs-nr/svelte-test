import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { MAX_IMAGE_BYTES } from '$app/env/private';
import type { PageServerLoad } from './$types';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { db } from '#lib/server/db/index.js';
import { events } from '#lib/server/db/schema.js';
import { requireParticipantPage } from '#lib/server/page-guards.js';

export const load: PageServerLoad = ({ locals, url }) => {
	requireParticipantPage(locals.user);
	const legacyTab = url.searchParams.get('tab');
	if (legacyTab === 'recipient') redirect(303, '/app/gift-giving');
	if (legacyTab === 'family') redirect(303, '/app/gift-giving');
	if (legacyTab === 'messages') redirect(303, '/app/messages');

	const event = db
		.select({ giftBudgetCents: events.giftBudgetCents, currency: events.currency })
		.from(events)
		.where(eq(events.id, SINGLE_EVENT_ID))
		.get();

	return {
		giftBudgetCents: event?.giftBudgetCents ?? null,
		currency: event?.currency ?? 'CAD',
		maxImageBytes: MAX_IMAGE_BYTES
	};
};
