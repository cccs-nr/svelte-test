import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, gt, isNotNull, isNull, ne, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import {
	assignments,
	conversationMigrationReviews,
	events,
	participantCodenames,
	users,
	wishlistConversationParticipants,
	wishlistConversations,
	wishlistMessages
} from '#lib/server/db/schema.js';
import {
	resolveConversationIdentity,
	type ConversationIdentity,
	type WishlistConversationType
} from '#lib/server/conversation-identity.js';
import { notifyOrganizerDashboard, notifyUser } from '#lib/server/realtime.js';
import { isActiveExchangeParticipant } from '#lib/server/wishlist-access.js';

type ConversationExecutor = Pick<AppDatabase, 'select' | 'insert' | 'update'>;
type ConversationOperation = 'discussion' | 'coordination';

function getTypeLabel(ownerDisplayName: string, type: WishlistConversationType): string {
	return type === 'wishlist_discussion' ? `Talk to ${ownerDisplayName}` : 'Private gift planning';
}

function getTitle(ownerDisplayName: string, type: WishlistConversationType): string {
	return `${ownerDisplayName} — ${getTypeLabel(ownerDisplayName, type)}`;
}

function requireActiveParticipant(database: AppDatabase, userId: string): void {
	if (!isActiveExchangeParticipant(database, userId)) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Active participant access is required.' });
	}
}

function getEvent(database: AppDatabase) {
	return database.select().from(events).where(eq(events.id, SINGLE_EVENT_ID)).get();
}

function ensureConversationsCanStart(database: AppDatabase): void {
	const event = getEvent(database);
	if (!event || event.status !== 'assignments_generated' || event.revealedAt) {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'Finalize the assignment draw before opening wishlist conversations.'
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
			message: 'Every assignment must be finalized before opening wishlist conversations.'
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
	const codenameIds = new Set(
		database
			.select({ userId: participantCodenames.userId })
			.from(participantCodenames)
			.where(eq(participantCodenames.eventId, SINGLE_EVENT_ID))
			.all()
			.map(({ userId }) => userId)
	);
	if (activeParticipantIds.some((userId) => !codenameIds.has(userId))) {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message:
				'Every active participant must have a codename before opening wishlist conversations.'
		});
	}
}

function addParticipant(
	database: Pick<ConversationExecutor, 'insert'>,
	conversationId: string,
	userId: string,
	joinedAt: Date
): void {
	database
		.insert(wishlistConversationParticipants)
		.values({
			conversationId,
			userId,
			joinedAt,
			lastReadAt: new Date(0)
		})
		.onConflictDoNothing()
		.run();
}

function assertMembership(
	database: Pick<AppDatabase, 'select'>,
	conversationId: string,
	viewerId: string
) {
	const conversation = database
		.select({
			id: wishlistConversations.id,
			eventId: wishlistConversations.eventId,
			wishlistOwnerId: wishlistConversations.wishlistOwnerId,
			type: wishlistConversations.type,
			title: wishlistConversations.title,
			createdAt: wishlistConversations.createdAt,
			updatedAt: wishlistConversations.updatedAt,
			lastMessageAt: wishlistConversations.lastMessageAt,
			ownerDisplayName: users.displayName,
			ownerAvatarKey: users.avatarKey,
			ownerAvatarVersion: users.updatedAt,
			assignedSecretSantaId: assignments.giverId,
			lastReadAt: wishlistConversationParticipants.lastReadAt
		})
		.from(wishlistConversations)
		.innerJoin(users, eq(users.id, wishlistConversations.wishlistOwnerId))
		.leftJoin(
			assignments,
			and(
				eq(assignments.eventId, wishlistConversations.eventId),
				eq(assignments.receiverId, wishlistConversations.wishlistOwnerId),
				isNotNull(assignments.finalizedAt)
			)
		)
		.innerJoin(
			wishlistConversationParticipants,
			and(
				eq(wishlistConversationParticipants.conversationId, wishlistConversations.id),
				eq(wishlistConversationParticipants.userId, viewerId)
			)
		)
		.where(
			and(
				eq(wishlistConversations.id, conversationId),
				eq(wishlistConversations.eventId, SINGLE_EVENT_ID)
			)
		)
		.get();

	if (!conversation) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found.' });
	}
	if (conversation.type === 'gift_coordination' && conversation.wishlistOwnerId === viewerId) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'The wishlist owner cannot access private gift planning.'
		});
	}
	return conversation;
}

