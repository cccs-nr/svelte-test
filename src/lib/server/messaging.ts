import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, isNotNull, isNull, lte } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type { MessageDirection } from '#lib/models/messaging.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { assignments, conversations, messages, users } from '#lib/server/db/schema.js';

type GiverThreadContext = {
	assignmentId: string;
	recipientDisplayName: string;
	recipientHasAvatar: boolean;
	recipientAvatarVersion: number;
};

type RecipientThreadContext = {
	assignmentId: string;
};

type MessageView = {
	id: string;
	content: string;
	sentAt: string;
	senderLabel: string;
};

type GiverThreadView = {
	hasConversation: boolean;
	recipientDisplayName: string;
	recipientHasAvatar: boolean;
	recipientAvatarVersion: number;
	messages: MessageView[];
};

type RecipientThreadView = {
	hasConversation: boolean;
	messages: MessageView[];
};

function getThreadContext(
	database: AppDatabase,
	userId: string,
	direction: 'asGiver'
): GiverThreadContext | undefined;
function getThreadContext(
	database: AppDatabase,
	userId: string,
	direction: 'asRecipient'
): RecipientThreadContext | undefined;
function getThreadContext(
	database: AppDatabase,
	userId: string,
	direction: MessageDirection
): GiverThreadContext | RecipientThreadContext | undefined;
function getThreadContext(
	database: AppDatabase,
	userId: string,
	direction: MessageDirection
): GiverThreadContext | RecipientThreadContext | undefined {
	if (direction === 'asGiver') {
		const assignment = database
			.select({
				assignmentId: assignments.id,
				recipientDisplayName: users.displayName,
				avatarKey: users.avatarKey,
				avatarVersion: users.updatedAt
			})
			.from(assignments)
			.innerJoin(users, eq(users.id, assignments.receiverId))
			.where(
				and(
					eq(assignments.eventId, SINGLE_EVENT_ID),
					eq(assignments.giverId, userId),
					isNotNull(assignments.finalizedAt)
				)
			)
			.get();
		return assignment
			? {
					assignmentId: assignment.assignmentId,
					recipientDisplayName: assignment.recipientDisplayName,
					recipientHasAvatar: Boolean(assignment.avatarKey),
					recipientAvatarVersion: assignment.avatarVersion.getTime()
				}
			: undefined;
	}

	return database
		.select({ assignmentId: assignments.id })
		.from(assignments)
		.where(
			and(
				eq(assignments.eventId, SINGLE_EVENT_ID),
				eq(assignments.receiverId, userId),
				isNotNull(assignments.finalizedAt)
			)
		)
		.get();
}

function getThreadMessages(
	database: AppDatabase,
	conversationId: string,
	direction: MessageDirection,
	recipientDisplayName?: string
): MessageView[] {
	return database
		.select({
			id: messages.id,
			content: messages.content,
			senderSide: messages.senderSide,
			createdAt: messages.createdAt
		})
		.from(messages)
		.where(eq(messages.conversationId, conversationId))
		.orderBy(asc(messages.createdAt), asc(messages.id))
		.all()
		.map((message) => ({
			id: message.id,
			content: message.content,
			sentAt: message.createdAt.toISOString(),
			senderLabel:
				message.senderSide === (direction === 'asGiver' ? 'giver' : 'recipient')
					? 'You'
					: direction === 'asRecipient'
						? 'Your Secret Santa'
						: (recipientDisplayName ?? 'Your recipient')
		}));
}

