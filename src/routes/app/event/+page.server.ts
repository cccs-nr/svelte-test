import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { requireOrganizerPage } from '#lib/server/page-guards.js';
import { db } from '#lib/server/db/index.js';
import { events } from '#lib/server/db/schema.js';

export const load: PageServerLoad = ({ locals }) => {
	requireOrganizerPage(locals.user);

	const event =
		db
			.select({
				id: events.id,
				name: events.name,
				description: events.description,
				exchangeDate: events.exchangeDate,
				giftBudgetCents: events.giftBudgetCents,
				currency: events.currency,
				instructions: events.instructions,
				status: events.status
			})
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get() ?? null;

	return { event };
};
