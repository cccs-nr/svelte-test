import { and, count, eq, gt, isNotNull, ne } from 'drizzle-orm';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import {
	assignments,
	giftConversationParticipants,
	giftConversationReads,
	giftMessages,
	giftSuggestions
} from '#lib/server/db/schema.js';
import { countUnreadMessageCounts } from '#lib/server/messaging.js';

export function getParticipantBadgeCounts(database: AppDatabase, userId: string) {
	const unread = countUnreadMessageCounts(database, userId);
	const giverAssignment = database
		.select({
			receiverId: assignments.receiverId,
			wishlistViewedAt: assignments.giverWishlistViewedAt
		})
		.from(assignments)
		.where(
			and(
				eq(assignments.eventId, SINGLE_EVENT_ID),
				eq(assignments.giverId, userId),
				isNotNull(assignments.finalizedAt)
			)
		)
		.get();
	const newIdeaCount = giverAssignment
		? (database
				.select({ value: count() })
				.from(giftSuggestions)
				.where(
					giverAssignment.wishlistViewedAt
						? and(
								eq(giftSuggestions.ownerId, giverAssignment.receiverId),
								gt(giftSuggestions.updatedAt, giverAssignment.wishlistViewedAt)
							)
						: eq(giftSuggestions.ownerId, giverAssignment.receiverId)
				)
				.get()?.value ?? 0)
		: 0;
	const receiverAssignment = database
		.select({
			giftPurchasedAt: assignments.giftPurchasedAt,
			statusSeenAt: assignments.receiverGiftStatusSeenAt
		})
		.from(assignments)
		.where(
			and(
				eq(assignments.eventId, SINGLE_EVENT_ID),
				eq(assignments.receiverId, userId),
				isNotNull(assignments.finalizedAt)
			)
		)
		.get();
	const hasUnseenPurchaseStatus = Boolean(
		receiverAssignment?.giftPurchasedAt &&
		(!receiverAssignment.statusSeenAt ||
			receiverAssignment.giftPurchasedAt > receiverAssignment.statusSeenAt)
	);
	const unreadFamilyMessages =
		database
			.select({ value: count() })
			.from(giftMessages)
			.innerJoin(
				giftConversationParticipants,
				and(
					eq(giftConversationParticipants.conversationId, giftMessages.conversationId),
					eq(giftConversationParticipants.userId, userId)
				)
			)
			.innerJoin(
				giftConversationReads,
				and(
					eq(giftConversationReads.conversationId, giftMessages.conversationId),
					eq(giftConversationReads.userId, userId)
				)
			)
			.where(
				and(
					ne(giftMessages.senderId, userId),
					gt(giftMessages.createdAt, giftConversationReads.lastReadAt)
				)
			)
			.get()?.value ?? 0;

	return {
		wishlist: unread.asRecipient + unreadFamilyMessages + Number(hasUnseenPurchaseStatus),
		gift: unread.asGiver + newIdeaCount
	};
}