function identityFor(
	database: Pick<AppDatabase, 'select'>,
	conversation: ReturnType<typeof assertMembership>,
	viewerId: string,
	senderId: string
): ConversationIdentity {
	const sender = database
		.select({
			displayName: users.displayName,
			avatarKey: users.avatarKey,
			avatarVersion: users.updatedAt,
			codename: participantCodenames.codename
		})
		.from(users)
		.leftJoin(
			participantCodenames,
			and(
				eq(participantCodenames.eventId, conversation.eventId),
				eq(participantCodenames.userId, users.id)
			)
		)
		.where(eq(users.id, senderId))
		.get();
	if (!sender) {
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Conversation message sender no longer exists.'
		});
	}

	return resolveConversationIdentity({
		viewerId,
		senderId,
		wishlistOwnerId: conversation.wishlistOwnerId,
		type: conversation.type,
		assignedSecretSantaId: conversation.assignedSecretSantaId,
		senderDisplayName: sender.displayName,
		senderAvatarKey: sender.avatarKey,
		senderAvatarVersion: sender.avatarVersion.getTime(),
		senderCodename: sender.codename
	});
}

function presentIdentity(identity: ConversationIdentity) {
	if (identity.type === 'profile') {
		return {
			label: identity.label,
			avatar: {
				type: identity.type,
				userId: identity.userId,
				hasAvatar: identity.hasAvatar,
				avatarVersion: identity.avatarVersion
			} as const
		};
	}
	if (identity.type === 'codename') {
		return {
			label: identity.label,
			avatar: { type: identity.type, codename: identity.codename } as const
		};
	}
	return {
		label: identity.label,
		avatar: { type: identity.type } as const
	};
}

function getConversationParticipants(
	database: AppDatabase,
	conversation: ReturnType<typeof assertMembership>,
	viewerId: string
) {
	return database
		.select({ userId: wishlistConversationParticipants.userId })
		.from(wishlistConversationParticipants)
		.where(eq(wishlistConversationParticipants.conversationId, conversation.id))
		.all()
		.map(({ userId }) => presentIdentity(identityFor(database, conversation, viewerId, userId)));
}

function getConversationMessages(
	database: AppDatabase,
	conversation: ReturnType<typeof assertMembership>,
	viewerId: string
) {
	const rows = database
		.select({
			id: wishlistMessages.id,
			senderId: wishlistMessages.senderId,
			content: wishlistMessages.content,
			createdAt: wishlistMessages.createdAt
		})
		.from(wishlistMessages)
		.where(eq(wishlistMessages.conversationId, conversation.id))
		.orderBy(asc(wishlistMessages.createdAt), asc(wishlistMessages.id))
		.all();
	return rows.map((message) => {
		const sender = presentIdentity(identityFor(database, conversation, viewerId, message.senderId));
		return {
			id: message.id,
			content: message.content,
			sentAt: message.createdAt.toISOString(),
			isOwnMessage: message.senderId === viewerId,
			senderLabel: sender.label,
			senderAvatar: sender.avatar
		};
	});
}

function getUnreadCount(
	database: Pick<AppDatabase, 'select'>,
	conversationId: string,
	viewerId: string,
	lastReadAt: Date
): number {
	return (
		database
			.select({ value: count() })
			.from(wishlistMessages)
			.where(
				and(
					eq(wishlistMessages.conversationId, conversationId),
					ne(wishlistMessages.senderId, viewerId),
					gt(wishlistMessages.createdAt, lastReadAt)
				)
			)
			.get()?.value ?? 0
	);
}

function buildConversationView(
	database: AppDatabase,
	conversation: ReturnType<typeof assertMembership>,
	viewerId: string
) {
	const lastMessage = database
		.select({
			id: wishlistMessages.id,
			senderId: wishlistMessages.senderId,
			content: wishlistMessages.content,
			createdAt: wishlistMessages.createdAt
		})
		.from(wishlistMessages)
		.where(eq(wishlistMessages.conversationId, conversation.id))
		.orderBy(desc(wishlistMessages.createdAt), desc(wishlistMessages.id))
		.get();
	const lastMessageIdentity = lastMessage
		? presentIdentity(identityFor(database, conversation, viewerId, lastMessage.senderId))
		: null;
	const owner = presentIdentity(
		identityFor(database, conversation, viewerId, conversation.wishlistOwnerId)
	);
	if (owner.avatar.type !== 'profile') {
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Wishlist owner identity could not be resolved.'
		});
	}
	const event = database
		.select({ status: events.status })
		.from(events)
		.where(eq(events.id, conversation.eventId))
		.get();

	return {
		id: conversation.id,
		type: conversation.type,
		title: getTitle(conversation.ownerDisplayName, conversation.type),
		wishlistOwner: {
			label: owner.label,
			userId: owner.avatar.userId,
			displayName: owner.label,
			avatar: owner.avatar
		},
		participants: getConversationParticipants(database, conversation, viewerId),
		lastMessagePreview: lastMessage?.content ?? null,
		lastMessageSenderLabel: lastMessageIdentity?.label ?? null,
		lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
		updatedAt: conversation.updatedAt.toISOString(),
		unreadCount: getUnreadCount(database, conversation.id, viewerId, conversation.lastReadAt),
		canSend: event?.status !== 'completed',
		isWishlistOwner: conversation.wishlistOwnerId === viewerId
	};
}

