import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { householdNameSchema } from '#lib/models/participants.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { households, users } from '#lib/server/db/schema.js';
import { organizerProcedure, router } from '#lib/server/trpc/init.js';
import { z } from 'zod';

const householdIdSchema = z.string().min(1);
const householdNameInput = z.object({ name: householdNameSchema });

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
		const memberCounts = ctx.db
			.select({ householdId: users.householdId, memberCount: count() })
			.from(users)
			.where(sql`${users.householdId} is not null`)
			.groupBy(users.householdId)
			.all();
		const countByHousehold = new Map(memberCounts.map((row) => [row.householdId, row.memberCount]));

		return householdRows.map((household) => ({
			id: household.id,
			name: household.name,
			memberCount: countByHousehold.get(household.id) ?? 0
		}));
	}),
	create: organizerProcedure.input(householdNameInput).mutation(({ ctx, input }) => {
		assertHouseholdNameAvailable(ctx.db, input.name);

		const household = {
			id: randomUUID(),
			name: input.name
		};
		ctx.db.insert(households).values(household).run();
		return { ...household, memberCount: 0 };
	}),
	update: organizerProcedure
		.input(z.object({ id: householdIdSchema, name: householdNameSchema }))
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
			ctx.db
				.update(households)
				.set({ name: input.name, updatedAt: new Date() })
				.where(eq(households.id, input.id))
				.run();

			const memberCount = ctx.db
				.select({ value: count() })
				.from(users)
				.where(eq(users.householdId, input.id))
				.get()?.value;

			return { id: input.id, name: input.name, memberCount: memberCount ?? 0 };
		}),
	remove: organizerProcedure.input(householdIdSchema).mutation(({ ctx, input: id }) => {
		const result = ctx.db.delete(households).where(eq(households.id, id)).run();
		if (result.changes === 0) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found.' });
		}

		return { success: true };
	})
});
