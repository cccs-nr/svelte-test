import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { displayNameSchema, isExchangeParticipant } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { clearActingAsCookie, setActingAsCookie } from '#lib/server/auth/session.js';
import { assertDisplayNameAvailable } from '#lib/server/auth/display-name.js';
import { createUniqueUsername } from '#lib/server/auth/username.js';
import { assignments, households, users } from '#lib/server/db/schema.js';
import { getParticipantBadgeCounts } from '#lib/server/notification-counts.js';
import { notifyOrganizerDashboard } from '#lib/server/realtime.js';
import { deleteUserAccounts } from '#lib/server/user-deletion.js';
import { getAccountUser, protectedProcedure, router } from '#lib/server/trpc/init.js';

export const MAX_MANAGED_MEMBERS = 5;

// Not a valid scrypt hash, so a managed participant can never sign in directly.
const UNUSABLE_PASSWORD_HASH = '!managed-by-household-account';

function requireParticipantAccount(ctx: Parameters<typeof getAccountUser>[0]) {
	const account = getAccountUser(ctx);
	if (!isExchangeParticipant(account)) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Only participant accounts can manage household members.'
		});
	}
	return account;
}

function assertNoAssignments(database: AppDatabase): void {
	const exists = database
		.select({ id: assignments.id })
		.from(assignments)
		.where(eq(assignments.eventId, SINGLE_EVENT_ID))
		.get();
	if (exists) {
		throw new TRPCError({
			code: 'CONFLICT',
			message:
				'The draw has already been made. Ask the organizer to reset it before changing people.'
		});
	}
}

function ensureHousehold(
	database: Pick<AppDatabase, 'select' | 'insert' | 'update'>,
	accountId: string,
	accountName: string
): string {
	const account = database
		.select({ householdId: users.householdId })
		.from(users)
		.where(eq(users.id, accountId))
		.get();
	if (account?.householdId) return account.householdId;

	const baseName = `${accountName}'s household`.slice(0, 80);
	let name = baseName;
	for (let suffix = 2; ; suffix += 1) {
		const clash = database
			.select({ id: households.id })
			.from(households)
			.where(sql`lower(${households.name}) = lower(${name})`)
			.get();
		if (!clash) break;
		name = `${baseName.slice(0, 74)} ${suffix}`;
	}

	const id = randomUUID();
	database.insert(households).values({ id, name }).run();
	database.update(users).set({ householdId: id }).where(eq(users.id, accountId)).run();
	return id;
}

function listMembers(database: AppDatabase, accountId: string) {
	return database
		.select({ id: users.id, displayName: users.displayName })
		.from(users)
		.where(and(eq(users.managedByUserId, accountId), eq(users.isActive, true)))
		.orderBy(asc(users.createdAt), asc(users.id))
		.all();
}

export const membersRouter = router({
	list: protectedProcedure.query(({ ctx }) => {
		const account = getAccountUser(ctx);
		if (!isExchangeParticipant(account)) return { activeId: ctx.user.id, members: [] };

		const managed = listMembers(ctx.db, account.id);
		const people = [{ id: account.id, displayName: account.displayName }, ...managed];
		return {
			activeId: ctx.user.id,
			members: people.map((person) => ({
				...person,
				isAccountOwner: person.id === account.id,
				unreadMessages: getParticipantBadgeCounts(ctx.db, person.id).messages
			}))
		};
	}),

	add: protectedProcedure
		.input(z.object({ displayName: displayNameSchema }))
		.mutation(({ ctx, input }) => {
			const account = requireParticipantAccount(ctx);
			const created = ctx.db.transaction((tx) => {
				assertNoAssignments(ctx.db);
				const existing =
					tx
						.select({ value: count() })
						.from(users)
						.where(eq(users.managedByUserId, account.id))
						.get()?.value ?? 0;
				if (existing >= MAX_MANAGED_MEMBERS) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message: `You can add up to ${MAX_MANAGED_MEMBERS} people to your household.`
					});
				}

				assertDisplayNameAvailable(tx, input.displayName);
				const householdId = ensureHousehold(tx, account.id, account.displayName);
				const id = randomUUID();
				tx.insert(users)
					.values({
						id,
						username: createUniqueUsername(tx as unknown as AppDatabase, input.displayName),
						displayName: input.displayName,
						passwordHash: UNUSABLE_PASSWORD_HASH,
						role: 'participant',
						isParticipating: true,
						isActive: true,
						householdId,
						managedByUserId: account.id
					})
					.run();
				return { id, displayName: input.displayName };
			});

			notifyOrganizerDashboard();
			return created;
		}),

	remove: protectedProcedure
		.input(z.object({ userId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const account = requireParticipantAccount(ctx);
			assertNoAssignments(ctx.db);
			const member = ctx.db
				.select({ id: users.id })
				.from(users)
				.where(and(eq(users.id, input.userId), eq(users.managedByUserId, account.id)))
				.get();
			if (!member) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'That person was not found.' });
			}

			await deleteUserAccounts(ctx.db, [member.id]);
			if (ctx.user.id === member.id) clearActingAsCookie(ctx.event.cookies);
			notifyOrganizerDashboard();
			return { success: true };
		}),

	switchTo: protectedProcedure
		.input(z.object({ userId: z.string().min(1) }))
		.mutation(({ ctx, input }) => {
			const account = requireParticipantAccount(ctx);
			if (input.userId === account.id) {
				clearActingAsCookie(ctx.event.cookies);
				return { activeId: account.id };
			}

			const member = ctx.db
				.select({ id: users.id })
				.from(users)
				.where(
					and(
						eq(users.id, input.userId),
						eq(users.managedByUserId, account.id),
						eq(users.isActive, true)
					)
				)
				.get();
			if (!member) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'That person was not found.' });
			}

			setActingAsCookie(ctx.event.cookies, member.id);
			return { activeId: member.id };
		})
});
