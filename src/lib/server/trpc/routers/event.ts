import { and, eq, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { eventSettingsInputSchema, SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { assignments, events, users } from '#lib/server/db/schema.js';
import { notifyOrganizerDashboard, notifyUser } from '#lib/server/realtime.js';
import { organizerProcedure, protectedProcedure, router } from '#lib/server/trpc/init.js';
import { z } from 'zod';

function getEvent(database: AppDatabase) {
	return database
		.select({
			id: events.id,
			name: events.name,
			description: events.description,
			exchangeDate: events.exchangeDate,
			giftBudgetCents: events.giftBudgetCents,
			currency: events.currency,
			instructions: events.instructions,
			status: events.status
		})
		.from(events)
		.where(eq(events.id, SINGLE_EVENT_ID))
		.get();
}

export const eventRouter = router({
	current: protectedProcedure.query(({ ctx }) => {
		return getEvent(ctx.db) ?? null;
	}),
	save: organizerProcedure.input(eventSettingsInputSchema).mutation(({ ctx, input }) => {
		const assignmentSetExists = ctx.db
			.select({ id: assignments.id })
			.from(assignments)
			.where(eq(assignments.eventId, SINGLE_EVENT_ID))
			.get();
		if (assignmentSetExists) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Reset assignments before changing event settings.'
			});
		}

		ctx.db
			.insert(events)
			.values({
				id: SINGLE_EVENT_ID,
				name: input.name,
				description: input.description,
				exchangeDate: input.exchangeDate,
				giftBudgetCents: input.giftBudgetCents,
				currency: 'CAD',
				instructions: input.instructions,
				status: input.status,
				updatedAt: new Date()
			})
			.onConflictDoUpdate({
				target: events.id,
				set: {
					name: input.name,
					description: input.description,
					exchangeDate: input.exchangeDate,
					giftBudgetCents: input.giftBudgetCents,
					currency: 'CAD',
					instructions: input.instructions,
					status: input.status,
					updatedAt: new Date()
				}
			})
			.run();

		const event = getEvent(ctx.db);
		if (!event) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Event settings could not be saved.'
			});
		}

		notifyOrganizerDashboard();
		return event;
	}),
	complete: organizerProcedure.input(z.object({ confirm: z.literal(true) })).mutation(({ ctx }) => {
		const event = getEvent(ctx.db);
		if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found.' });
		if (event.status === 'completed') return { completed: true };
		if (event.status !== 'assignments_generated') {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'Generate and finalize assignments before completing the event.'
			});
		}

		const assignmentsForEvent = ctx.db
			.select({ finalizedAt: assignments.finalizedAt })
			.from(assignments)
			.where(eq(assignments.eventId, SINGLE_EVENT_ID))
			.all();
		if (
			assignmentsForEvent.length === 0 ||
			assignmentsForEvent.some((assignment) => assignment.finalizedAt === null)
		) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'Every assignment must be finalized before completing the event.'
			});
		}

		const completedAt = new Date();
		ctx.db
			.update(events)
			.set({ status: 'completed', updatedAt: completedAt })
			.where(and(eq(events.id, SINGLE_EVENT_ID), eq(events.status, 'assignments_generated')))
			.run();
		const participants = ctx.db
			.select({ id: users.id })
			.from(users)
			.where(
				and(
					eq(users.isActive, true),
					or(eq(users.role, 'participant'), eq(users.isParticipating, true))
				)
			)
			.all();
		for (const { id } of participants) notifyUser(id, 'event:changed');
		notifyOrganizerDashboard();
		return { completed: true };
	})
});
