import { and, eq, isNotNull } from 'drizzle-orm';
import { isExchangeParticipant, type AuthenticatedUser } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { assignments } from '#lib/server/db/schema.js';

export function getFinalizedRecipientId(database: AppDatabase, giverId: string): string | null {
	const assignment = database
		.select({ receiverId: assignments.receiverId })
		.from(assignments)
		.where(
			and(
				eq(assignments.eventId, SINGLE_EVENT_ID),
				eq(assignments.giverId, giverId),
				isNotNull(assignments.finalizedAt)
			)
		)
		.get();

	return assignment?.receiverId ?? null;
}

export function canViewWishlist(
	database: AppDatabase,
	viewer: AuthenticatedUser,
	ownerId: string
): boolean {
	if (!isExchangeParticipant(viewer)) return false;
	if (viewer.id === ownerId) return true;

	return (
		database
			.select({ id: assignments.id })
			.from(assignments)
			.where(
				and(
					eq(assignments.eventId, SINGLE_EVENT_ID),
					eq(assignments.giverId, viewer.id),
					eq(assignments.receiverId, ownerId),
					isNotNull(assignments.finalizedAt)
				)
			)
			.get() !== undefined
	);
}
