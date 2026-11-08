import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AuthenticatedUser } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { TRPCContext } from '#lib/server/trpc/context.js';
import { createDatabase } from '#lib/server/db/connection.js';
import { assignments, events, users } from '#lib/server/db/schema.js';
import type { SessionCookieStore } from '#lib/server/auth/session.js';
import { appRouter } from '#lib/server/trpc/router.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];

function createContext(user: AuthenticatedUser): TRPCContext {
	const request = new Request('http://localhost/api/trpc/event.save', {
		method: 'POST',
		headers: { origin: 'http://localhost' }
	});
	const cookies: SessionCookieStore = {
		get: () => undefined,
		set: () => undefined,
		delete: () => undefined
	};

	return {
		db,
		user,
		event: {
			request,
			url: new URL(request.url),
			getClientAddress: () => '192.0.2.90',
			cookies
		}
	};
}

const organizer: AuthenticatedUser = {
	id: 'organizer-id',
	username: 'organizer',
	displayName: 'Organizer',
	role: 'organizer',
	isParticipating: false
};

const participant: AuthenticatedUser = {
	id: 'participant-id',
	username: 'participant',
	displayName: 'Participant',
	role: 'participant',
	isParticipating: true
};

beforeEach(() => {
	const database = createDatabase(':memory:');
	client = database.client;
	db = database.db;
	migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
});

afterEach(() => {
	client?.close();
	client = undefined;
});

describe('event router', () => {
	it('allows organizers to save one event with exact CAD cents', async () => {
		const caller = appRouter.createCaller(createContext(organizer));
		const input = {
			name: 'Family Gift Exchange',
			description: 'A small family tradition.',
			exchangeDate: '2026-12-24',
			giftBudget: '75.10',
			instructions: 'Wrap gifts before dinner.',
			status: 'open' as const
		};

		const first = await caller.event.save(input);
		const second = await caller.event.save({ ...input, giftBudget: '80' });

		expect(first).toMatchObject({
			id: 'main',
			name: 'Family Gift Exchange',
			giftBudgetCents: 7510,
			currency: 'CAD',
			status: 'open'
		});
		expect(second.giftBudgetCents).toBe(8000);
		expect(db.select().from(events).all()).toHaveLength(1);
	});

	it('allows participants to view the event but not change it', async () => {
		const organizerCaller = appRouter.createCaller(createContext(organizer));
		await organizerCaller.event.save({
			name: 'Family Gift Exchange',
			exchangeDate: '2026-12-24',
			giftBudget: '50.00',
			status: 'setup'
		});

		const participantCaller = appRouter.createCaller(createContext(participant));
		await expect(participantCaller.event.current()).resolves.toMatchObject({
			name: 'Family Gift Exchange',
			currency: 'CAD'
		});
		await expect(
			participantCaller.event.save({
				name: 'Changed by participant',
				exchangeDate: '2026-12-24',
				giftBudget: '50.00',
				status: 'open'
			})
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('rejects invalid exchange dates and malformed budget amounts', async () => {
		const caller = appRouter.createCaller(createContext(organizer));

		await expect(
			caller.event.save({
				name: 'Invalid date',
				exchangeDate: '2026-02-31',
				giftBudget: '50.00',
				status: 'setup'
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });

		await expect(
			caller.event.save({
				name: 'Invalid budget',
				exchangeDate: '2026-12-24',
				giftBudget: '50.999',
				status: 'setup'
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('completes an event only after every assignment is finalized', async () => {
		db.insert(events)
			.values({
				id: SINGLE_EVENT_ID,
				name: 'Family Gift Exchange',
				exchangeDate: '2026-12-24',
				giftBudgetCents: 5000,
				status: 'assignments_generated'
			})
			.run();
		db.insert(users)
			.values(
				['alice', 'bob'].map((id) => ({
					id,
					username: id,
					displayName: id,
					passwordHash: 'not-used-by-event-test',
					role: 'participant' as const,
					isParticipating: true
				}))
			)
			.run();
		db.insert(assignments)
			.values([
				{
					id: 'alice-assignment',
					eventId: SINGLE_EVENT_ID,
					giverId: 'alice',
					receiverId: 'bob'
				},
				{
					id: 'bob-assignment',
					eventId: SINGLE_EVENT_ID,
					giverId: 'bob',
					receiverId: 'alice'
				}
			])
			.run();
		const caller = appRouter.createCaller(createContext(organizer));

		await expect(caller.event.complete({ confirm: true })).rejects.toMatchObject({
			code: 'PRECONDITION_FAILED'
		});
		db.update(assignments).set({ finalizedAt: new Date() }).run();
		await expect(caller.event.complete({ confirm: true })).resolves.toEqual({ completed: true });
		await expect(caller.event.complete({ confirm: true })).resolves.toEqual({ completed: true });
		expect(db.select().from(events).all()[0]?.status).toBe('completed');
	});
});