export function listParticipantConversations(database: AppDatabase, viewerId: string) {
	requireActiveParticipant(database, viewerId);
	const conversations = database
		.select({ id: wishlistConversations.id })
		.from(wishlistConversations)
		.innerJoin(
			wishlistConversationParticipants,
			and(
				eq(wishlistConversationParticipants.conversationId, wishlistConversations.id),
				eq(wishlistConversationParticipants.userId, viewerId)
			)
		)
		.where(eq(wishlistConversations.eventId, SINGLE_EVENT_ID))
		.all()
		.map(({ id }) => {
			const conversation = assertMembership(database, id, viewerId);
			return buildConversationView(database, conversation, viewerId);
		});

	return conversations.sort(
		(left, right) =>
			Date.parse(right.lastMessageAt ?? right.updatedAt) -
			Date.parse(left.lastMessageAt ?? left.updatedAt)
	);
}

export function getParticipantConversation(
	database: AppDatabase,
	conversationId: string,
	viewerId: string
) {
	requireActiveParticipant(database, viewerId);
	const conversation = assertMembership(database, conversationId, viewerId);
	return {
		...buildConversationView(database, conversation, viewerId),
		messages: getConversationMessages(database, conversation, viewerId)
	};
}

export function createAssignedWishlistDiscussions(
	database: ConversationExecutor,
	rows: Array<{
		eventId: string;
		giverId: string;
		receiverId: string;
		finalizedAt: Date | null;
	}>
): void {
	for (const assignment of rows) {
		if (!assignment.finalizedAt) continue;
		const owner = database
			.select({ displayName: users.displayName })
			.from(users)
			.where(eq(users.id, assignment.receiverId))
			.get();
		if (!owner) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Wishlist owner account is missing for a finalized assignment.'
			});
		}

		const existing = database
			.select({ id: wishlistConversations.id })
			.from(wishlistConversations)
			.where(
				and(
					eq(wishlistConversations.eventId, assignment.eventId),
					eq(wishlistConversations.wishlistOwnerId, assignment.receiverId),
					eq(wishlistConversations.type, 'wishlist_discussion')
				)
			)
			.get();
		const conversationId = existing?.id ?? randomUUID();
		if (!existing) {
			database
				.insert(wishlistConversations)
				.values({
					id: conversationId,
					eventId: assignment.eventId,
					wishlistOwnerId: assignment.receiverId,
					type: 'wishlist_discussion',
					title: getTitle(owner.displayName, 'wishlist_discussion'),
					createdAt: assignment.finalizedAt,
					updatedAt: assignment.finalizedAt
				})
				.onConflictDoNothing()
				.run();
		}
		const conversation = database
			.select({ id: wishlistConversations.id })
			.from(wishlistConversations)
			.where(
				and(
					eq(wishlistConversations.eventId, assignment.eventId),
					eq(wishlistConversations.wishlistOwnerId, assignment.receiverId),
					eq(wishlistConversations.type, 'wishlist_discussion')
				)
			)
			.get();
		if (!conversation) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'The assigned wishlist conversation could not be created.'
			});
		}
		addParticipant(database, conversation.id, assignment.giverId, assignment.finalizedAt);
		addParticipant(database, conversation.id, assignment.receiverId, assignment.finalizedAt);
	}
}

function getWishlistOwner(database: AppDatabase, wishlistOwnerId: string) {
	const owner = database
		.select({ id: users.id, displayName: users.displayName })
		.from(users)
		.where(eq(users.id, wishlistOwnerId))
		.get();
	if (!owner || !isActiveExchangeParticipant(database, owner.id)) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Wishlist not found.' });
	}
	return owner;
}

