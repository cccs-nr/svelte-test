import { count, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { SINGLE_EVENT_ID, type EventStatus } from '#lib/models/event.js';
import { db } from '#lib/server/db/index.js';
import { requireOrganizerPage } from '#lib/server/page-guards.js';
import {
	assignments,
	conversations,
	events,
	giftSuggestions,
	households,
	messages,
	users
} from '#lib/server/db/schema.js';

const eventStages: { value: EventStatus; label: string }[] = [
	{ value: 'setup', label: 'Setup' },
	{ value: 'open', label: 'Open' },
	{ value: 'assignments_generated', label: 'Assignments generated' },
	{ value: 'completed', label: 'Completed' }
];

export const load: PageServerLoad = ({ locals }) => {
	requireOrganizerPage(locals.user);

	const event =
		db
			.select({
				name: events.name,
				exchangeDate: events.exchangeDate,
				status: events.status
			})
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get() ?? null;
	const accountRows = db
		.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			role: users.role,
			isActive: users.isActive,
			isParticipating: users.isParticipating,
			householdName: households.name
		})
		.from(users)
		.leftJoin(households, eq(households.id, users.householdId))
		.orderBy(users.displayName, users.username)
		.all();
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
	const messageCount =
		db
			.select({ value: count(messages.id) })
			.from(messages)
			.innerJoin(conversations, eq(conversations.id, messages.conversationId))
			.innerJoin(assignments, eq(assignments.id, conversations.assignmentId))
			.where(eq(assignments.eventId, SINGLE_EVENT_ID))
			.get()?.value ?? 0;
	const wishlistCountByUser = new Map(wishlistCounts.map(({ userId, value }) => [userId, value]));
	const messageCountByUser = new Map<string, number>();
	for (const { userId, value } of [...outgoingMessageCounts, ...incomingMessageCounts]) {
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
	const activeParticipants = accountRows.filter(
		(account) => account.isActive && (account.role === 'participant' || account.isParticipating)
	).length;
	const wishlistIdeaCount = wishlistCounts.reduce((total, row) => total + row.value, 0);
	const finalizedAssignmentCount = assignmentRows.filter(
		(assignment) => assignment.finalizedAt !== null
	).length;
	const purchasedGiftCount = assignmentRows.filter(
		(assignment) => assignment.finalizedAt !== null && assignment.giftPurchasedAt !== null
	).length;
	const currentStageIndex = event
		? eventStages.findIndex((stage) => stage.value === event.status)
		: 0;

	return {
		event,
		eventStages,
		currentStageIndex,
		participants,
		stats: {
			accountCount: accountRows.length,
			activeParticipants,
			wishlistIdeaCount,
			messageCount,
			finalizedAssignmentCount,
			purchasedGiftCount
		}
	};
};
