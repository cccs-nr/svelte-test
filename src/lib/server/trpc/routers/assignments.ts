import { randomUUID } from 'node:crypto';
import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import {
	generateSecretSantaAssignments,
	validateSecretSantaAssignments
} from '#lib/server/assignment-algorithm.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { assignments, events, users } from '#lib/server/db/schema.js';
import { organizerProcedure, protectedProcedure, router } from '#lib/server/trpc/init.js';
import { z } from 'zod';

function getActiveParticipants(database: AppDatabase) {
	return database
		.select({ id: users.id, householdId: users.householdId })
		.from(users)
		.where(
			and(
				eq(users.isActive, true),
				or(eq(users.role, 'participant'), eq(users.isParticipating, true))
			)
		)
		.all();
}

function getEvent(database: AppDatabase) {
	return database.select().from(events).where(eq(events.id, SINGLE_EVENT_ID)).get();
}

function getEventAssignments(database: AppDatabase) {
	return database
		.select({
			giverId: assignments.giverId,
			receiverId: assignments.receiverId,
			finalizedAt: assignments.finalizedAt
		})
		.from(assignments)
		.where(eq(assignments.eventId, SINGLE_EVENT_ID))
		.all();
}

function ensureEventCanBeAssigned(database: AppDatabase) {
	const event = getEvent(database);
	if (!event) {
		throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Configure the event first.' });
	}
	if (event.status === 'completed') {
		throw new TRPCError({
			code: 'CONFLICT',
			message: 'A completed event cannot be assigned. Reopen it before generating assignments.'
		});
	}
	if (event.status !== 'open' && event.status !== 'assignments_generated') {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'Open the event before generating assignments.'
		});
	}

	return event;
}

function validateExistingAssignments(
	participants: ReturnType<typeof getActiveParticipants>,
	rows: ReturnType<typeof getEventAssignments>
) {
	return validateSecretSantaAssignments(
		participants,
		rows.map(({ giverId, receiverId }) => ({ giverId, receiverId }))
	);
}