function openWishlistConversation(
	database: AppDatabase,
	viewerId: string,
	wishlistOwnerId: string,
	operation: ConversationOperation
): string {
	requireActiveParticipant(database, viewerId);
	const owner = getWishlistOwner(database, wishlistOwnerId);
	if (operation === 'coordination' && owner.id === viewerId) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'The wishlist owner cannot join private gift planning.'
		});
	}
	ensureConversationsCanStart(database);

	const type: WishlistConversationType =
		operation === 'discussion' ? 'wishlist_discussion' : 'gift_coordination';
	const id = database.transaction((transaction) => {
		const existing = transaction
			.select({ id: wishlistConversations.id })
			.from(wishlistConversations)
			.where(
				and(
					eq(wishlistConversations.eventId, SINGLE_EVENT_ID),
					eq(wishlistConversations.wishlistOwnerId, owner.id),
					eq(wishlistConversations.type, type)
				)
			)
			.get();
		const conversationId = existing?.id ?? randomUUID();
		if (!existing) {
			transaction
				.insert(wishlistConversations)
				.values({
					id: conversationId,
					eventId: SINGLE_EVENT_ID,
					wishlistOwnerId: owner.id,
					type,
					title: getTitle(owner.displayName, type)
				})
				.onConflictDoNothing()
				.run();
		}

		const conversation = transaction
			.select({ id: wishlistConversations.id })
			.from(wishlistConversations)
			.where(
				and(
					eq(wishlistConversations.eventId, SINGLE_EVENT_ID),
					eq(wishlistConversations.wishlistOwnerId, owner.id),
					eq(wishlistConversations.type, type)
				)
			)
			.get();
		if (!conversation) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'The wishlist conversation could not be created.'
			});
		}

		const joinedAt = new Date();
		if (type === 'wishlist_discussion') {
			addParticipant(transaction, conversation.id, owner.id, joinedAt);
		}
		addParticipant(transaction, conversation.id, viewerId, joinedAt);
		return conversation.id;
	});

	return id;
}

function notifyConversationParticipants(database: AppDatabase, conversationId: string): void {
	const participants = database
		.select({ userId: wishlistConversationParticipants.userId })
		.from(wishlistConversationParticipants)
		.where(eq(wishlistConversationParticipants.conversationId, conversationId))
		.all();
	for (const { userId } of participants) notifyUser(userId, 'messages:changed');
}

export function openWishlistDiscussion(
	database: AppDatabase,
	viewerId: string,
	wishlistOwnerId: string
) {
	const conversationId = openWishlistConversation(
		database,
		viewerId,
		wishlistOwnerId,
		'discussion'
	);
	notifyConversationParticipants(database, conversationId);
	notifyOrganizerDashboard();
	return getParticipantConversation(database, conversationId, viewerId);
}

export function joinGiftCoordination(
	database: AppDatabase,
	viewerId: string,
	wishlistOwnerId: string
) {
	const conversationId = openWishlistConversation(
		database,
		viewerId,
		wishlistOwnerId,
		'coordination'
	);
	notifyConversationParticipants(database, conversationId);
	notifyOrganizerDashboard();
	return getParticipantConversation(database, conversationId, viewerId);
}

export function sendConversationMessage(
	database: AppDatabase,
	viewerId: string,
	conversationId: string,
	content: string
) {
	requireActiveParticipant(database, viewerId);
	assertMembership(database, conversationId, viewerId);
	const event = getEvent(database);
	if (!event || event.status === 'completed') {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'Messages cannot be sent after the event is complete.'
		});
	}

	database.transaction((transaction) => {
		assertMembership(transaction, conversationId, viewerId);
		const latestMessage = transaction
			.select({ createdAt: wishlistMessages.createdAt })
			.from(wishlistMessages)
			.where(eq(wishlistMessages.conversationId, conversationId))
			.orderBy(desc(wishlistMessages.createdAt), desc(wishlistMessages.id))
			.get();
		const createdAt = new Date(Math.max(Date.now(), (latestMessage?.createdAt.getTime() ?? 0) + 1));
		transaction
			.insert(wishlistMessages)
			.values({
				id: randomUUID(),
				conversationId,
				senderId: viewerId,
				content,
				createdAt
			})
			.run();
		transaction
			.update(wishlistConversations)
			.set({ updatedAt: createdAt, lastMessageAt: createdAt })
			.where(eq(wishlistConversations.id, conversationId))
			.run();
	});

	notifyConversationParticipants(database, conversationId);
	notifyOrganizerDashboard();
	return { success: true };
}

