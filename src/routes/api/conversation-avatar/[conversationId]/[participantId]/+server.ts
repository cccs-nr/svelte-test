import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db/index.js';
import {
	wishlistConversationParticipants,
	wishlistConversations,
	users
} from '#lib/server/db/schema.js';
import { isActiveExchangeParticipant } from '#lib/server/wishlist-access.js';
import { serveProfileImage } from '#lib/server/profile-image-response.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user || !isActiveExchangeParticipant(db, locals.user.id)) {
		return new Response('Conversation access is required.', { status: 404 });
	}

	const conversation = db
		.select({
			wishlistOwnerId: wishlistConversations.wishlistOwnerId,
			type: wishlistConversations.type
		})
		.from(wishlistConversations)
		.innerJoin(
			wishlistConversationParticipants,
			and(
				eq(wishlistConversationParticipants.conversationId, wishlistConversations.id),
				eq(wishlistConversationParticipants.userId, locals.user.id)
			)
		)
		.where(eq(wishlistConversations.id, params.conversationId))
		.get();
	if (
		!conversation ||
		(conversation.type === 'gift_coordination' &&
			conversation.wishlistOwnerId === locals.user.id) ||
		(params.participantId !== locals.user.id &&
			params.participantId !== conversation.wishlistOwnerId)
	) {
		return new Response('Conversation avatar not found.', { status: 404 });
	}

	const avatar = db
		.select({ key: users.avatarKey, mimeType: users.avatarMimeType })
		.from(users)
		.where(eq(users.id, params.participantId))
		.get();
	return serveProfileImage(avatar?.key ?? null, avatar?.mimeType ?? null);
};
