import { randomUUID } from 'node:crypto';
import { and, asc, count, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
	createAccountInputSchema,
	resetPasswordInputSchema,
	updateAccountInputSchema
} from '#lib/models/participants.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { hashPassword } from '#lib/server/auth/password.js';
import { createUniqueUsername } from '#lib/server/auth/username.js';
import { assignments, households, sessions, users } from '#lib/server/db/schema.js';
import { disconnectUserRealtime, notifyOrganizerDashboard } from '#lib/server/realtime.js';
import { collectManagedAccountIds, deleteUserAccounts } from '#lib/server/user-deletion.js';
import { organizerProcedure, router } from '#lib/server/trpc/init.js';

function getAccount(database: AppDatabase, id: string) {
	return database
		.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			role: users.role,
			isParticipating: users.isParticipating,
			isActive: users.isActive,
			householdId: users.householdId,
			householdName: households.name,
			managedByUserId: users.managedByUserId,
			lastLoginAt: users.lastLoginAt
		})
		.from(users)
		.leftJoin(households, eq(users.householdId, households.id))
		.where(eq(users.id, id))
		.get();
}

function assertHouseholdExists(database: AppDatabase, householdId: string | null): void {
	if (!householdId) return;

	const household = database
		.select({ id: households.id })
		.from(households)
		.where(eq(households.id, householdId))
		.get();

	if (!household) {
		throw new TRPCError({ code: 'BAD_REQUEST', message: 'Select an existing household.' });
	}
}