export function markConversationRead(
	database: AppDatabase,
	viewerId: string,
	conversationId: string
) {
	requireActiveParticipant(database, viewerId);
	const conversation = assertMembership(database, conversationId, viewerId);
	const lastMessage = database
		.select({ createdAt: wishlistMessages.createdAt })
		.from(wishlistMessages)
		.where(eq(wishlistMessages.conversationId, conversationId))
		.orderBy(desc(wishlistMessages.createdAt), desc(wishlistMessages.id))
		.get();
	if (!lastMessage || lastMessage.createdAt <= conversation.lastReadAt) {
		return { updated: false };
	}

	database
		.update(wishlistConversationParticipants)
		.set({ lastReadAt: lastMessage.createdAt })
		.where(
			and(
				eq(wishlistConversationParticipants.conversationId, conversationId),
				eq(wishlistConversationParticipants.userId, viewerId)
			)
		)
		.run();
	notifyUser(viewerId, 'badges:changed');
	return { updated: true };
}

export function countUnreadMessageCounts(database: AppDatabase, userId: string) {
	const countForOwnerRelation = (isOwner: boolean) =>
		database
			.select({ value: count() })
			.from(wishlistMessages)
			.innerJoin(
				wishlistConversations,
				eq(wishlistConversations.id, wishlistMessages.conversationId)
			)
			.innerJoin(
				wishlistConversationParticipants,
				and(
					eq(wishlistConversationParticipants.conversationId, wishlistMessages.conversationId),
					eq(wishlistConversationParticipants.userId, userId)
				)
			)
			.where(
				and(
					ne(wishlistMessages.senderId, userId),
					gt(wishlistMessages.createdAt, wishlistConversationParticipants.lastReadAt),
					isOwner
						? eq(wishlistConversations.wishlistOwnerId, userId)
						: ne(wishlistConversations.wishlistOwnerId, userId)
				)
			)
			.get()?.value ?? 0;
	const asRecipient = countForOwnerRelation(true);
	const asGiver = countForOwnerRelation(false);
	return { asGiver, asRecipient, total: asGiver + asRecipient };
}

export function countUnreadMessages(database: AppDatabase, userId: string): number {
	return countUnreadMessageCounts(database, userId).total;
}

export function getRecentParticipantMessages(database: AppDatabase, userId: string, limit = 6) {
	const conversationIds = database
		.select({ id: wishlistConversationParticipants.conversationId })
		.from(wishlistConversationParticipants)
		.where(eq(wishlistConversationParticipants.userId, userId))
		.all();
	const messages = conversationIds.flatMap(({ id }) => {
		const conversation = assertMembership(database, id, userId);
		return database
			.select({
				id: wishlistMessages.id,
				senderId: wishlistMessages.senderId,
				content: wishlistMessages.content,
				createdAt: wishlistMessages.createdAt
			})
			.from(wishlistMessages)
			.where(eq(wishlistMessages.conversationId, conversation.id))
			.orderBy(desc(wishlistMessages.createdAt), desc(wishlistMessages.id))
			.limit(limit)
			.all()
			.map((message) => {
				const sender = presentIdentity(
					identityFor(database, conversation, userId, message.senderId)
				);
				return {
					id: message.id,
					content: message.content,
					sentAt: message.createdAt.toISOString(),
					isOwnMessage: message.senderId === userId,
					senderLabel: sender.label,
					threadLabel: getTitle(conversation.ownerDisplayName, conversation.type)
				};
			});
	});
	return messages
		.sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt))
		.slice(0, limit);
}

export function getConversationMigrationReviews(database: AppDatabase) {
	return database
		.select({
			id: conversationMigrationReviews.id,
			source: conversationMigrationReviews.legacySource,
			conversationId: conversationMigrationReviews.legacyConversationId,
			userId: conversationMigrationReviews.relatedUserId,
			displayName: users.displayName,
			reason: conversationMigrationReviews.reason
		})
		.from(conversationMigrationReviews)
		.leftJoin(users, eq(users.id, conversationMigrationReviews.relatedUserId))
		.where(isNull(conversationMigrationReviews.resolvedAt))
		.orderBy(asc(conversationMigrationReviews.createdAt))
		.all()
		.map((review) => ({
			...review,
			reason: review.reason.replaceAll('Gift Coordination', 'private gift planning')
		}));
}
