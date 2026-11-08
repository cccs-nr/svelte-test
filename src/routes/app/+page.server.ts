import { count, eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { db } from '#lib/server/db/index.js';
import { events, households, users } from '#lib/server/db/schema.js';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');

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

	const organizerStats =
		locals.user.role === 'organizer'
			? {
					totalParticipants:
						db.select({ value: count() }).from(users).where(eq(users.role, 'participant')).get()
							?.value ?? 0,
					activeAccounts:
						db.select({ value: count() }).from(users).where(eq(users.isActive, true)).get()
							?.value ?? 0,
					householdCount: db.select({ value: count() }).from(households).get()?.value ?? 0
				}
			: null;

	return { user: locals.user, event, organizerStats };
};
