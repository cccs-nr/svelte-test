import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { householdNameSchema } from '#lib/models/participants.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { assignments, households, users } from '#lib/server/db/schema.js';
import { notifyOrganizerDashboard } from '#lib/server/realtime.js';
import { organizerProcedure, router } from '#lib/server/trpc/init.js';
import { z } from 'zod';

const householdIdSchema = z.string().min(1);
const householdNameInput = z.object({ name: householdNameSchema });
const memberIdsSchema = z
	.array(z.string().min(1))
	.max(500)
	.refine((ids) => new Set(ids).size === ids.length, 'A participant can only be selected once.');

function assertHouseholdNameAvailable(
	database: AppDatabase,
	name: string,
	exceptId?: string
): void {
	const matchingHousehold = database
		.select({ id: households.id })
		.from(households)
		.where(
			exceptId
				? and(sql`lower(${households.name}) = lower(${name})`, ne(households.id, exceptId))
				: sql`lower(${households.name}) = lower(${name})`
		)
		.get();

	if (matchingHousehold) {
		throw new TRPCError({
			code: 'CONFLICT',
			message: 'A household with that name already exists.'
		});
	}
}

export const householdRouter = router({
	list: organizerProcedure.query(({ ctx }) => {
		const householdRows = ctx.db.select().from(households).orderBy(asc(households.name)).all();
		const memberRows = ctx.db
			.select({
				id: users.id,
				displayName: users.displayName,
				householdId: users.householdId
			})
			.from(users)
			.where(sql`${users.householdId} is not null`)
			.orderBy(asc(users.displayName), asc(users.id))
			.all();
		const membersByHousehold = new Map<string, { id: string; displayName: string }[]>();
		for (const { id, displayName, householdId } of memberRows) {
			if (!householdId) continue;
			const members = membersByHousehold.get(householdId) ?? [];
			members.push({ id, displayName });
			membersByHousehold.set(householdId, members);
		}

		return householdRows.map((household) => ({
			id: household.id,
			name: household.name,
			members: membersByHousehold.get(household.id) ?? [],
			memberCount: membersByHousehold.get(household.id)?.length ?? 0
		}));
	}),
	create: organizerProcedure
		.input(householdNameInput.extend({ participantIds: memberIdsSchema.default([]) }))
		.mutation(({ ctx, input }) => {
			assertHouseholdNameAvailable(ctx.db, input.name);
			const selectedMembers = input.participantIds.length
				? ctx.db
						.select({ id: users.id })
						.from(users)
						.where(inArray(users.id, input.participantIds))
						.all()
				: [];
			if (selectedMembers.length !== input.participantIds.length) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: 'Select existing accounts only.' });
			}
			const assignmentSetExists = ctx.db
				.select({ id: assignments.id })
				.from(assignments)
				.where(eq(assignments.eventId, SINGLE_EVENT_ID))
				.get();
			if (assignmentSetExists && input.participantIds.length > 0) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'Reset assignments before changing household membership.'
				});
			}

			const household = { id: randomUUID(), name: input.name };
			ctx.db.transaction((transaction) => {
				transaction.insert(households).values(household).run();
				if (input.participantIds.length > 0) {
					transaction
						.update(users)
						.set({ householdId: household.id, updatedAt: new Date() })
						.where(inArray(users.id, input.participantIds))
						.run();
				}
			});
			const members = ctx.db
				.select({ id: users.id, displayName: users.displayName })
				.from(users)
				.where(eq(users.householdId, household.id))
				.orderBy(asc(users.displayName), asc(users.id))
				.all();
			notifyOrganizerDashboard();
			return { ...household, members, memberCount: members.length };
		}),
	update: organizerProcedure
		.input(
			z.object({
				id: householdIdSchema,
				name: householdNameSchema,
				participantIds: memberIdsSchema.optional()
			})
		)
		.mutation(({ ctx, input }) => {
			const existing = ctx.db
				.select({ id: households.id })
				.from(households)
				.where(eq(households.id, input.id))
				.get();
			if (!existing) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found.' });
			}

			assertHouseholdNameAvailable(ctx.db, input.name, input.id);
			const assignmentSetExists = ctx.db
				.select({ id: assignments.id })
				.from(assignments)
				.where(eq(assignments.eventId, SINGLE_EVENT_ID))
				.get();
			let members: { id: string; displayName: string }[];

			const participantIds = input.participantIds;
			if (participantIds !== undefined) {
				const selectedMembers = participantIds.length
					? ctx.db
							.select({ id: users.id, householdId: users.householdId })
							.from(users)
							.where(inArray(users.id, participantIds))
							.all()
					: [];
				if (selectedMembers.length !== participantIds.length) {
					throw new TRPCError({ code: 'BAD_REQUEST', message: 'Select existing accounts only.' });
				}
				const existingMemberIds = ctx.db
					.select({ id: users.id })
					.from(users)
					.where(eq(users.householdId, input.id))
					.all()
					.map((user) => user.id);
				const selectedIds = new Set(participantIds);
				const membershipChanged =
					existingMemberIds.length !== selectedIds.size ||
					existingMemberIds.some((id) => !selectedIds.has(id)) ||
					selectedMembers.some((member) => member.householdId !== input.id);
				if (assignmentSetExists && membershipChanged) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'Reset assignments before changing household membership.'
					});
				}

				ctx.db.transaction((transaction) => {
					transaction
						.update(households)
						.set({ name: input.name, updatedAt: new Date() })
						.where(eq(households.id, input.id))
						.run();
					if (participantIds.length === 0) {
						transaction
							.update(users)
							.set({ householdId: null, updatedAt: new Date() })
							.where(eq(users.householdId, input.id))
							.run();
					} else {
						transaction
							.update(users)
							.set({ householdId: null, updatedAt: new Date() })
							.where(and(eq(users.householdId, input.id), notInArray(users.id, participantIds)))
							.run();
						transaction
							.update(users)
							.set({ householdId: input.id, updatedAt: new Date() })
							.where(inArray(users.id, participantIds))
							.run();
					}
				});
				members = ctx.db
					.select({ id: users.id, displayName: users.displayName })
					.from(users)
					.where(eq(users.householdId, input.id))
					.orderBy(asc(users.displayName), asc(users.id))
					.all();
			} else {
				ctx.db
					.update(households)
					.set({ name: input.name, updatedAt: new Date() })
					.where(eq(households.id, input.id))
					.run();
				members = ctx.db
					.select({ id: users.id, displayName: users.displayName })
					.from(users)
					.where(eq(users.householdId, input.id))
					.orderBy(asc(users.displayName), asc(users.id))
					.all();
			}

			notifyOrganizerDashboard();
			return { id: input.id, name: input.name, members, memberCount: members.length };
		}),
	remove: organizerProcedure.input(householdIdSchema).mutation(({ ctx, input: id }) => {
		const assignmentSetExists = ctx.db
			.select({ id: assignments.id })
			.from(assignments)
			.where(eq(assignments.eventId, SINGLE_EVENT_ID))
			.get();
		const householdHasMembers = ctx.db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.householdId, id))
			.get();

		if (assignmentSetExists && householdHasMembers) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Reset assignments before deleting a household with participants.'
			});
		}

		const result = ctx.db.delete(households).where(eq(households.id, id)).run();
		if (result.changes === 0) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found.' });
		}

		notifyOrganizerDashboard();
		return { success: true };
	})
});
