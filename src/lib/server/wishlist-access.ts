import { and, eq, isNotNull, or } from 'drizzle-orm';
import { isExchangeParticipant, type AuthenticatedUser } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { assignments, users } from '#lib/server/db/schema.js';

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

export function getFinalizedGiverId(database: AppDatabase, receiverId: string): string | null {
	const assignment = database
		.select({ giverId: assignments.giverId })
		.from(assignments)
		.where(
			and(
				eq(assignments.eventId, SINGLE_EVENT_ID),
				eq(assignments.receiverId, receiverId),
				isNotNull(assignments.finalizedAt)
			)
		)
		.get();

	return assignment?.giverId ?? null;
}

export function canViewWishlist(
	database: AppDatabase,
	viewer: AuthenticatedUser,
	ownerId: string
): boolean {
	if (!isExchangeParticipant(viewer)) return false;

	return (
		isActiveExchangeParticipant(database, viewer.id) &&
		isActiveExchangeParticipant(database, ownerId)
	);
}

export function isActiveExchangeParticipant(database: AppDatabase, userId: string): boolean {
	return Boolean(
		database
			.select({ id: users.id })
			.from(users)
			.where(
				and(
					eq(users.id, userId),
					eq(users.isActive, true),
					or(eq(users.role, 'participant'), eq(users.isParticipating, true))
				)
			)
			.get()
	);
}

export function getActiveExchangeParticipantIds(database: AppDatabase): string[] {
	return database
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
}
