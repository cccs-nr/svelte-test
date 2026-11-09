import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, gt, isNotNull, like, max, ne, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
	createGiftSuggestionInputSchema,
	deleteGiftSuggestionInputSchema,
	updateGiftSuggestionInputSchema
} from '#lib/models/wishlist.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import {
	assignments,
	events,
	giftReservations,
	giftSuggestions,
	participantCodenames,
	users,
	wishlistConversationParticipants,
	wishlistConversations,
	wishlistMessages
} from '#lib/server/db/schema.js';
import { getFinalizedGiverId, getFinalizedRecipientId } from '#lib/server/wishlist-access.js';
import {
	getActiveExchangeParticipantIds,
	isActiveExchangeParticipant
} from '#lib/server/wishlist-access.js';
import { removeImage } from '#lib/server/image-storage.js';
import { notifyOrganizerDashboard, notifyUser } from '#lib/server/realtime.js';
import { participantProcedure, router } from '#lib/server/trpc/init.js';
import { z } from 'zod';

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

function notifyFamilyWishlistChanged(database: AppDatabase): void {
	for (const userId of getActiveExchangeParticipantIds(database)) {
		notifyUser(userId, 'family-wishlist:changed');
	}
}

function requireActiveParticipant(database: AppDatabase, userId: string): void {
	if (!isActiveExchangeParticipant(database, userId)) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Active participant access is required.' });
	}
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

	familyDirectory: participantProcedure
		.input(z.object({ search: z.string().trim().max(80).default('') }))
		.query(({ ctx, input }) => {
			requireActiveParticipant(ctx.db, ctx.user.id);
			const condition = and(
				eq(users.isActive, true),
				or(eq(users.role, 'participant'), eq(users.isParticipating, true)),
				input.search ? like(users.displayName, `%${input.search}%`) : undefined
			);
			const rows = ctx.db
				.select({
					id: users.id,
					displayName: users.displayName,
					avatarKey: users.avatarKey,
					avatarVersion: users.updatedAt,
					giftIdeaCount: count(giftSuggestions.id),
					wishlistUpdatedAt: max(giftSuggestions.updatedAt)
				})
				.from(users)
				.leftJoin(giftSuggestions, eq(giftSuggestions.ownerId, users.id))
				.where(condition)
				.groupBy(users.id, users.displayName, users.avatarKey, users.updatedAt)
				.orderBy(users.displayName, users.id)
				.all();
			const conversationsByOwner = new Map<
				string,
				{
					id: string;
					type: 'wishlist_discussion' | 'gift_coordination';
					unreadCount: number;
				}[]
			>();
			const conversationRows = ctx.db
				.select({
					id: wishlistConversations.id,
					wishlistOwnerId: wishlistConversations.wishlistOwnerId,
					type: wishlistConversations.type,
					lastReadAt: wishlistConversationParticipants.lastReadAt
				})
				.from(wishlistConversations)
				.innerJoin(
					wishlistConversationParticipants,
					and(
						eq(wishlistConversationParticipants.conversationId, wishlistConversations.id),
						eq(wishlistConversationParticipants.userId, ctx.user.id)
					)
				)
				.where(
					and(
						eq(wishlistConversations.eventId, SINGLE_EVENT_ID),
						or(
							ne(wishlistConversations.type, 'gift_coordination'),
							ne(wishlistConversations.wishlistOwnerId, ctx.user.id)
						)
					)
				)
				.orderBy(desc(wishlistConversations.lastMessageAt), desc(wishlistConversations.updatedAt))
				.all();
			for (const conversation of conversationRows) {
				const unreadCount =
					ctx.db
						.select({ value: count() })
						.from(wishlistMessages)
						.where(
							and(
								eq(wishlistMessages.conversationId, conversation.id),
								ne(wishlistMessages.senderId, ctx.user.id),
								gt(wishlistMessages.createdAt, conversation.lastReadAt)
							)
						)
						.get()?.value ?? 0;
				const ownerConversations = conversationsByOwner.get(conversation.wishlistOwnerId) ?? [];
				ownerConversations.push({
					id: conversation.id,
					type: conversation.type,
					unreadCount
				});
				conversationsByOwner.set(conversation.wishlistOwnerId, ownerConversations);
			}

			return rows.map(({ avatarKey, avatarVersion, ...row }) => ({
				...row,
				hasAvatar: Boolean(avatarKey),
				avatarVersion: avatarVersion.getTime(),
				conversations: conversationsByOwner.get(row.id) ?? [],
				wishlistUpdatedAt: row.wishlistUpdatedAt?.toISOString() ?? null
			}));
		}),

	familyWishlist: participantProcedure
		.input(z.object({ recipientId: z.string().min(1) }))
		.query(({ ctx, input }) => {
			requireActiveParticipant(ctx.db, ctx.user.id);
			const recipient = ctx.db
				.select({
					id: users.id,
					displayName: users.displayName
				})
				.from(users)
				.where(
					and(
						eq(users.id, input.recipientId),
						eq(users.isActive, true),
						or(eq(users.role, 'participant'), eq(users.isParticipating, true))
					)
				)
				.get();
			if (!recipient) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Family member not found.' });
			}

			const suggestions = ctx.db
				.select({
					...suggestionColumns,
					reservationId: giftReservations.id,
					reservationStatus: giftReservations.status,
					reserverId: giftReservations.reserverId,
					reserverCodename: participantCodenames.codename,
					reserverDisplayName: users.displayName
				})
				.from(giftSuggestions)
				.leftJoin(
					giftReservations,
					and(
						eq(giftReservations.giftSuggestionId, giftSuggestions.id),
						or(eq(giftReservations.status, 'reserved'), eq(giftReservations.status, 'purchased'))
					)
				)
				.leftJoin(
					participantCodenames,
					and(
						eq(participantCodenames.userId, giftReservations.reserverId),
						eq(participantCodenames.eventId, SINGLE_EVENT_ID)
					)
				)
				.leftJoin(users, eq(users.id, giftReservations.reserverId))
				.where(eq(giftSuggestions.ownerId, recipient.id))
				.orderBy(desc(giftSuggestions.updatedAt), desc(giftSuggestions.createdAt))
				.all();
			const event = ctx.db
				.select({ revealedAt: events.revealedAt })
				.from(events)
				.where(eq(events.id, SINGLE_EVENT_ID))
				.get();
			const isOwner = recipient.id === ctx.user.id;

			return {
				recipient,
				suggestions: suggestions.map((suggestion) => {
					const { reserverId, reserverCodename, reserverDisplayName, ...idea } = suggestion;
					if (isOwner) {
						return {
							...idea,
							reservationId: null,
							reservationStatus: null,
							reservedBy: null,
							reservationCodename: null,
							reservedByMe: false
						};
					}

					const reservedBy =
						reserverId && suggestion.reservationStatus
							? event?.revealedAt
								? reserverDisplayName
								: reserverCodename
							: null;
					if (suggestion.reservationStatus && !reservedBy) {
						throw new TRPCError({
							code: 'INTERNAL_SERVER_ERROR',
							message: 'A reserved idea is missing its participant label.'
						});
					}
					if (suggestion.reservationStatus && !reserverCodename) {
						throw new TRPCError({
							code: 'INTERNAL_SERVER_ERROR',
							message: 'A reservation is missing its participant codename.'
						});
					}

					return {
						...idea,
						reservationId: reserverId === ctx.user.id ? suggestion.reservationId : null,
						reservationStatus: suggestion.reservationStatus ?? 'available',
						reservedBy,
						reservationCodename:
							suggestion.reservationStatus && !event?.revealedAt ? reserverCodename : null,
						reservedByMe: reserverId === ctx.user.id
					};
				})
			};
		}),

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
		notifyUser(ctx.user.id, 'wishlist:changed');
		const giverId = getFinalizedGiverId(ctx.db, ctx.user.id);
		if (giverId) notifyUser(giverId, 'recipient-wishlist:changed');
		notifyFamilyWishlistChanged(ctx.db);
		notifyOrganizerDashboard();
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
		notifyUser(ctx.user.id, 'wishlist:changed');
		const giverId = getFinalizedGiverId(ctx.db, ctx.user.id);
		if (giverId) notifyUser(giverId, 'recipient-wishlist:changed');
		notifyFamilyWishlistChanged(ctx.db);
		notifyOrganizerDashboard();
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
			const reservationHistory = ctx.db
				.select({ id: giftReservations.id })
				.from(giftReservations)
				.where(eq(giftReservations.giftSuggestionId, existing.id))
				.get();
			if (reservationHistory) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'A gift idea with reservation history cannot be deleted. Edit it instead.'
				});
			}

			ctx.db
				.delete(giftSuggestions)
				.where(and(eq(giftSuggestions.id, existing.id), eq(giftSuggestions.ownerId, ctx.user.id)))
				.run();
			notifyUser(ctx.user.id, 'wishlist:changed');
			const giverId = getFinalizedGiverId(ctx.db, ctx.user.id);
			if (giverId) notifyUser(giverId, 'recipient-wishlist:changed');
			notifyFamilyWishlistChanged(ctx.db);
			notifyOrganizerDashboard();

			if (existing.imageKey && existing.imageMimeType) {
				try {
					await removeImage(existing.imageKey, existing.imageMimeType);
				} catch (error) {
					console.error('Failed to remove an image after deleting its gift suggestion.', error);
					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: 'The suggestion was deleted, but its image could not be removed.'
					});
				}
			}

			return { success: true };
		}),

	markAssignedRecipientWishlistViewed: participantProcedure.mutation(({ ctx }) => {
		const assignment = ctx.db
			.select({ id: assignments.id })
			.from(assignments)
			.where(
				and(
					eq(assignments.eventId, SINGLE_EVENT_ID),
					eq(assignments.giverId, ctx.user.id),
					isNotNull(assignments.finalizedAt)
				)
			)
			.get();
		if (!assignment) return { updated: false };

		ctx.db
			.update(assignments)
			.set({ giverWishlistViewedAt: new Date() })
			.where(eq(assignments.id, assignment.id))
			.run();
		notifyUser(ctx.user.id, 'badges:changed');
		return { updated: true };
	})
});
