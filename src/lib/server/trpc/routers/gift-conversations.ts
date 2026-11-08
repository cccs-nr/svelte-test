import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, gt, ne, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import {
	assignments,
	events,
	giftConversationParticipants,
	giftConversationReads,
	giftConversations,
	giftMessages,
	participantCodenames,
	users
} from '#lib/server/db/schema.js';
import { notifyOrganizerDashboard, notifyUser } from '#lib/server/realtime.js';
import { isActiveExchangeParticipant } from '#lib/server/wishlist-access.js';
import { participantProcedure, router } from '#lib/server/trpc/init.js';

type GiftConversationType = 'recipient_visible' | 'private_coordination';

function getEvent(database: AppDatabase) {
	return database
		.select({ status: events.status, revealedAt: events.revealedAt })
		.from(events)
		.where(eq(events.id, SINGLE_EVENT_ID))
		.get();
}

function ensureGiftConversationsCanStart(database: AppDatabase) {
	const event = getEvent(database);
	if (!event || event.status !== 'assignments_generated' || event.revealedAt) {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'Finalize the assignment draw before opening family gift conversations.'
		});
	}
	const eventAssignments = database
		.select({ finalizedAt: assignments.finalizedAt })
		.from(assignments)
		.where(eq(assignments.eventId, SINGLE_EVENT_ID))
		.all();
	if (
		eventAssignments.length === 0 ||
		eventAssignments.some((assignment) => assignment.finalizedAt === null)
	) {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'Every assignment must be finalized before opening family gift conversations.'
		});
	}
	const activeParticipantIds = database
		.select({ id: users.id })
		.from(users)
		.where(
			and(
				eq(users.isActive, true),
				or(eq(users.role, 'participant'), eq(users.isParticipating, true))
			)
		)
		.all()
		.map(({ id }) => id);
	const participantCodenameIds = new Set(
		database
			.select({ userId: participantCodenames.userId })
			.from(participantCodenames)
			.where(eq(participantCodenames.eventId, SINGLE_EVENT_ID))
			.all()
			.map(({ userId }) => userId)
	);
	if (activeParticipantIds.some((userId) => !participantCodenameIds.has(userId))) {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'Every active participant must have a codename before opening family conversations.'
		});
	}
	return event;
}

function addConversationParticipant(
	database: Pick<AppDatabase, 'insert'>,
	conversationId: string,
	userId: string,
	joinedAt: Date
): void {
	database
		.insert(giftConversationParticipants)
		.values({ conversationId, userId, joinedAt })
		.onConflictDoNothing()
		.run();
	database
		.insert(giftConversationReads)
		.values({ conversationId, userId, lastReadAt: new Date(0) })
		.onConflictDoNothing()
		.run();
}

function getOrCreateConversation(
	database: AppDatabase,
	recipientId: string,
	type: GiftConversationType,
	joiningUserId: string
): string {
	const recipient = database
		.select({ id: users.id })
		.from(users)
		.where(
			and(
				eq(users.id, recipientId),
				eq(users.isActive, true),
				or(eq(users.role, 'participant'), eq(users.isParticipating, true))
			)
		)
		.get();
	if (!recipient) throw new TRPCError({ code: 'NOT_FOUND', message: 'Family member not found.' });
	if (type === 'private_coordination' && recipientId === joiningUserId) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'The wishlist owner cannot join their private Gift Coordination conversation.'
		});
	}

	ensureGiftConversationsCanStart(database);

	const conversationId = database.transaction((transaction) => {
		const existing = transaction
			.select({ id: giftConversations.id })
			.from(giftConversations)
			.where(
				and(
					eq(giftConversations.eventId, SINGLE_EVENT_ID),
					eq(giftConversations.recipientId, recipientId),
					eq(giftConversations.type, type)
				)
			)
			.get();
		const id = existing?.id ?? randomUUID();
		if (!existing) {
			transaction
				.insert(giftConversations)
				.values({
					id,
					eventId: SINGLE_EVENT_ID,
					recipientId,
					type
				})
				.onConflictDoNothing()
				.run();
		}

		const conversation = transaction
			.select({ id: giftConversations.id })
			.from(giftConversations)
			.where(
				and(
					eq(giftConversations.eventId, SINGLE_EVENT_ID),
					eq(giftConversations.recipientId, recipientId),
					eq(giftConversations.type, type)
				)
			)
			.get();
		if (!conversation) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'The gift conversation could not be created.'
			});
		}

		const joinedAt = new Date();
		const participantIds =
			type === 'recipient_visible'
				? transaction
						.select({ id: users.id })
						.from(users)
						.where(
							and(
								eq(users.isActive, true),
								or(eq(users.role, 'participant'), eq(users.isParticipating, true))
							)
						)
						.all()
						.map(({ id: participantId }) => participantId)
				: [joiningUserId];
		for (const userId of participantIds) {
			addConversationParticipant(transaction, conversation.id, userId, joinedAt);
		}

		return conversation.id;
	});

	return conversationId;
}

