import { eq } from 'drizzle-orm';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { db } from '#lib/server/db/index.js';
import { events } from '#lib/server/db/schema.js';

export function getEventSummary() {
	return (
		db
			.select({
				name: events.name,
				exchangeDate: events.exchangeDate,
				giftBudgetCents: events.giftBudgetCents,
				currency: events.currency
			})
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get() ?? null
	);
}