export const participantsRouter = router({
	list: organizerProcedure.query(({ ctx }) =>
		ctx.db
			.select({
				id: users.id,
				username: users.username,
				displayName: users.displayName,
				role: users.role,
				isParticipating: users.isParticipating,
				isActive: users.isActive,
				householdId: users.householdId,
				householdName: households.name,
				managedByUserId: users.managedByUserId,
				lastLoginAt: users.lastLoginAt
			})
			.from(users)
			.leftJoin(households, eq(users.householdId, households.id))
			.orderBy(asc(users.displayName), asc(users.id))
			.all()
	),
	create: organizerProcedure.input(createAccountInputSchema).mutation(async ({ ctx, input }) => {
		const assignmentSetExists = ctx.db
			.select({ id: assignments.id })
			.from(assignments)
			.where(eq(assignments.eventId, SINGLE_EVENT_ID))
			.get();
		if (assignmentSetExists) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Reset assignments before adding participants.'
			});
		}

		assertHouseholdExists(ctx.db, input.householdId);

		const id = randomUUID();
		const passwordHash = await hashPassword(input.password);
		const username = createUniqueUsername(ctx.db, input.displayName);
		const insertResult = ctx.db
			.insert(users)
			.values({
				id,
				username,
				displayName: input.displayName,
				passwordHash,
				role: input.role,
				isParticipating: input.role === 'participant',
				householdId: input.householdId,
				isActive: true
			})
			.onConflictDoNothing({ target: users.username })
			.run();

		if (insertResult.changes === 0) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Unable to create an internal account identifier. Please try again.'
			});
		}

		const account = getAccount(ctx.db, id);
		if (!account) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'The account was created but could not be loaded.'
			});
		}

		notifyOrganizerDashboard();
		return account;
	}),
	update: organizerProcedure.input(updateAccountInputSchema).mutation(({ ctx, input }) => {
		return ctx.db.transaction((transaction) => {
			const current = transaction.select().from(users).where(eq(users.id, input.id)).get();
			if (!current) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found.' });
			}
			const isParticipating =
				input.role === 'participant'
					? true
					: current.role === 'organizer'
						? current.isParticipating
						: false;

			const assignmentSetExists = transaction
				.select({ id: assignments.id })
				.from(assignments)
				.where(eq(assignments.eventId, SINGLE_EVENT_ID))
				.get();
			if (
				assignmentSetExists &&
				(current.role !== input.role ||
					current.isActive !== input.isActive ||
					current.householdId !== input.householdId ||
					current.isParticipating !== isParticipating)
			) {
				throw new TRPCError({
					code: 'CONFLICT',
					message:
						'Reset assignments before changing participant status, role, participation, or household.'
				});
			}

			if (current.id === ctx.user.id && (!input.isActive || input.role !== 'organizer')) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Use another organizer to deactivate or change your own role.'
				});
			}

			if (input.householdId) {
				const household = transaction
					.select({ id: households.id })
					.from(households)
					.where(eq(households.id, input.householdId))
					.get();

				if (!household) {
					throw new TRPCError({ code: 'BAD_REQUEST', message: 'Select an existing household.' });
				}
			}

			if (
				current.isActive &&
				current.role === 'organizer' &&
				(!input.isActive || input.role !== 'organizer')
			) {
				const activeOrganizerCount =
					transaction
						.select({ value: count() })
						.from(users)
						.where(and(eq(users.role, 'organizer'), eq(users.isActive, true)))
						.get()?.value ?? 0;

				if (activeOrganizerCount <= 1) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'The event must have at least one active organizer.'
					});
				}
			}

			const username = input.username ?? current.username;
			if (username !== current.username) {
				const taken = transaction
					.select({ id: users.id })
					.from(users)
					.where(eq(users.username, username))
					.get();
				if (taken) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'That account name is already used by someone else.'
					});
				}
			}

			transaction
				.update(users)
				.set({
					username,
					displayName: input.displayName,
					role: input.role,
					isParticipating,
					isActive: input.isActive,
					householdId: input.householdId,
					updatedAt: new Date()
				})
				.where(eq(users.id, input.id))
				.run();

			if (!input.isActive) {
				transaction.delete(sessions).where(eq(sessions.userId, input.id)).run();
			}
		});

		disconnectUserRealtime(input.id);
		const account = getAccount(ctx.db, input.id);
		if (!account) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'The updated account could not be loaded.'
			});
		}

		notifyOrganizerDashboard();
		return account;
	}),
	delete: organizerProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			if (input.id === ctx.user.id) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'You cannot delete your own account.'
				});
			}

			const target = ctx.db.select().from(users).where(eq(users.id, input.id)).get();
			if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found.' });

			const assignmentSetExists = ctx.db
				.select({ id: assignments.id })
				.from(assignments)
				.where(eq(assignments.eventId, SINGLE_EVENT_ID))
				.get();
			if (assignmentSetExists && target.isParticipating) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'Reset assignments before deleting a participant.'
				});
			}

			if (target.role === 'organizer' && target.isActive) {
				const activeOrganizerCount =
					ctx.db
						.select({ value: count() })
						.from(users)
						.where(and(eq(users.role, 'organizer'), eq(users.isActive, true)))
						.get()?.value ?? 0;
				if (activeOrganizerCount <= 1) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'The event must have at least one active organizer.'
					});
				}
			}

			const accountIds = collectManagedAccountIds(ctx.db, input.id);
			await deleteUserAccounts(ctx.db, accountIds);
			for (const id of accountIds) disconnectUserRealtime(id);
			notifyOrganizerDashboard();
			return { deleted: accountIds.length };
		}),
	resetPassword: organizerProcedure
		.input(resetPasswordInputSchema)
		.mutation(async ({ ctx, input }) => {
			if (input.id === ctx.user.id) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Use your profile to change your own password.'
				});
			}

			const target = ctx.db
				.select({ managedByUserId: users.managedByUserId })
				.from(users)
				.where(eq(users.id, input.id))
				.get();
			if (target?.managedByUserId) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'This person has no password. They are managed from another account.'
				});
			}

			const passwordHash = await hashPassword(input.password);
			ctx.db.transaction((transaction) => {
				const result = transaction
					.update(users)
					.set({ passwordHash, updatedAt: new Date() })
					.where(eq(users.id, input.id))
					.run();

				if (result.changes === 0) {
					throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found.' });
				}

				transaction.delete(sessions).where(eq(sessions.userId, input.id)).run();
			});

			disconnectUserRealtime(input.id);
			return { success: true };
		})
});