function ensureMembership(database: AppDatabase, conversationId: string, userId: string) {
	if (!isActiveExchangeParticipant(database, userId)) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Active participant access is required.' });
	}
	const conversation = database
		.select({
			id: giftConversations.id,
			recipientId: giftConversations.recipientId,
			type: giftConversations.type
		})
		.from(giftConversations)
		.innerJoin(
			giftConversationParticipants,
			and(
				eq(giftConversationParticipants.conversationId, giftConversations.id),
				eq(giftConversationParticipants.userId, userId)
			)
		)
		.where(
			and(eq(giftConversations.id, conversationId), eq(giftConversations.eventId, SINGLE_EVENT_ID))
		)
		.get();
	if (!conversation) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Gift conversation not found.' });
	}
	if (conversation.type === 'private_coordination' && conversation.recipientId === userId) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'The recipient cannot access this conversation.'
		});
	}
	return conversation;
}

function notifyGiftConversationMembers(database: AppDatabase, conversationId: string): void {
	const members = database
		.select({ userId: giftConversationParticipants.userId })
		.from(giftConversationParticipants)
		.where(eq(giftConversationParticipants.conversationId, conversationId))
		.all();
	for (const { userId } of members) notifyUser(userId, 'family-messages:changed');
}

function getConversationThread(database: AppDatabase, conversationId: string, viewerId: string) {
	const conversation = ensureMembership(database, conversationId, viewerId);
	const event = getEvent(database);
	if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found.' });
	const participantRead = database
		.select({ lastReadAt: giftConversationReads.lastReadAt })
		.from(giftConversationReads)
		.where(
			and(
				eq(giftConversationReads.conversationId, conversationId),
				eq(giftConversationReads.userId, viewerId)
			)
		)
		.get();
	if (!participantRead) {
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'The conversation read marker is missing.'
		});
	}

	const recipient = database
		.select({
			displayName: users.displayName,
			codename: participantCodenames.codename,
			revealedAt: events.revealedAt
		})
		.from(users)
		.innerJoin(
			participantCodenames,
			and(
				eq(participantCodenames.eventId, SINGLE_EVENT_ID),
				eq(participantCodenames.userId, users.id)
			)
		)
		.innerJoin(events, eq(events.id, SINGLE_EVENT_ID))
		.where(eq(users.id, conversation.recipientId))
		.get();
	if (!recipient) {
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Conversation recipient codename not found.'
		});
	}

	const messages = database
		.select({
			id: giftMessages.id,
			content: giftMessages.content,
			createdAt: giftMessages.createdAt,
			senderId: giftMessages.senderId,
			senderCodename: participantCodenames.codename,
			senderDisplayName: users.displayName,
			revealedAt: events.revealedAt
		})
		.from(giftMessages)
		.innerJoin(users, eq(users.id, giftMessages.senderId))
		.leftJoin(
			participantCodenames,
			and(
				eq(participantCodenames.eventId, SINGLE_EVENT_ID),
				eq(participantCodenames.userId, giftMessages.senderId)
			)
		)
		.innerJoin(events, eq(events.id, SINGLE_EVENT_ID))
		.where(eq(giftMessages.conversationId, conversationId))
		.orderBy(giftMessages.createdAt, giftMessages.id)
		.all()
		.map((message) => {
			const senderLabel =
				message.senderId === viewerId
					? 'You'
					: message.revealedAt
						? message.senderDisplayName
						: message.senderCodename;
			if (!senderLabel) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'A conversation participant is missing a codename.'
				});
			}
			return {
				id: message.id,
				content: message.content,
				sentAt: message.createdAt.toISOString(),
				senderLabel
			};
		});

	const unreadCount =
		database
			.select({ value: count() })
			.from(giftMessages)
			.where(
				and(
					eq(giftMessages.conversationId, conversationId),
					ne(giftMessages.senderId, viewerId),
					gt(giftMessages.createdAt, participantRead.lastReadAt)
				)
			)
			.get()?.value ?? 0;

	return {
		id: conversation.id,
		type: conversation.type,
		recipientLabel: recipient.revealedAt ? recipient.displayName : recipient.codename,
		canSend: event.status !== 'completed',
		unreadCount,
		messages
	};
}

