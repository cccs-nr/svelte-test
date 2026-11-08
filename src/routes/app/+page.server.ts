import { and, count, desc, eq, isNotNull } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isExchangeParticipant } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { countUnreadMessages, getRecentParticipantMessages } from '#lib/server/messaging.js';
import { db } from '#lib/server/db/index.js';
import { assignments, events, giftSuggestions, users } from '#lib/server/db/schema.js';

function getRecentIdeas(ownerId: string) {
	return db
		.select({
			id: giftSuggestions.id,
			title: giftSuggestions.title,
			updatedAt: giftSuggestions.updatedAt
		})
		.from(giftSuggestions)
		.where(eq(giftSuggestions.ownerId, ownerId))
		.orderBy(desc(giftSuggestions.updatedAt), desc(giftSuggestions.createdAt))
		.limit(3)
		.all()
		.map((suggestion) => ({
			...suggestion,
			updatedAt: suggestion.updatedAt.toISOString()
		}));
}

function getIdeaCount(ownerId: string): number {
	return (
		db
			.select({ value: count() })
			.from(giftSuggestions)
			.where(eq(giftSuggestions.ownerId, ownerId))
			.get()?.value ?? 0
	);
}

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');

	const event =
		db
			.select({
				name: events.name,
				exchangeDate: events.exchangeDate,
				giftBudgetCents: events.giftBudgetCents,
				currency: events.currency,
				status: events.status
			})
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get() ?? null;

	if (!isExchangeParticipant(locals.user)) {
		return { user: locals.user, event, participant: null };
	}

	const outgoingAssignment = db
		.select({
			receiverId: assignments.receiverId,
			giftPurchasedAt: assignments.giftPurchasedAt
		})
		.from(assignments)
		.where(
			and(
				eq(assignments.eventId, SINGLE_EVENT_ID),
				eq(assignments.giverId, locals.user.id),
				isNotNull(assignments.finalizedAt)
			)
		)
		.get();
	const incomingAssignment = db
		.select({ giftPurchasedAt: assignments.giftPurchasedAt })
		.from(assignments)
		.where(
			and(
				eq(assignments.eventId, SINGLE_EVENT_ID),
				eq(assignments.receiverId, locals.user.id),
				isNotNull(assignments.finalizedAt)
			)
		)
		.get();
	const recipient = outgoingAssignment
		? (db
				.select({ displayName: users.displayName })
				.from(users)
				.where(eq(users.id, outgoingAssignment.receiverId))
				.get() ?? null)
		: null;

	return {
		user: locals.user,
		event,
		participant: {
			myWishlistCount: getIdeaCount(locals.user.id),
			myRecentIdeas: getRecentIdeas(locals.user.id),
			recipientDisplayName: recipient?.displayName ?? null,
			recipientWishlistCount: outgoingAssignment ? getIdeaCount(outgoingAssignment.receiverId) : 0,
			recipientRecentIdeas: outgoingAssignment ? getRecentIdeas(outgoingAssignment.receiverId) : [],
			giftPurchasedAt: outgoingAssignment?.giftPurchasedAt?.toISOString() ?? null,
			recipientGiftPurchasedAt: incomingAssignment?.giftPurchasedAt?.toISOString() ?? null,
			unreadMessageCount: countUnreadMessages(db, locals.user.id),
			recentMessages: getRecentParticipantMessages(db, locals.user.id)
		}
	};
};
