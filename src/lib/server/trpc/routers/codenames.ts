import { randomInt, randomUUID } from 'node:crypto';
import { and, eq, isNull, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import {
	assignCodename,
	getAvailableCodenames,
	getParticipantCodename
} from '#lib/server/codenames.js';
import {
	assignments,
	codenameAuditLog,
	events,
	participantCodenames,
	users
} from '#lib/server/db/schema.js';
import { notifyOrganizerDashboard, notifyUser } from '#lib/server/realtime.js';
import {
	getActiveExchangeParticipantIds,
	isActiveExchangeParticipant
} from '#lib/server/wishlist-access.js';
import { organizerProcedure, participantProcedure, router } from '#lib/server/trpc/init.js';

const updateCodenameInputSchema = z.object({
	userId: z.string().min(1),
	codename: z.string().trim().min(1).max(60)
});

function isUniqueConstraintError(error: unknown): error is Error & { code: string } {
	return error instanceof Error && 'code' in error && typeof error.code === 'string';
}

function notifyCodenameChanged(database: AppDatabase): void {
	notifyOrganizerDashboard();
	for (const id of getActiveExchangeParticipantIds(database)) {
		notifyUser(id, 'codenames:changed');
		notifyUser(id, 'family-wishlist:changed');
	}
}

export const codenamesRouter = router({
	mine: participantProcedure.query(({ ctx }) => {
		if (!isActiveExchangeParticipant(ctx.db, ctx.user.id)) {
			throw new TRPCError({ code: 'FORBIDDEN', message: 'Active participant access is required.' });
		}
		const event = ctx.db
			.select({ revealedAt: events.revealedAt })
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get();
		const codename = getParticipantCodename(ctx.db, ctx.user.id);

		return {
			codename: codename?.codename ?? null,
			revealed: Boolean(event?.revealedAt)
		};
	}),

	changeMine: participantProcedure.mutation(({ ctx }) => {
		if (!isActiveExchangeParticipant(ctx.db, ctx.user.id)) {
			throw new TRPCError({
				code: 'FORBIDDEN',
				message: 'Active participant access is required.'
			});
		}
		const event = ctx.db
			.select({ status: events.status, revealedAt: events.revealedAt })
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get();
		if (!event || event.status === 'completed' || event.revealedAt) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'Codenames can only be changed before the event is complete and revealed.'
			});
		}
		const currentCodename = getParticipantCodename(ctx.db, ctx.user.id)?.codename;
		if (!currentCodename) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'Your codename will be available after the organizer generates assignments.'
			});
		}
		const availableCodenames = getAvailableCodenames(ctx.db, ctx.user.id);
		if (availableCodenames.length === 0) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'There are no unused suggested codenames available.'
			});
		}
		const codename = availableCodenames[randomInt(availableCodenames.length)];
		if (!codename || codename === currentCodename) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'A new codename could not be selected.'
			});
		}

		const updatedAt = new Date();
		try {
			ctx.db.transaction((transaction) => {
				assignCodename(transaction, ctx.user.id, codename);
				transaction
					.insert(codenameAuditLog)
					.values({
						id: randomUUID(),
						eventId: SINGLE_EVENT_ID,
						actorId: ctx.user.id,
						targetUserId: ctx.user.id,
						action: 'codename_updated',
						createdAt: updatedAt
					})
					.run();
			});
		} catch (error) {
			if (isUniqueConstraintError(error) && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'That codename was just chosen by another participant. Choose another.'
				});
			}
			throw error;
		}

		notifyCodenameChanged(ctx.db);
		return { codename };
	}),

	revealMapping: participantProcedure.query(({ ctx }) => {
		if (!isActiveExchangeParticipant(ctx.db, ctx.user.id)) {
			throw new TRPCError({ code: 'FORBIDDEN', message: 'Active participant access is required.' });
		}
		const event = ctx.db
			.select({ revealedAt: events.revealedAt })
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get();
		if (!event?.revealedAt) return null;

		return ctx.db
			.select({
				codename: participantCodenames.codename,
				displayName: users.displayName
			})
			.from(participantCodenames)
			.innerJoin(users, eq(users.id, participantCodenames.userId))
			.where(eq(participantCodenames.eventId, SINGLE_EVENT_ID))
			.orderBy(participantCodenames.codename)
			.all();
	}),

	adminMapping: organizerProcedure
		.input(z.object({ confirm: z.literal(true) }))
		.mutation(({ ctx }) => {
			const event = ctx.db
				.select({ id: events.id })
				.from(events)
				.where(eq(events.id, SINGLE_EVENT_ID))
				.get();
			if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found.' });

			const rows = ctx.db
				.select({
					userId: participantCodenames.userId,
					displayName: users.displayName,
					codename: participantCodenames.codename
				})
				.from(participantCodenames)
				.innerJoin(users, eq(users.id, participantCodenames.userId))
				.where(eq(participantCodenames.eventId, SINGLE_EVENT_ID))
				.orderBy(users.displayName, users.id)
				.all();

			ctx.db
				.insert(codenameAuditLog)
				.values({
					id: randomUUID(),
					eventId: SINGLE_EVENT_ID,
					actorId: ctx.user.id,
					action: 'mapping_accessed',
					createdAt: new Date()
				})
				.run();

			return rows;
		}),

	update: organizerProcedure.input(updateCodenameInputSchema).mutation(({ ctx, input }) => {
		const event = ctx.db
			.select({ revealedAt: events.revealedAt })
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get();
		if (event?.revealedAt) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Codenames cannot be changed after the event reveal.'
			});
		}

		const updatedAt = new Date();
		ctx.db.transaction((transaction) => {
			assignCodename(transaction, input.userId, input.codename);
			transaction
				.insert(codenameAuditLog)
				.values({
					id: randomUUID(),
					eventId: SINGLE_EVENT_ID,
					actorId: ctx.user.id,
					targetUserId: input.userId,
					action: 'codename_updated',
					createdAt: updatedAt
				})
				.run();
		});

		notifyCodenameChanged(ctx.db);
		return { success: true };
	}),

	reveal: organizerProcedure.mutation(({ ctx }) => {
		const event = ctx.db
			.select({ status: events.status, revealedAt: events.revealedAt })
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get();
		if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found.' });
		if (event.status !== 'completed') {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'Complete the event before revealing participant identities.'
			});
		}
		if (event.revealedAt) {
			return { revealed: true, revealedAt: event.revealedAt.toISOString() };
		}

		const assignmentRows = ctx.db
			.select({ finalizedAt: assignments.finalizedAt })
			.from(assignments)
			.where(eq(assignments.eventId, SINGLE_EVENT_ID))
			.all();
		if (
			assignmentRows.length === 0 ||
			assignmentRows.some((assignment) => assignment.finalizedAt === null)
		) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'Every assignment must be finalized before the reveal.'
			});
		}

		const activeParticipants = ctx.db
			.select({ id: users.id })
			.from(users)
			.where(
				and(
					eq(users.isActive, true),
					or(eq(users.role, 'participant'), eq(users.isParticipating, true))
				)
			)
			.all();
		const assignedCodenames = ctx.db
			.select({ userId: participantCodenames.userId })
			.from(participantCodenames)
			.where(eq(participantCodenames.eventId, SINGLE_EVENT_ID))
			.all();
		const codenameUserIds = new Set(assignedCodenames.map(({ userId }) => userId));
		if (activeParticipants.some(({ id }) => !codenameUserIds.has(id))) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'Every active participant must have a codename before the reveal.'
			});
		}

		const revealedAt = new Date();
		const revealed = ctx.db.transaction((transaction) => {
			const result = transaction
				.update(events)
				.set({ revealedAt, revealedBy: ctx.user.id, updatedAt: revealedAt })
				.where(
					and(
						eq(events.id, SINGLE_EVENT_ID),
						eq(events.status, 'completed'),
						isNull(events.revealedAt)
					)
				)
				.run();
			if (result.changes === 0) return false;
			transaction
				.insert(codenameAuditLog)
				.values({
					id: randomUUID(),
					eventId: SINGLE_EVENT_ID,
					actorId: ctx.user.id,
					action: 'reveal_started',
					createdAt: revealedAt
				})
				.run();
			return true;
		});
		if (!revealed) {
			const currentReveal = ctx.db
				.select({ revealedAt: events.revealedAt })
				.from(events)
				.where(eq(events.id, SINGLE_EVENT_ID))
				.get()?.revealedAt;
			if (currentReveal) {
				return { revealed: true, revealedAt: currentReveal.toISOString() };
			}
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'The event reveal could not be completed.'
			});
		}

		for (const { id } of activeParticipants) notifyUser(id, 'codenames:changed');
		notifyOrganizerDashboard();
		return { revealed: true, revealedAt: revealedAt.toISOString() };
	})
});
