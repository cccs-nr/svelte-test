import { and, count, eq, isNotNull, or } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isExchangeParticipant } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { db } from '#lib/server/db/index.js';
import { assignments, events, households, users } from '#lib/server/db/schema.js';

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
	const ownAssignment = isExchangeParticipant(locals.user)
		? db
				.select({ receiverId: assignments.receiverId })
				.from(assignments)
				.where(
					and(
						eq(assignments.eventId, SINGLE_EVENT_ID),
						eq(assignments.giverId, locals.user.id),
						isNotNull(assignments.finalizedAt)
					)
				)
				.get()
		: null;
	const recipient = ownAssignment
		? (db
				.select({ displayName: users.displayName })
				.from(users)
				.where(eq(users.id, ownAssignment.receiverId))
				.get() ?? null)
		: null;

	let organizerStats: {
		totalParticipants: number;
		activeAccounts: number;
		householdCount: number;
		assignmentCount: number;
		assignmentsFinalized: boolean;
	} | null = null;

	if (locals.user.role === 'organizer') {
		const assignmentRows = db
			.select({ finalizedAt: assignments.finalizedAt })
			.from(assignments)
			.where(eq(assignments.eventId, SINGLE_EVENT_ID))
			.all();

		organizerStats = {
			totalParticipants:
				db
					.select({ value: count() })
					.from(users)
					.where(or(eq(users.role, 'participant'), eq(users.isParticipating, true)))
					.get()?.value ?? 0,
			activeAccounts:
				db.select({ value: count() }).from(users).where(eq(users.isActive, true)).get()?.value ?? 0,
			householdCount: db.select({ value: count() }).from(households).get()?.value ?? 0,
			assignmentCount: assignmentRows.length,
			assignmentsFinalized:
				assignmentRows.length > 0 &&
				assignmentRows.every((assignment) => assignment.finalizedAt !== null)
		};
	}

	return { user: locals.user, event, organizerStats, recipient };
};