export const giftConversationsRouter = router({
	list: participantProcedure.query(({ ctx }) => {
		if (!isActiveExchangeParticipant(ctx.db, ctx.user.id)) {
			throw new TRPCError({ code: 'FORBIDDEN', message: 'Active participant access is required.' });
		}
		const conversations = ctx.db
			.select({
				id: giftConversations.id,
				type: giftConversations.type,
				recipientId: giftConversations.recipientId,
				recipientDisplayName: users.displayName,
				recipientCodename: participantCodenames.codename,
				revealedAt: events.revealedAt,
				updatedAt: giftConversations.updatedAt,
				lastReadAt: giftConversationReads.lastReadAt
			})
			.from(giftConversations)
			.innerJoin(users, eq(users.id, giftConversations.recipientId))
			.innerJoin(
				participantCodenames,
				and(
					eq(participantCodenames.eventId, SINGLE_EVENT_ID),
					eq(participantCodenames.userId, giftConversations.recipientId)
				)
			)
			.innerJoin(events, eq(events.id, SINGLE_EVENT_ID))
			.innerJoin(
				giftConversationParticipants,
				and(
					eq(giftConversationParticipants.conversationId, giftConversations.id),
					eq(giftConversationParticipants.userId, ctx.user.id)
				)
			)
			.innerJoin(
				giftConversationReads,
				and(
					eq(giftConversationReads.conversationId, giftConversations.id),
					eq(giftConversationReads.userId, ctx.user.id)
				)
			)
			.where(eq(giftConversations.eventId, SINGLE_EVENT_ID))
			.orderBy(desc(giftConversations.updatedAt))
			.all();

		return conversations.map((conversation) => ({
			id: conversation.id,
			type: conversation.type,
			recipientLabel: conversation.revealedAt
				? conversation.recipientDisplayName
				: conversation.recipientCodename,
			unreadCount:
				ctx.db
					.select({ value: count() })
					.from(giftMessages)
					.where(
						and(
							eq(giftMessages.conversationId, conversation.id),
							ne(giftMessages.senderId, ctx.user.id),
							gt(giftMessages.createdAt, conversation.lastReadAt)
						)
					)
					.get()?.value ?? 0
		}));
	}),

	openDiscussion: participantProcedure
		.input(z.object({ recipientId: z.string().min(1) }))
		.mutation(({ ctx, input }) => {
			if (!isActiveExchangeParticipant(ctx.db, ctx.user.id)) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Active participant access is required.'
				});
			}
			const conversationId = getOrCreateConversation(
				ctx.db,
				input.recipientId,
				'recipient_visible',
				ctx.user.id
			);
			notifyGiftConversationMembers(ctx.db, conversationId);
			notifyOrganizerDashboard();
			return getConversationThread(ctx.db, conversationId, ctx.user.id);
		}),

	joinCoordination: participantProcedure
		.input(z.object({ recipientId: z.string().min(1) }))
		.mutation(({ ctx, input }) => {
			if (!isActiveExchangeParticipant(ctx.db, ctx.user.id)) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Active participant access is required.'
				});
			}
			const conversationId = getOrCreateConversation(
				ctx.db,
				input.recipientId,
				'private_coordination',
				ctx.user.id
			);
			notifyGiftConversationMembers(ctx.db, conversationId);
			notifyOrganizerDashboard();
			return getConversationThread(ctx.db, conversationId, ctx.user.id);
		}),

	thread: participantProcedure
		.input(z.object({ conversationId: z.string().uuid() }))
		.query(({ ctx, input }) => getConversationThread(ctx.db, input.conversationId, ctx.user.id)),

	send: participantProcedure
		.input(
			z.object({
				conversationId: z.string().uuid(),
				content: z.string().trim().min(1).max(2000)
			})
		)
		.mutation(({ ctx, input }) => {
			ensureMembership(ctx.db, input.conversationId, ctx.user.id);
			if (getEvent(ctx.db)?.status === 'completed') {
				throw new TRPCError({
					code: 'PRECONDITION_FAILED',
					message: 'Messages cannot be sent after the event is complete.'
				});
			}
			ctx.db.transaction((transaction) => {
				const lastMessage = transaction
					.select({ createdAt: giftMessages.createdAt })
					.from(giftMessages)
					.where(eq(giftMessages.conversationId, input.conversationId))
					.orderBy(desc(giftMessages.createdAt))
					.get();
				const createdAt = new Date(
					Math.max(Date.now(), (lastMessage?.createdAt.getTime() ?? 0) + 1)
				);
				transaction
					.insert(giftMessages)
					.values({
						id: randomUUID(),
						conversationId: input.conversationId,
						senderId: ctx.user.id,
						content: input.content,
						createdAt
					})
					.run();
				transaction
					.update(giftConversations)
					.set({ updatedAt: createdAt })
					.where(eq(giftConversations.id, input.conversationId))
					.run();
			});
			notifyGiftConversationMembers(ctx.db, input.conversationId);
			notifyOrganizerDashboard();
			return { success: true };
		}),

	markRead: participantProcedure
		.input(z.object({ conversationId: z.string().uuid() }))
		.mutation(({ ctx, input }) => {
			ensureMembership(ctx.db, input.conversationId, ctx.user.id);
			const lastMessage = ctx.db
				.select({ createdAt: giftMessages.createdAt })
				.from(giftMessages)
				.where(eq(giftMessages.conversationId, input.conversationId))
				.orderBy(desc(giftMessages.createdAt))
				.get();
			if (!lastMessage) return { updated: false };

			const readMarker = ctx.db
				.select({ lastReadAt: giftConversationReads.lastReadAt })
				.from(giftConversationReads)
				.where(
					and(
						eq(giftConversationReads.conversationId, input.conversationId),
						eq(giftConversationReads.userId, ctx.user.id)
					)
				)
				.get();
			if (readMarker && readMarker.lastReadAt >= lastMessage.createdAt) {
				return { updated: false };
			}
			if (readMarker) {
				ctx.db
					.update(giftConversationReads)
					.set({ lastReadAt: lastMessage.createdAt })
					.where(
						and(
							eq(giftConversationReads.conversationId, input.conversationId),
							eq(giftConversationReads.userId, ctx.user.id)
						)
					)
					.run();
			} else {
				ctx.db
					.insert(giftConversationReads)
					.values({
						conversationId: input.conversationId,
						userId: ctx.user.id,
						lastReadAt: lastMessage.createdAt
					})
					.run();
			}
			notifyUser(ctx.user.id, 'family-messages:changed');
			return { updated: true };
		})
});