export const assignmentRouter = router({
	status: organizerProcedure.query(({ ctx }) => {
		const event = getEvent(ctx.db);
		const participants = getActiveParticipants(ctx.db);
		const rows = getEventAssignments(ctx.db);
		const validation = rows.length > 0 ? validateExistingAssignments(participants, rows) : null;
		const finalized =
			rows.length > 0 && rows.every((assignment) => assignment.finalizedAt !== null);
		const hasFinalizedAssignments = rows.some((assignment) => assignment.finalizedAt !== null);
		const feasible = generateSecretSantaAssignments(participants) !== null;
		const eventCanBeAssigned =
			event?.status === 'open' || event?.status === 'assignments_generated';

		return {
			eventStatus: event?.status ?? null,
			participantCount: participants.length,
			assignmentCount: rows.length,
			finalized,
			hasFinalizedAssignments,
			feasible,
			valid: validation?.valid ?? false,
			validationMessage: validation && !validation.valid ? validation.reason : null,
			canGenerate: Boolean(eventCanBeAssigned && feasible && !hasFinalizedAssignments),
			canFinalize: Boolean(
				event?.status === 'assignments_generated' && validation?.valid && !hasFinalizedAssignments
			)
		};
	}),
	generate: organizerProcedure.mutation(({ ctx }) => {
		const event = ensureEventCanBeAssigned(ctx.db);
		const existingAssignments = getEventAssignments(ctx.db);

		if (existingAssignments.some((assignment) => assignment.finalizedAt !== null)) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Reset finalized assignments before generating a new draw.'
			});
		}

		const participants = getActiveParticipants(ctx.db);
		const generated = generateSecretSantaAssignments(participants);
		if (!generated) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message:
					'No complete assignment satisfies the current participants and household restrictions.'
			});
		}

		const createdAt = new Date();
		ctx.db.transaction((transaction) => {
			transaction.delete(assignments).where(eq(assignments.eventId, SINGLE_EVENT_ID)).run();
			transaction
				.insert(assignments)
				.values(
					generated.map(({ giverId, receiverId }) => ({
						id: randomUUID(),
						eventId: SINGLE_EVENT_ID,
						giverId,
						receiverId,
						createdAt
					}))
				)
				.run();
			transaction
				.update(events)
				.set({ status: 'assignments_generated', updatedAt: createdAt })
				.where(eq(events.id, event.id))
				.run();
		});

		return { assignmentCount: generated.length, finalized: false };
	}),
	validate: organizerProcedure.query(({ ctx }) => {
		const participants = getActiveParticipants(ctx.db);
		const rows = getEventAssignments(ctx.db);
		if (rows.length === 0) {
			return {
				valid: false,
				finalized: false,
				participantCount: participants.length,
				assignmentCount: 0,
				reason: 'Generate assignments before validating the draw.'
			};
		}

		const validation = validateExistingAssignments(participants, rows);
		return {
			valid: validation.valid,
			finalized: rows.every((assignment) => assignment.finalizedAt !== null),
			participantCount: participants.length,
			assignmentCount: rows.length,
			reason: validation.valid ? null : validation.reason
		};
	}),
	finalize: organizerProcedure.mutation(({ ctx }) => {
		const event = getEvent(ctx.db);
		if (!event || event.status !== 'assignments_generated') {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'Generate assignments before finalizing the draw.'
			});
		}

		const participants = getActiveParticipants(ctx.db);
		const rows = getEventAssignments(ctx.db);
		const validation = validateExistingAssignments(participants, rows);
		if (!validation.valid) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: validation.reason
			});
		}
		if (rows.every((assignment) => assignment.finalizedAt !== null)) {
			return { finalized: true, assignmentCount: rows.length };
		}
		if (rows.some((assignment) => assignment.finalizedAt !== null)) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'The assignment set is only partially finalized and needs organizer review.'
			});
		}

		const finalizedAt = new Date();
		ctx.db.transaction((transaction) => {
			transaction
				.update(assignments)
				.set({ finalizedAt })
				.where(and(eq(assignments.eventId, SINGLE_EVENT_ID), isNull(assignments.finalizedAt)))
				.run();
			transaction
				.update(events)
				.set({ updatedAt: finalizedAt })
				.where(eq(events.id, event.id))
				.run();
		});

		return { finalized: true, assignmentCount: rows.length };
	}),
	reset: organizerProcedure.input(z.object({ confirm: z.boolean() })).mutation(({ ctx, input }) => {
		const event = getEvent(ctx.db);
		if (!event) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found.' });
		}
		if (event.status === 'completed') {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'A completed event cannot be reset.'
			});
		}

		const rows = getEventAssignments(ctx.db);
		const finalized = rows.some((assignment) => assignment.finalizedAt !== null);
		if (finalized && !input.confirm) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'Confirm that finalized recipient assignments should be cleared.'
			});
		}

		ctx.db.transaction((transaction) => {
			transaction.delete(assignments).where(eq(assignments.eventId, SINGLE_EVENT_ID)).run();
			if (rows.length > 0) {
				transaction
					.update(events)
					.set({ status: 'open', updatedAt: new Date() })
					.where(eq(events.id, event.id))
					.run();
			}
		});

		return { success: true, removedCount: rows.length, wasFinalized: finalized };
	}),
	myRecipient: protectedProcedure.query(({ ctx }) => {
		if (ctx.user.role !== 'participant' && !ctx.user.isParticipating) {
			throw new TRPCError({
				code: 'FORBIDDEN',
				message: 'Only participants can view a gift recipient.'
			});
		}

		const assignment = ctx.db
			.select({ receiverId: assignments.receiverId })
			.from(assignments)
			.where(
				and(
					eq(assignments.eventId, SINGLE_EVENT_ID),
					eq(assignments.giverId, ctx.user.id),
					isNotNull(assignments.finalizedAt)
				)
			)
			.get();

		if (!assignment) return null;

		const recipient = ctx.db
			.select({ displayName: users.displayName })
			.from(users)
			.where(eq(users.id, assignment.receiverId))
			.get();

		if (!recipient) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'The finalized recipient account could not be found.'
			});
		}

		return { displayName: recipient.displayName };
	})
});
