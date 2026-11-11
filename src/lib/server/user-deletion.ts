import { eq, inArray, or } from 'drizzle-orm';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { removeImage } from '#lib/server/image-storage.js';
import {
	assignments,
	codenameAuditLog,
	giftReservationAuditLog,
	giftReservations,
	giftSuggestions,
	legacyGiftConversationParticipants,
	legacyGiftConversationReads,
	legacyGiftConversations,
	legacyGiftMessages,
	participantCodenames,
	users,
	wishlistConversationParticipants,
	wishlistConversations,
	wishlistMessages
} from '#lib/server/db/schema.js';

type ImageFile = { key: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' };

/** Collects an account plus every participant it manages. */
export function collectManagedAccountIds(database: AppDatabase, userId: string): string[] {
	const managed = database
		.select({ id: users.id })
		.from(users)
		.where(eq(users.managedByUserId, userId))
		.all();
	return [userId, ...managed.map(({ id }) => id)];
}

/**
 * Permanently removes the given accounts and every record that references them.
 * Callers must verify that no gift assignments exist first.
 */
export async function deleteUserAccounts(
	database: AppDatabase,
	userIds: readonly string[]
): Promise<void> {
	if (userIds.length === 0) return;
	const ids = [...userIds];
	const images: ImageFile[] = [];

	database.transaction((tx) => {
		for (const row of tx
			.select({ key: users.avatarKey, mimeType: users.avatarMimeType })
			.from(users)
			.where(inArray(users.id, ids))
			.all()) {
			if (row.key && row.mimeType) images.push({ key: row.key, mimeType: row.mimeType });
		}

		const ownedSuggestions = tx
			.select({
				id: giftSuggestions.id,
				key: giftSuggestions.imageKey,
				mimeType: giftSuggestions.imageMimeType
			})
			.from(giftSuggestions)
			.where(inArray(giftSuggestions.ownerId, ids))
			.all();
		for (const row of ownedSuggestions) {
			if (row.key && row.mimeType) images.push({ key: row.key, mimeType: row.mimeType });
		}
		const ownedSuggestionIds = ownedSuggestions.map(({ id }) => id);

		tx.delete(giftReservationAuditLog).where(inArray(giftReservationAuditLog.actorId, ids)).run();
		tx.delete(giftReservations)
			.where(
				ownedSuggestionIds.length > 0
					? or(
							inArray(giftReservations.reserverId, ids),
							inArray(giftReservations.giftSuggestionId, ownedSuggestionIds)
						)
					: inArray(giftReservations.reserverId, ids)
			)
			.run();
		tx.delete(giftSuggestions).where(inArray(giftSuggestions.ownerId, ids)).run();

		tx.delete(wishlistMessages).where(inArray(wishlistMessages.senderId, ids)).run();
		tx.delete(wishlistConversationParticipants)
			.where(inArray(wishlistConversationParticipants.userId, ids))
			.run();
		tx.delete(wishlistConversations)
			.where(inArray(wishlistConversations.wishlistOwnerId, ids))
			.run();

		tx.delete(legacyGiftMessages).where(inArray(legacyGiftMessages.senderId, ids)).run();
		tx.delete(legacyGiftConversationReads)
			.where(inArray(legacyGiftConversationReads.userId, ids))
			.run();
		tx.delete(legacyGiftConversationParticipants)
			.where(inArray(legacyGiftConversationParticipants.userId, ids))
			.run();
		tx.delete(legacyGiftConversations)
			.where(inArray(legacyGiftConversations.recipientId, ids))
			.run();

		tx.delete(codenameAuditLog).where(inArray(codenameAuditLog.actorId, ids)).run();
		tx.delete(participantCodenames).where(inArray(participantCodenames.userId, ids)).run();
		tx.delete(assignments)
			.where(or(inArray(assignments.giverId, ids), inArray(assignments.receiverId, ids)))
			.run();
		tx.delete(users).where(inArray(users.id, ids)).run();
	});

	await Promise.all(images.map(({ key, mimeType }) => removeImage(key, mimeType)));
}