function getThread(
	database: AppDatabase,
	context: GiverThreadContext,
	direction: 'asGiver'
): GiverThreadView;
function getThread(
	database: AppDatabase,
	context: RecipientThreadContext,
	direction: 'asRecipient'
): RecipientThreadView;
function getThread(
	database: AppDatabase,
	context: GiverThreadContext | RecipientThreadContext,
	direction: MessageDirection
): GiverThreadView | RecipientThreadView {
	const conversation = database
		.select({ id: conversations.id })
		.from(conversations)
		.where(eq(conversations.assignmentId, context.assignmentId))
		.get();
	const messages = conversation
		? getThreadMessages(
				database,
				conversation.id,
				direction,
				direction === 'asGiver' && 'recipientDisplayName' in context
					? context.recipientDisplayName
					: undefined
			)
		: [];

	if (direction === 'asGiver') {
		return {
			hasConversation: Boolean(conversation),
			recipientDisplayName: 'recipientDisplayName' in context ? context.recipientDisplayName : '',
			recipientHasAvatar: 'recipientHasAvatar' in context ? context.recipientHasAvatar : false,
			recipientAvatarVersion:
				'recipientAvatarVersion' in context ? context.recipientAvatarVersion : 0,
			messages
		};
	}

	return { hasConversation: Boolean(conversation), messages };
}

export function getParticipantConversations(database: AppDatabase, userId: string) {
	const giverContext = getThreadContext(database, userId, 'asGiver');
	const recipientContext = getThreadContext(database, userId, 'asRecipient');

	return {
		asGiver: giverContext ? getThread(database, giverContext, 'asGiver') : null,
		asRecipient: recipientContext ? getThread(database, recipientContext, 'asRecipient') : null
	};
}

export function countUnreadMessages(database: AppDatabase, userId: string): number {
	const unreadAsGiver =
		database
			.select({ value: count() })
			.from(messages)
			.innerJoin(conversations, eq(conversations.id, messages.conversationId))
			.innerJoin(assignments, eq(assignments.id, conversations.assignmentId))
			.where(
				and(
					eq(assignments.eventId, SINGLE_EVENT_ID),
					eq(assignments.giverId, userId),
					isNotNull(assignments.finalizedAt),
					eq(messages.senderSide, 'recipient'),
					isNull(messages.giverReadAt)
				)
			)
			.get()?.value ?? 0;
	const unreadAsRecipient =
		database
			.select({ value: count() })
			.from(messages)
			.innerJoin(conversations, eq(conversations.id, messages.conversationId))
			.innerJoin(assignments, eq(assignments.id, conversations.assignmentId))
			.where(
				and(
					eq(assignments.eventId, SINGLE_EVENT_ID),
					eq(assignments.receiverId, userId),
					isNotNull(assignments.finalizedAt),
					eq(messages.senderSide, 'giver'),
					isNull(messages.recipientReadAt)
				)
			)
			.get()?.value ?? 0;

	return unreadAsGiver + unreadAsRecipient;
}

export function getRecentParticipantMessages(database: AppDatabase, userId: string, limit = 6) {
	const recentForThread = (
		context: GiverThreadContext | RecipientThreadContext,
		direction: MessageDirection
	) => {
		const conversation = database
			.select({ id: conversations.id })
			.from(conversations)
			.where(eq(conversations.assignmentId, context.assignmentId))
			.get();
		if (!conversation) return [];

		return database
			.select({
				id: messages.id,
				content: messages.content,
				senderSide: messages.senderSide,
				createdAt: messages.createdAt
			})
			.from(messages)
			.where(eq(messages.conversationId, conversation.id))
			.orderBy(desc(messages.createdAt), desc(messages.id))
			.limit(limit)
			.all()
			.map((message) => ({
				id: message.id,
				content: message.content,
				sentAt: message.createdAt.toISOString(),
				senderLabel:
					message.senderSide === (direction === 'asGiver' ? 'giver' : 'recipient')
						? 'You'
						: direction === 'asRecipient'
							? 'Your Secret Santa'
							: 'recipientDisplayName' in context
								? context.recipientDisplayName
								: 'Your recipient',
				threadLabel:
					direction === 'asRecipient'
						? 'Your Secret Santa'
						: 'recipientDisplayName' in context
							? context.recipientDisplayName
							: 'Your recipient'
			}));
	};

	const giverContext = getThreadContext(database, userId, 'asGiver');
	const recipientContext = getThreadContext(database, userId, 'asRecipient');

	return [
		...(giverContext ? recentForThread(giverContext, 'asGiver') : []),
		...(recipientContext ? recentForThread(recipientContext, 'asRecipient') : [])
	]
		.sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt))
		.slice(0, limit);
}

