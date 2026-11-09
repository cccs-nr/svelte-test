import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { conversationMigrationReviews } from '#lib/server/db/schema.js';
import {
	countUnreadMessages,
	getConversationMigrationReviews,
	getParticipantConversation,
	listParticipantConversations,
	markConversationRead,
	joinGiftCoordination,
	openWishlistDiscussion,
	sendConversationMessage
} from '#lib/server/conversation-service.js';
import { participantProcedure, organizerProcedure, router } from '#lib/server/trpc/init.js';

const conversationIdSchema = z.string().trim().min(1).max(128);

export const conversationsRouter = router({
	list: participantProcedure.query(({ ctx }) => listParticipantConversations(ctx.db, ctx.user.id)),

	thread: participantProcedure
		.input(z.object({ conversationId: conversationIdSchema }))
		.query(({ ctx, input }) =>
			getParticipantConversation(ctx.db, input.conversationId, ctx.user.id)
		),

	openDiscussion: participantProcedure
		.input(z.object({ wishlistOwnerId: z.string().trim().min(1) }))
		.mutation(({ ctx, input }) =>
			openWishlistDiscussion(ctx.db, ctx.user.id, input.wishlistOwnerId)
		),

	joinCoordination: participantProcedure
		.input(z.object({ wishlistOwnerId: z.string().trim().min(1) }))
		.mutation(({ ctx, input }) => joinGiftCoordination(ctx.db, ctx.user.id, input.wishlistOwnerId)),

	send: participantProcedure
		.input(
			z.object({
				conversationId: conversationIdSchema,
				content: z.string().trim().min(1).max(2000)
			})
		)
		.mutation(({ ctx, input }) =>
			sendConversationMessage(ctx.db, ctx.user.id, input.conversationId, input.content)
		),

	markRead: participantProcedure
		.input(z.object({ conversationId: conversationIdSchema }))
		.mutation(({ ctx, input }) => markConversationRead(ctx.db, ctx.user.id, input.conversationId)),

	unreadCount: participantProcedure.query(({ ctx }) => ({
		count: countUnreadMessages(ctx.db, ctx.user.id)
	})),

	migrationReview: organizerProcedure.query(({ ctx }) => getConversationMigrationReviews(ctx.db)),

	resolveMigrationReview: organizerProcedure
		.input(z.object({ id: z.string().trim().min(1) }))
		.mutation(({ ctx, input }) => {
			const result = ctx.db
				.update(conversationMigrationReviews)
				.set({ resolvedAt: new Date() })
				.where(
					and(
						eq(conversationMigrationReviews.id, input.id),
						isNull(conversationMigrationReviews.resolvedAt)
					)
				)
				.run();
			return { updated: result.changes > 0 };
		})
});
