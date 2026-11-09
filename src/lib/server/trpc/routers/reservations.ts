import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNotNull, ne, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import {
	assignments,
	events,
	giftReservationAuditLog,
	giftReservations,
	giftSuggestions,
	participantCodenames,
	users
} from '#lib/server/db/schema.js';
import { notifyOrganizerDashboard, notifyUser } from '#lib/server/realtime.js';
import {
	getActiveExchangeParticipantIds,
	isActiveExchangeParticipant
} from '#lib/server/wishlist-access.js';
import { organizerProcedure, participantProcedure, router } from '#lib/server/trpc/init.js';

const reservationIdSchema = z.object({ reservationId: z.string().uuid() });

function isUniqueConstraintError(error: unknown): error is Error & { code: string } {
	return error instanceof Error && 'code' in error && typeof error.code === 'string';
}

function notifyFamilyMembers(database: AppDatabase): void {
	for (const userId of getActiveExchangeParticipantIds(database)) {
		notifyUser(userId, 'family-wishlist:changed');
	}
}

function ensureCoordinationIsOpen(database: AppDatabase, userId: string): void {
	const event = database
		.select({ status: events.status, revealedAt: events.revealedAt })
		.from(events)
		.where(eq(events.id, SINGLE_EVENT_ID))
		.get();
	const finalizedAssignment = database
		.select({ id: assignments.id })
		.from(assignments)
		.where(
			and(
				eq(assignments.eventId, SINGLE_EVENT_ID),
				eq(assignments.giverId, userId),
				isNotNull(assignments.finalizedAt)
			)
		)
		.get();
	if (
		!event ||
		event.status !== 'assignments_generated' ||
		event.revealedAt ||
		!finalizedAssignment ||
		!isActiveExchangeParticipant(database, userId)
	) {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: 'Gift planning is available after assignments are finalized.'
		});
	}
}