export function sendParticipantMessage(
	database: AppDatabase,
	userId: string,
	direction: MessageDirection,
	content: string
) {
	const threadContext = getThreadContext(database, userId, direction);
	if (!threadContext) {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'A finalized assignment is required to send messages.'
		});
	}

	return database.transaction((transaction) => {
		const assignment = transaction
			.select({ id: assignments.id })
			.from(assignments)
			.where(
				and(
					eq(assignments.id, threadContext.assignmentId),
					eq(assignments.eventId, SINGLE_EVENT_ID),
					isNotNull(assignments.finalizedAt)
				)
			)
			.get();
		if (!assignment) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'A finalized assignment is required to send messages.'
			});
		}

		let conversation = transaction
			.select({ id: conversations.id })
			.from(conversations)
			.where(eq(conversations.assignmentId, threadContext.assignmentId))
			.get();
		if (!conversation && direction === 'asRecipient') {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'Your Secret Santa must start the conversation before you can reply.'
			});
		}

		const createdAt = new Date(
			Math.max(
				Date.now(),
				(transaction
					.select({ createdAt: messages.createdAt })
					.from(messages)
					.innerJoin(conversations, eq(conversations.id, messages.conversationId))
					.where(eq(conversations.assignmentId, threadContext.assignmentId))
					.orderBy(desc(messages.createdAt))
					.get()
					?.createdAt.getTime() ?? 0) + 1
			)
		);

		if (!conversation) {
			const id = randomUUID();
			transaction
				.insert(conversations)
				.values({ id, assignmentId: threadContext.assignmentId, createdAt, updatedAt: createdAt })
				.run();
			conversation = { id };
		}

		const senderSide = direction === 'asGiver' ? 'giver' : 'recipient';
		transaction
			.insert(messages)
			.values({
				id: randomUUID(),
				conversationId: conversation.id,
				senderSide,
				content,
				createdAt,
				giverReadAt: senderSide === 'giver' ? createdAt : null,
				recipientReadAt: senderSide === 'recipient' ? createdAt : null
			})
			.run();
		transaction
			.update(conversations)
			.set({ updatedAt: createdAt })
			.where(eq(conversations.id, conversation.id))
			.run();

		return { success: true };
	});
}

export function markParticipantMessagesRead(
	database: AppDatabase,
	userId: string,
	direction: MessageDirection,
	throughCreatedAt: string
) {
	const threadContext = getThreadContext(database, userId, direction);
	if (!threadContext) {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'A finalized assignment is required to view messages.'
		});
	}

	const through = new Date(throughCreatedAt);
	if (Number.isNaN(through.getTime())) {
		throw new TRPCError({ code: 'BAD_REQUEST', message: 'A valid read timestamp is required.' });
	}

	return database.transaction((transaction) => {
		const conversation = transaction
			.select({ id: conversations.id })
			.from(conversations)
			.where(eq(conversations.assignmentId, threadContext.assignmentId))
			.get();
		if (!conversation) return { markedCount: 0 };

		const readAt = new Date();
		const result =
			direction === 'asGiver'
				? transaction
						.update(messages)
						.set({ giverReadAt: readAt })
						.where(
							and(
								eq(messages.conversationId, conversation.id),
								eq(messages.senderSide, 'recipient'),
								isNull(messages.giverReadAt),
								lte(messages.createdAt, through)
							)
						)
						.run()
				: transaction
						.update(messages)
						.set({ recipientReadAt: readAt })
						.where(
							and(
								eq(messages.conversationId, conversation.id),
								eq(messages.senderSide, 'giver'),
								isNull(messages.recipientReadAt),
								lte(messages.createdAt, through)
							)
						)
						.run();

		return { markedCount: result.changes };
	});
}
