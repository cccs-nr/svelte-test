import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AuthenticatedUser } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import type { TRPCContext } from '#lib/server/trpc/context.js';
import { createDatabase } from '#lib/server/db/connection.js';
import {
	assignments,
	conversations,
	events,
	households,
	messages,
	users
} from '#lib/server/db/schema.js';
import type { SessionCookieStore } from '#lib/server/auth/session.js';
import { appRouter } from '#lib/server/trpc/router.js';

let client: ReturnType<typeof createDatabase>['client'] | undefined;
let db: ReturnType<typeof createDatabase>['db'];

function createContext(user: AuthenticatedUser): TRPCContext {
	const request = new Request('http://localhost/api/trpc/assignments.status', {
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
			getClientAddress: () => '192.0.2.93',
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

const participants: AuthenticatedUser[] = [
	{
		id: 'alice',
		username: 'alice',
		displayName: 'Alice',
		role: 'participant',
		isParticipating: true
	},
	{ id: 'bob', username: 'bob', displayName: 'Bob', role: 'participant', isParticipating: true },
	{
		id: 'carol',
		username: 'carol',
		displayName: 'Carol',
		role: 'participant',
		isParticipating: true
	},
	{ id: 'dave', username: 'dave', displayName: 'Dave', role: 'participant', isParticipating: true }
];

function seedEventAndParticipants(householdIds: readonly string[]): void {
	db.insert(events)
		.values({
			id: SINGLE_EVENT_ID,
			name: 'Family Exchange',
			exchangeDate: '2026-12-24',
			giftBudgetCents: 5000,
			currency: 'CAD',
			status: 'open'
		})
		.run();

	for (const id of new Set(householdIds.filter(Boolean))) {
		db.insert(households).values({ id, name: id }).run();
	}

	db.insert(users)
		.values(
			participants.map((participant, index) => ({
				...participant,
				passwordHash: 'not-used-by-assignment-test',
				householdId: householdIds[index] || null
			}))
		)
		.run();
}

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

describe('assignment router', () => {
	it('generates a complete draft without exposing the mapping', async () => {
		seedEventAndParticipants(['home-a', 'home-a', 'home-b', 'home-b']);
		db.insert(users)
			.values({
				id: organizer.id,
				username: organizer.username,
				displayName: organizer.displayName,
				passwordHash: 'not-used-by-assignment-test',
				role: 'organizer',
				isParticipating: false
			})
			.run();
		const caller = appRouter.createCaller(createContext(organizer));

		await expect(caller.assignments.generate()).resolves.toEqual({
			assignmentCount: participants.length,
			finalized: false
		});

		const rows = db.select().from(assignments).all();
		expect(rows).toHaveLength(participants.length);
		expect(rows.every((row) => row.finalizedAt === null)).toBe(true);

		const status = await caller.assignments.status();
		expect(status).toMatchObject({
			participantCount: participants.length,
			assignmentCount: participants.length,
			valid: true,
			finalized: false,
			canFinalize: true
		});
		expect(status).not.toHaveProperty('assignments');
	});

	it('reveals only the current participant’s recipient after finalization', async () => {
		seedEventAndParticipants(['home-a', 'home-a', 'home-b', 'home-b']);
		const organizerCaller = appRouter.createCaller(createContext(organizer));
		const participantCaller = appRouter.createCaller(createContext(participants[0]));

		await organizerCaller.assignments.generate();
		await expect(participantCaller.assignments.myRecipient()).resolves.toBeNull();
		await organizerCaller.assignments.finalize();

		const recipient = await participantCaller.assignments.myRecipient();
		expect(recipient).not.toBeNull();
		expect(Object.keys(recipient ?? {})).toEqual(['displayName']);

		const assignment = db
			.select()
			.from(assignments)
			.where(and(eq(assignments.eventId, SINGLE_EVENT_ID), eq(assignments.giverId, 'alice')))
			.get();
		if (!assignment) throw new Error('Expected Alice to have a finalized assignment.');
		const recipientUser = db.select().from(users).where(eq(users.id, assignment.receiverId)).get();
		expect(recipient?.displayName).toBe(recipientUser?.displayName);
		expect(recipientUser?.householdId).not.toBe('home-a');
	});

	it('lets the giver mark a gift purchased and reveals only that status to the recipient', async () => {
		seedEventAndParticipants(['home-a', 'home-a', 'home-b', 'home-b']);
		const organizerCaller = appRouter.createCaller(createContext(organizer));
		const giver = appRouter.createCaller(createContext(participants[0]));

		await organizerCaller.assignments.generate();
		await expect(giver.assignments.setGiftPurchased({ purchased: true })).rejects.toMatchObject({
			code: 'PRECONDITION_FAILED'
		});
		await organizerCaller.assignments.finalize();

		const assignment = db
			.select({ receiverId: assignments.receiverId })
			.from(assignments)
			.where(eq(assignments.giverId, participants[0].id))
			.get();
		if (!assignment) throw new Error('Expected Alice to have a finalized assignment.');

		const recipient = participants.find((participant) => participant.id === assignment.receiverId);
		if (!recipient) throw new Error('Expected the assigned recipient to be a participant.');
		const recipientCaller = appRouter.createCaller(createContext(recipient));
		const otherParticipant = participants.find((participant) => participant.id !== recipient.id);
		if (!otherParticipant) throw new Error('Expected another participant.');
		const otherCaller = appRouter.createCaller(createContext(otherParticipant));

		await expect(giver.assignments.myGiftStatus()).resolves.toEqual({
			purchased: false,
			purchasedAt: null
		});
		await expect(recipientCaller.assignments.myRecipientGiftStatus()).resolves.toEqual({
			purchased: false,
			purchasedAt: null
		});
		await expect(giver.assignments.setGiftPurchased({ purchased: true })).resolves.toMatchObject({
			purchased: true,
			purchasedAt: expect.any(String)
		});

		const recipientStatus = await recipientCaller.assignments.myRecipientGiftStatus();
		expect(recipientStatus.purchased).toBe(true);
		expect(Object.keys(recipientStatus).sort()).toEqual(['purchased', 'purchasedAt']);
		expect(JSON.stringify(recipientStatus)).not.toContain(participants[0].id);
		await expect(otherCaller.assignments.myRecipientGiftStatus()).resolves.toEqual({
			purchased: false,
			purchasedAt: null
		});
		await expect(giver.assignments.setGiftPurchased({ purchased: false })).resolves.toEqual({
			purchased: false,
			purchasedAt: null
		});
	});

	it('includes an opted-in organizer in the draw and reveals only their own recipient', async () => {
		seedEventAndParticipants(['home-a', 'home-a', 'home-b', 'home-b']);
		db.insert(users)
			.values({
				id: organizer.id,
				username: organizer.username,
				displayName: organizer.displayName,
				passwordHash: 'not-used-by-assignment-test',
				role: 'organizer',
				isParticipating: true
			})
			.run();
		const participatingOrganizer = { ...organizer, isParticipating: true };
		const caller = appRouter.createCaller(createContext(participatingOrganizer));
		const organizerControl = appRouter.createCaller(createContext(organizer));

		await expect(organizerControl.assignments.generate()).resolves.toMatchObject({
			assignmentCount: participants.length + 1
		});
		await organizerControl.assignments.finalize();

		const recipient = await caller.assignments.myRecipient();
		expect(recipient).not.toBeNull();
		expect(Object.keys(recipient ?? {})).toEqual(['displayName']);
	});

	it('reports impossible household constraints without creating assignments', async () => {
		seedEventAndParticipants(['home-a', 'home-a', 'home-a', 'home-b']);
		const caller = appRouter.createCaller(createContext(organizer));

		await expect(caller.assignments.generate()).rejects.toMatchObject({
			code: 'PRECONDITION_FAILED'
		});
		await expect(caller.assignments.status()).resolves.toMatchObject({ feasible: false });
		expect(db.select().from(assignments).all()).toHaveLength(0);
	});

	it('blocks draw actions when only some assignments are finalized', async () => {
		seedEventAndParticipants(['home-a', 'home-a', 'home-b', 'home-b']);
		const caller = appRouter.createCaller(createContext(organizer));
		await caller.assignments.generate();
		db.update(assignments)
			.set({ finalizedAt: new Date() })
			.where(eq(assignments.giverId, 'alice'))
			.run();

		await expect(caller.assignments.status()).resolves.toMatchObject({
			finalized: false,
			hasFinalizedAssignments: true,
			canGenerate: false,
			canFinalize: false
		});
	});

	it('requires explicit confirmation to reset finalized assignments', async () => {
		seedEventAndParticipants(['home-a', 'home-a', 'home-b', 'home-b']);
		const caller = appRouter.createCaller(createContext(organizer));
		await caller.assignments.generate();
		await caller.assignments.finalize();
		const aliceAssignment = db
			.select()
			.from(assignments)
			.where(eq(assignments.giverId, 'alice'))
			.get();
		if (!aliceAssignment) throw new Error('Expected Alice to have a finalized assignment.');
		db.insert(conversations)
			.values({ id: 'alice-conversation', assignmentId: aliceAssignment.id })
			.run();
		db.insert(messages)
			.values({
				id: 'alice-message',
				conversationId: 'alice-conversation',
				senderSide: 'giver',
				content: 'A private question.',
				giverReadAt: new Date()
			})
			.run();

		await expect(caller.assignments.reset({ confirm: false })).rejects.toMatchObject({
			code: 'PRECONDITION_FAILED'
		});
		await expect(caller.assignments.reset({ confirm: true })).resolves.toMatchObject({
			success: true,
			removedCount: participants.length,
			wasFinalized: true
		});

		const event = db.select().from(events).where(eq(events.id, SINGLE_EVENT_ID)).get();
		expect(event?.status).toBe('open');
		expect(db.select().from(assignments).all()).toHaveLength(0);
		expect(db.select().from(conversations).all()).toHaveLength(0);
		expect(db.select().from(messages).all()).toHaveLength(0);
	});

	it('prevents account access to organizer-only assignment controls', async () => {
		seedEventAndParticipants(['home-a', 'home-a', 'home-b', 'home-b']);
		const caller = appRouter.createCaller(createContext(participants[0]));

		await expect(caller.assignments.status()).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(caller.assignments.generate()).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});
});
