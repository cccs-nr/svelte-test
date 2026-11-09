import { and, eq, isNotNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { db } from '#lib/server/db/index.js';
import { assignments, events, users } from '#lib/server/db/schema.js';
import { requireParticipantPage } from '#lib/server/page-guards.js';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireParticipantPage(locals.user);
	const event = db
		.select({ giftBudgetCents: events.giftBudgetCents, currency: events.currency })
		.from(events)
		.where(eq(events.id, SINGLE_EVENT_ID))
		.get();
	const assignment = db
		.select({ id: users.id, displayName: users.displayName })
		.from(assignments)
		.innerJoin(users, eq(users.id, assignments.receiverId))
		.where(
			and(
				eq(assignments.eventId, SINGLE_EVENT_ID),
				eq(assignments.giverId, user.id),
				isNotNull(assignments.finalizedAt)
			)
		)
		.get();

	return {
		currentUserId: user.id,
		assignedRecipient: assignment ?? null,
		giftBudgetCents: event?.giftBudgetCents ?? null,
		currency: event?.currency ?? 'CAD'
	};
};
