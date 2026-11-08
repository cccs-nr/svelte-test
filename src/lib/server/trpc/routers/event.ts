import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { eventSettingsInputSchema, SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { events } from '#lib/server/db/schema.js';
import { organizerProcedure, protectedProcedure, router } from '#lib/server/trpc/init.js';

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

		return event;
	})
});