export const reservationsRouter = router({
	mine: participantProcedure.query(({ ctx }) => {
		if (!isActiveExchangeParticipant(ctx.db, ctx.user.id)) {
			throw new TRPCError({ code: 'FORBIDDEN', message: 'Active participant access is required.' });
		}
		const event = ctx.db
			.select({ status: events.status, revealedAt: events.revealedAt })
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get();
		return ctx.db
			.select({
				id: giftReservations.id,
				status: giftReservations.status,
				reservedAt: giftReservations.reservedAt,
				purchasedAt: giftReservations.purchasedAt,
				giftSuggestionId: giftSuggestions.id,
				title: giftSuggestions.title,
				ownerDisplayName: users.displayName
			})
			.from(giftReservations)
			.innerJoin(giftSuggestions, eq(giftSuggestions.id, giftReservations.giftSuggestionId))
			.innerJoin(users, eq(users.id, giftSuggestions.ownerId))
			.where(
				and(
					eq(giftReservations.reserverId, ctx.user.id),
					or(eq(giftReservations.status, 'reserved'), eq(giftReservations.status, 'purchased'))
				)
			)
			.orderBy(desc(giftReservations.updatedAt))
			.all()
			.map((reservation) => ({
				...reservation,
				reservedAt: reservation.reservedAt.toISOString(),
				purchasedAt: reservation.purchasedAt?.toISOString() ?? null,
				revealed: Boolean(event?.revealedAt),
				canChange: event?.status === 'assignments_generated' && !event.revealedAt
			}));
	}),

	reserve: participantProcedure
		.input(z.object({ giftSuggestionId: z.string().uuid() }))
		.mutation(({ ctx, input }) => {
			ensureCoordinationIsOpen(ctx.db, ctx.user.id);
			let reservationId: string;
			try {
				reservationId = ctx.db.transaction((transaction) => {
					const idea = transaction
						.select({ ownerId: giftSuggestions.ownerId })
						.from(giftSuggestions)
						.where(eq(giftSuggestions.id, input.giftSuggestionId))
						.get();
					if (!idea) {
						throw new TRPCError({ code: 'NOT_FOUND', message: 'Gift idea not found.' });
					}
					if (idea.ownerId === ctx.user.id) {
						throw new TRPCError({
							code: 'FORBIDDEN',
							message: 'You cannot reserve your own gift idea.'
						});
					}
					const ownerIsActiveParticipant = transaction
						.select({ id: users.id })
						.from(users)
						.where(
							and(
								eq(users.id, idea.ownerId),
								eq(users.isActive, true),
								or(eq(users.role, 'participant'), eq(users.isParticipating, true))
							)
						)
						.get();
					if (!ownerIsActiveParticipant) {
						throw new TRPCError({
							code: 'PRECONDITION_FAILED',
							message: 'Gift ideas from inactive or non-participating accounts cannot be reserved.'
						});
					}

					const activeReservation = transaction
						.select({ id: giftReservations.id })
						.from(giftReservations)
						.where(
							and(
								eq(giftReservations.giftSuggestionId, input.giftSuggestionId),
								or(
									eq(giftReservations.status, 'reserved'),
									eq(giftReservations.status, 'purchased')
								)
							)
						)
						.get();
					if (activeReservation) {
						throw new TRPCError({
							code: 'CONFLICT',
							message: 'This gift idea is already reserved or purchased.'
						});
					}

					const id = randomUUID();
					transaction
						.insert(giftReservations)
						.values({
							id,
							giftSuggestionId: input.giftSuggestionId,
							reserverId: ctx.user.id,
							status: 'reserved'
						})
						.run();
					return id;
				});
			} catch (error) {
				if (isUniqueConstraintError(error) && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'This gift idea was reserved by someone else.'
					});
				}
				throw error;
			}

			notifyFamilyMembers(ctx.db);
			notifyOrganizerDashboard();
			return { reservationId };
		}),

	release: participantProcedure.input(reservationIdSchema).mutation(({ ctx, input }) => {
		ensureCoordinationIsOpen(ctx.db, ctx.user.id);
		const now = new Date();
		const result = ctx.db
			.update(giftReservations)
			.set({ status: 'released', releasedAt: now, updatedAt: now })
			.where(
				and(
					eq(giftReservations.id, input.reservationId),
					eq(giftReservations.reserverId, ctx.user.id),
					eq(giftReservations.status, 'reserved')
				)
			)
			.run();
		if (result.changes === 0) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Only your active, unpurchased reservation can be released.'
			});
		}
		notifyFamilyMembers(ctx.db);
		notifyOrganizerDashboard();
		return { success: true };
	}),

	markPurchased: participantProcedure.input(reservationIdSchema).mutation(({ ctx, input }) => {
		ensureCoordinationIsOpen(ctx.db, ctx.user.id);
		const now = new Date();
		const result = ctx.db
			.update(giftReservations)
			.set({ status: 'purchased', purchasedAt: now, updatedAt: now })
			.where(
				and(
					eq(giftReservations.id, input.reservationId),
					eq(giftReservations.reserverId, ctx.user.id),
					eq(giftReservations.status, 'reserved')
				)
			)
			.run();
		if (result.changes === 0) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Only your active reservation can be marked purchased.'
			});
		}
		notifyFamilyMembers(ctx.db);
		notifyOrganizerDashboard();
		return { success: true, purchasedAt: now.toISOString() };
	}),

	adminList: organizerProcedure.query(({ ctx }) => {
		const event = ctx.db
			.select({ revealedAt: events.revealedAt })
			.from(events)
			.where(eq(events.id, SINGLE_EVENT_ID))
			.get();
		const reserver = alias(users, 'reserver');
		return ctx.db
			.select({
				id: giftReservations.id,
				status: giftReservations.status,
				reservedAt: giftReservations.reservedAt,
				purchasedAt: giftReservations.purchasedAt,
				suggestionId: giftSuggestions.id,
				title: giftSuggestions.title,
				ownerDisplayName: users.displayName,
				reserverCodename: participantCodenames.codename,
				reserverDisplayName: reserver.displayName
			})
			.from(giftReservations)
			.innerJoin(giftSuggestions, eq(giftSuggestions.id, giftReservations.giftSuggestionId))
			.innerJoin(users, eq(users.id, giftSuggestions.ownerId))
			.leftJoin(
				participantCodenames,
				and(
					eq(participantCodenames.eventId, SINGLE_EVENT_ID),
					eq(participantCodenames.userId, giftReservations.reserverId)
				)
			)
			.innerJoin(reserver, eq(reserver.id, giftReservations.reserverId))
			.where(
				and(
					or(eq(giftReservations.status, 'reserved'), eq(giftReservations.status, 'purchased')),
					ne(giftSuggestions.ownerId, ctx.user.id)
				)
			)
			.orderBy(desc(giftReservations.updatedAt))
			.all()
			.map((reservation) => {
				const {
					reserverCodename,
					reserverDisplayName,
					reservedAt,
					purchasedAt,
					...visibleReservation
				} = reservation;
				const reserverLabel = event?.revealedAt ? reserverDisplayName : reserverCodename;
				if (!reserverLabel || !reserverCodename) {
					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: 'A reservation is missing its participant label or codename.'
					});
				}
				return {
					...visibleReservation,
					reserverLabel,
					reserverCodename,
					reservedAt: reservedAt.toISOString(),
					purchasedAt: purchasedAt?.toISOString() ?? null
				};
			});
	}),

	adminSetStatus: organizerProcedure
		.input(
			z.object({
				reservationId: z.string().uuid(),
				status: z.enum(['released', 'purchased']),
				reason: z.string().trim().min(3).max(500)
			})
		)
		.mutation(({ ctx, input }) => {
			const current = ctx.db
				.select({
					id: giftReservations.id,
					status: giftReservations.status,
					reserverId: giftReservations.reserverId,
					ownerId: giftSuggestions.ownerId
				})
				.from(giftReservations)
				.innerJoin(giftSuggestions, eq(giftSuggestions.id, giftReservations.giftSuggestionId))
				.where(eq(giftReservations.id, input.reservationId))
				.get();
			if (!current || current.status === 'released') {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Active reservation not found.' });
			}
			if (current.ownerId === ctx.user.id) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message:
						'An organizer cannot inspect or change the reservation status of their own wishlist.'
				});
			}
			if (current.status === input.status) return { success: true };

			const now = new Date();
			ctx.db.transaction((transaction) => {
				const result = transaction
					.update(giftReservations)
					.set({
						status: input.status,
						releasedAt: input.status === 'released' ? now : null,
						purchasedAt: input.status === 'purchased' ? now : null,
						updatedAt: now
					})
					.where(
						and(
							eq(giftReservations.id, input.reservationId),
							eq(giftReservations.status, current.status)
						)
					)
					.run();
				if (result.changes === 0) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'The reservation changed before this correction could be applied.'
					});
				}
				transaction
					.insert(giftReservationAuditLog)
					.values({
						id: randomUUID(),
						reservationId: input.reservationId,
						actorId: ctx.user.id,
						fromStatus: current.status,
						toStatus: input.status,
						reason: input.reason,
						createdAt: now
					})
					.run();
			});

			notifyFamilyMembers(ctx.db);
			notifyOrganizerDashboard();
			return { success: true };
		})
});
