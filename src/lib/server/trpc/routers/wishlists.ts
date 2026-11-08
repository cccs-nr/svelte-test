import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
	createGiftSuggestionInputSchema,
	deleteGiftSuggestionInputSchema,
	updateGiftSuggestionInputSchema
} from '#lib/models/wishlist.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { giftSuggestions, users } from '#lib/server/db/schema.js';
import { getFinalizedRecipientId } from '#lib/server/wishlist-access.js';
import { removeWishlistImage } from '#lib/server/wishlist-image-storage.js';
import { participantProcedure, router } from '#lib/server/trpc/init.js';

const suggestionColumns = {
	id: giftSuggestions.id,
	title: giftSuggestions.title,
	description: giftSuggestions.description,
	url: giftSuggestions.url,
	imageKey: giftSuggestions.imageKey,
	estimatedPriceCents: giftSuggestions.estimatedPriceCents,
	notes: giftSuggestions.notes,
	createdAt: giftSuggestions.createdAt,
	updatedAt: giftSuggestions.updatedAt
};

function listSuggestions(database: AppDatabase, ownerId: string) {
	return database
		.select(suggestionColumns)
		.from(giftSuggestions)
		.where(eq(giftSuggestions.ownerId, ownerId))
		.orderBy(desc(giftSuggestions.updatedAt), desc(giftSuggestions.createdAt))
		.all()
		.map((suggestion) => ({
			...suggestion,
			createdAt: suggestion.createdAt.toISOString(),
			updatedAt: suggestion.updatedAt.toISOString()
		}));
}

function getOwnedSuggestion(database: AppDatabase, id: string, ownerId: string) {
	const suggestion = database
		.select(suggestionColumns)
		.from(giftSuggestions)
		.where(and(eq(giftSuggestions.id, id), eq(giftSuggestions.ownerId, ownerId)))
		.get();

	return suggestion
		? {
				...suggestion,
				createdAt: suggestion.createdAt.toISOString(),
				updatedAt: suggestion.updatedAt.toISOString()
			}
		: undefined;
}

export const wishlistsRouter = router({
	mine: participantProcedure.query(({ ctx }) => listSuggestions(ctx.db, ctx.user.id)),

	assignedRecipient: participantProcedure.query(({ ctx }) => {
		const recipientId = getFinalizedRecipientId(ctx.db, ctx.user.id);
		if (!recipientId) return { recipient: null, suggestions: [] };

		const recipient = ctx.db
			.select({ displayName: users.displayName })
			.from(users)
			.where(eq(users.id, recipientId))
			.get();
		if (!recipient) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'The assigned recipient account could not be found.'
			});
		}

		return { recipient, suggestions: listSuggestions(ctx.db, recipientId) };
	}),

	create: participantProcedure.input(createGiftSuggestionInputSchema).mutation(({ ctx, input }) => {
		const now = new Date();
		const id = randomUUID();
		ctx.db
			.insert(giftSuggestions)
			.values({
				id,
				ownerId: ctx.user.id,
				...input,
				createdAt: now,
				updatedAt: now
			})
			.run();

		const suggestion = getOwnedSuggestion(ctx.db, id, ctx.user.id);
		if (!suggestion) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'The gift suggestion was created but could not be loaded.'
			});
		}
		return suggestion;
	}),

	update: participantProcedure.input(updateGiftSuggestionInputSchema).mutation(({ ctx, input }) => {
		const { id, ...changes } = input;
		const result = ctx.db
			.update(giftSuggestions)
			.set({ ...changes, updatedAt: new Date() })
			.where(and(eq(giftSuggestions.id, id), eq(giftSuggestions.ownerId, ctx.user.id)))
			.run();
		if (result.changes === 0) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Gift suggestion not found.' });
		}

		const suggestion = getOwnedSuggestion(ctx.db, id, ctx.user.id);
		if (!suggestion) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'The updated gift suggestion could not be loaded.'
			});
		}
		return suggestion;
	}),

	delete: participantProcedure
		.input(deleteGiftSuggestionInputSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = ctx.db
				.select({
					id: giftSuggestions.id,
					imageKey: giftSuggestions.imageKey,
					imageMimeType: giftSuggestions.imageMimeType
				})
				.from(giftSuggestions)
				.where(and(eq(giftSuggestions.id, input.id), eq(giftSuggestions.ownerId, ctx.user.id)))
				.get();
			if (!existing) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Gift suggestion not found.' });
			}

			ctx.db
				.delete(giftSuggestions)
				.where(and(eq(giftSuggestions.id, existing.id), eq(giftSuggestions.ownerId, ctx.user.id)))
				.run();

			if (existing.imageKey && existing.imageMimeType) {
				try {
					await removeWishlistImage(existing.imageKey, existing.imageMimeType);
				} catch (error) {
					console.error('Failed to remove an image after deleting its gift suggestion.', error);
					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: 'The suggestion was deleted, but its image could not be removed.'
					});
				}
			}

			return { success: true };
		})
});
