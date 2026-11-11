import { and, eq, isNotNull } from 'drizzle-orm';
import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isExchangeParticipant } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { db } from '#lib/server/db/index.js';
import { assignments, events, users } from '#lib/server/db/schema.js';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, resolve('/login'));
	const user = {
		id: locals.user.id,
		displayName: locals.user.displayName,
		role: locals.user.role,
		isParticipating: locals.user.isParticipating
	};

	const event =
		db
			.select({
				name: events.name,
				exchangeDate: events.exchangeDate,
				giftBudgetCents: events.giftBudgetCents,
				currency: events.currency
			})
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get() ?? null;

	if (!isExchangeParticipant(locals.user)) return { user, event, participant: null };

	const assignment = db
		.select({ recipientId: assignments.receiverId, giftPurchasedAt: assignments.giftPurchasedAt })
		.from(assignments)
		.where(
			and(
				eq(assignments.eventId, SINGLE_EVENT_ID),
				eq(assignments.giverId, locals.user.id),
				isNotNull(assignments.finalizedAt)
			)
		)
		.get();
	const recipient = assignment
		? (db
				.select({
					displayName: users.displayName,
					avatarKey: users.avatarKey,
					avatarVersion: users.updatedAt
				})
				.from(users)
				.where(eq(users.id, assignment.recipientId))
				.get() ?? null)
		: null;

	return {
		user,
		event,
		participant: {
			recipientId: recipient ? (assignment?.recipientId ?? null) : null,
			recipientDisplayName: recipient?.displayName ?? null,
			recipientHasAvatar: Boolean(recipient?.avatarKey),
			recipientAvatarVersion: recipient?.avatarVersion.getTime() ?? 0,
			giftPurchasedAt: assignment?.giftPurchasedAt?.toISOString() ?? null
		}
	};
};
