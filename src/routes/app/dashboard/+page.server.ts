import { and, count, eq, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { SINGLE_EVENT_ID, type EventStatus } from '#lib/models/event.js';
import { db } from '#lib/server/db/index.js';
import { requireOrganizerPage } from '#lib/server/page-guards.js';
import {
	assignments,
	conversations,
	events,
	giftConversationParticipants,
	giftConversations,
	giftMessages,
	giftReservations,
	giftSuggestions,
	households,
	messages,
	users
} from '#lib/server/db/schema.js';

const eventStages: { value: EventStatus | 'revealed'; label: string }[] = [
	{ value: 'setup', label: 'Setup' },
	{ value: 'open', label: 'Wishlist preparation' },
	{ value: 'assignments_generated', label: 'Gift coordination' },
	{ value: 'completed', label: 'Exchange complete' },
	{ value: 'revealed', label: 'Identity reveal' }
];

export const load: PageServerLoad = ({ locals }) => {
	const organizer = requireOrganizerPage(locals.user);

	const event =
		db
			.select({
				name: events.name,
				description: events.description,
				exchangeDate: events.exchangeDate,
				giftBudgetCents: events.giftBudgetCents,
				currency: events.currency,
				instructions: events.instructions,
				status: events.status,
				revealedAt: events.revealedAt
			})
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get() ?? null;
	const accountRows = db
		.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			householdId: users.householdId,
			role: users.role,
			isActive: users.isActive,
			isParticipating: users.isParticipating,
			householdName: households.name
		})
		.from(users)
		.leftJoin(households, eq(households.id, users.householdId))
		.orderBy(users.displayName, users.id)
		.all();
	const householdRows = db
		.select({ id: households.id, name: households.name })
		.from(households)
		.orderBy(households.name)
		.all();
	const householdMembers = db
		.select({ id: users.id, displayName: users.displayName, householdId: users.householdId })
		.from(users)
		.where(sql`${users.householdId} is not null`)
		.orderBy(users.displayName, users.id)
		.all();
	const membersByHousehold = new Map<string, { id: string; displayName: string }[]>();
	for (const { id, displayName, householdId } of householdMembers) {
		if (!householdId) continue;
		const members = membersByHousehold.get(householdId) ?? [];
		members.push({ id, displayName });
		membersByHousehold.set(householdId, members);
	}
	const householdsForDashboard = householdRows.map((household) => ({
		...household,
		members: membersByHousehold.get(household.id) ?? [],
		memberCount: membersByHousehold.get(household.id)?.length ?? 0
	}));
	const assignmentRows = db
		.select({
			giverId: assignments.giverId,
			finalizedAt: assignments.finalizedAt,
			giftPurchasedAt: assignments.giftPurchasedAt
		})
		.from(assignments)
		.where(eq(assignments.eventId, SINGLE_EVENT_ID))
		.all();
	const wishlistCounts = db
		.select({ userId: giftSuggestions.ownerId, value: count() })
		.from(giftSuggestions)
		.groupBy(giftSuggestions.ownerId)
		.all();
	const outgoingMessageCounts = db
		.select({ userId: assignments.giverId, value: count(messages.id) })
		.from(assignments)
		.leftJoin(conversations, eq(conversations.assignmentId, assignments.id))
		.leftJoin(messages, eq(messages.conversationId, conversations.id))
		.where(eq(assignments.eventId, SINGLE_EVENT_ID))
		.groupBy(assignments.giverId)
		.all();
	const incomingMessageCounts = db
		.select({ userId: assignments.receiverId, value: count(messages.id) })
		.from(assignments)
		.leftJoin(conversations, eq(conversations.assignmentId, assignments.id))
		.leftJoin(messages, eq(messages.conversationId, conversations.id))
		.where(eq(assignments.eventId, SINGLE_EVENT_ID))
		.groupBy(assignments.receiverId)
		.all();
	const familyMessageCounts = db
		.select({ userId: giftConversationParticipants.userId, value: count(giftMessages.id) })
		.from(giftConversationParticipants)
		.leftJoin(
			giftMessages,
			eq(giftMessages.conversationId, giftConversationParticipants.conversationId)
		)
		.groupBy(giftConversationParticipants.userId)
		.all();
	const messageCount =
		db
			.select({ value: count(messages.id) })
			.from(messages)
			.innerJoin(conversations, eq(conversations.id, messages.conversationId))
			.innerJoin(assignments, eq(assignments.id, conversations.assignmentId))
			.where(eq(assignments.eventId, SINGLE_EVENT_ID))
			.get()?.value ?? 0;
	const familyMessageCount = db.select({ value: count() }).from(giftMessages).get()?.value ?? 0;
	const wishlistCountByUser = new Map(wishlistCounts.map(({ userId, value }) => [userId, value]));
	const messageCountByUser = new Map<string, number>();
	for (const { userId, value } of [...outgoingMessageCounts, ...incomingMessageCounts]) {
		messageCountByUser.set(userId, (messageCountByUser.get(userId) ?? 0) + value);
	}
	for (const { userId, value } of familyMessageCounts) {
		messageCountByUser.set(userId, (messageCountByUser.get(userId) ?? 0) + value);
	}
	const assignmentByGiver = new Map(
		assignmentRows.map((assignment) => [assignment.giverId, assignment])
	);
	const participants = accountRows.map((account) => {
		const assignment = assignmentByGiver.get(account.id);
		const isParticipating = account.role === 'participant' || account.isParticipating;

		let eventStatus: string;
		if (!account.isActive) {
			eventStatus = 'Inactive';
		} else if (!isParticipating) {
			eventStatus = 'Not participating';
		} else if (assignment?.finalizedAt) {
			eventStatus = 'Assigned';
		} else if (assignmentRows.length > 0) {
			eventStatus = 'Draw pending';
		} else {
			eventStatus = event?.status === 'setup' ? 'Preparing' : 'Waiting for draw';
		}

		return {
			id: account.id,
			username: account.username,
			displayName: account.displayName,
			householdId: account.householdId,
			role: account.role,
			householdName: account.householdName,
			isActive: account.isActive,
			isParticipating,
			eventStatus,
			wishlistCount: wishlistCountByUser.get(account.id) ?? 0,
			messageCount: messageCountByUser.get(account.id) ?? 0,
			assignmentFinalized: Boolean(assignment?.finalizedAt),
			giftPurchased: Boolean(assignment?.finalizedAt && assignment.giftPurchasedAt)
		};
	});
	const totalParticipants = accountRows.filter(
		(account) => account.role === 'participant' || account.isParticipating
	).length;
	const activeAccounts = accountRows.filter((account) => account.isActive).length;
	const activeParticipants = accountRows.filter(
		(account) => account.isActive && (account.role === 'participant' || account.isParticipating)
	).length;
	const wishlistIdeaCount = wishlistCounts.reduce((total, row) => total + row.value, 0);
	const finalizedAssignmentCount = assignmentRows.filter(
		(assignment) => assignment.finalizedAt !== null
	).length;
	const assignmentsFinalized =
		assignmentRows.length > 0 && finalizedAssignmentCount === assignmentRows.length;
	const purchasedGiftCount = assignmentRows.filter(
		(assignment) => assignment.finalizedAt !== null && assignment.giftPurchasedAt !== null
	).length;
	const reservationRows = db
		.select({ status: giftReservations.status, reserverId: giftReservations.reserverId })
		.from(giftReservations)
		.where(or(eq(giftReservations.status, 'reserved'), eq(giftReservations.status, 'purchased')))
		.all();
	const purchasedReservationRows = reservationRows.filter((row) => row.status === 'purchased');
	const coordinationConversationCount =
		db
			.select({ value: count() })
			.from(giftConversations)
			.where(
				and(
					eq(giftConversations.eventId, SINGLE_EVENT_ID),
					eq(giftConversations.type, 'private_coordination')
				)
			)
			.get()?.value ?? 0;
	const currentStageIndex = event
		? event.revealedAt
			? eventStages.findIndex((stage) => stage.value === 'revealed')
			: eventStages.findIndex((stage) => stage.value === event.status)
		: 0;

	return {
		event,
		eventStages,
		currentStageIndex,
		currentUserId: organizer.id,
		households: householdsForDashboard,
		assignmentsExist: assignmentRows.length > 0,
		assignmentsFinalized,
		participants,
		stats: {
			accountCount: accountRows.length,
			totalParticipants,
			activeAccounts,
			activeParticipants,
			householdCount: householdRows.length,
			wishlistIdeaCount,
			messageCount: messageCount + familyMessageCount,
			assignmentCount: assignmentRows.length,
			finalizedAssignmentCount,
			purchasedGiftCount,
			totalReservations: reservationRows.length,
			purchasedReservationCount: purchasedReservationRows.length,
			participantsWithCompletedPurchases: new Set([
				...purchasedReservationRows.map(({ reserverId }) => reserverId),
				...assignmentRows
					.filter((assignment) => assignment.giftPurchasedAt !== null)
					.map(({ giverId }) => giverId)
			]).size,
			coordinationConversationCount
		}
	};
};
