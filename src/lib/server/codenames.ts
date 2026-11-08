import { randomInt, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { suggestedCodenames } from '#lib/models/codenames.js';
import type { AppDatabase } from '#lib/server/db/connection.js';
import { participantCodenames } from '#lib/server/db/schema.js';

export { suggestedCodenames } from '#lib/models/codenames.js';

type DatabaseExecutor = Pick<AppDatabase, 'select' | 'insert' | 'update'>;

const codenamePool = [
	...suggestedCodenames,
	...suggestedCodenames.flatMap((first, firstIndex) =>
		suggestedCodenames
			.filter((_, secondIndex) => secondIndex !== firstIndex)
			.map((second) => `${first} ${second}`)
	)
];

export function generateCodenames(
	userIds: readonly string[],
	alreadyUsed: readonly string[],
	randomIndex: (max: number) => number = randomInt
): { userId: string; codename: string }[] {
	const uniqueUserIds = [...new Set(userIds)];
	const usedNames = new Set(alreadyUsed.map((name) => name.toLocaleLowerCase('en')));
	const availableNames: string[] = suggestedCodenames.filter(
		(name) => !usedNames.has(name.toLocaleLowerCase('en'))
	);
	if (availableNames.length < uniqueUserIds.length) {
		availableNames.push(
			...codenamePool
				.slice(suggestedCodenames.length)
				.filter((name) => !usedNames.has(name.toLocaleLowerCase('en')))
		);
	}
	let extensionIndex = 0;
	while (availableNames.length < uniqueUserIds.length) {
		const base = suggestedCodenames[extensionIndex % suggestedCodenames.length];
		if (!base) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'A unique codename could not be generated for every participant.'
			});
		}
		const suffix = Math.floor(extensionIndex / suggestedCodenames.length) + 2;
		const candidate = `${base} ${suffix}`;
		extensionIndex += 1;
		if (!usedNames.has(candidate.toLocaleLowerCase('en'))) {
			availableNames.push(candidate);
		}
	}

	for (let index = availableNames.length - 1; index > 0; index -= 1) {
		const swapIndex = randomIndex(index + 1);
		[availableNames[index], availableNames[swapIndex]] = [
			availableNames[swapIndex],
			availableNames[index]
		];
	}

	return uniqueUserIds.map((userId, index) => {
		const codename = availableNames[index];
		if (!codename) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'A unique codename could not be generated for every participant.'
			});
		}
		return { userId, codename };
	});
}

export function assignMissingCodenames(
	database: DatabaseExecutor,
	userIds: readonly string[]
): void {
	const existing = database
		.select({ userId: participantCodenames.userId, codename: participantCodenames.codename })
		.from(participantCodenames)
		.where(eq(participantCodenames.eventId, SINGLE_EVENT_ID))
		.all();
	const assignedUsers = new Set(existing.map(({ userId }) => userId));
	const missingUserIds = [...new Set(userIds)].filter((userId) => !assignedUsers.has(userId));
	if (missingUserIds.length === 0) return;

	const generated = generateCodenames(
		missingUserIds,
		existing.map(({ codename }) => codename)
	);
	const now = new Date();
	database
		.insert(participantCodenames)
		.values(
			generated.map(({ userId, codename }) => ({
				id: randomUUID(),
				eventId: SINGLE_EVENT_ID,
				userId,
				codename,
				createdAt: now,
				updatedAt: now
			}))
		)
		.run();
}

export function getParticipantCodename(database: AppDatabase, userId: string) {
	return database
		.select({
			codename: participantCodenames.codename,
			createdAt: participantCodenames.createdAt,
			updatedAt: participantCodenames.updatedAt
		})
		.from(participantCodenames)
		.where(
			and(
				eq(participantCodenames.eventId, SINGLE_EVENT_ID),
				eq(participantCodenames.userId, userId)
			)
		)
		.get();
}

export function getAvailableCodenames(database: AppDatabase, userId: string): string[] {
	const selectedCodenames = database
		.select({ userId: participantCodenames.userId, codename: participantCodenames.codename })
		.from(participantCodenames)
		.where(eq(participantCodenames.eventId, SINGLE_EVENT_ID))
		.all();
	const currentCodename = selectedCodenames.find(
		(selection) => selection.userId === userId
	)?.codename;
	if (!currentCodename) return [];

	const takenByOthers = new Set(
		selectedCodenames
			.filter((selection) => selection.userId !== userId)
			.map((selection) => selection.codename.toLocaleLowerCase('en'))
	);
	const current = currentCodename.toLocaleLowerCase('en');

	return suggestedCodenames.filter((codename) => {
		const normalized = codename.toLocaleLowerCase('en');
		return normalized !== current && !takenByOthers.has(normalized);
	});
}

export function assignCodename(
	database: Pick<AppDatabase, 'select' | 'update'>,
	userId: string,
	codename: string
): void {
	const existingNames = database
		.select({ userId: participantCodenames.userId, codename: participantCodenames.codename })
		.from(participantCodenames)
		.where(eq(participantCodenames.eventId, SINGLE_EVENT_ID))
		.all();
	if (
		existingNames.some(
			(row) =>
				row.userId !== userId &&
				row.codename.toLocaleLowerCase('en') === codename.toLocaleLowerCase('en')
		)
	) {
		throw new TRPCError({ code: 'CONFLICT', message: 'That codename is already in use.' });
	}

	const existing = existingNames.find((row) => row.userId === userId);
	if (!existing) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'The participant does not have a codename to update.'
		});
	}

	database
		.update(participantCodenames)
		.set({ codename, updatedAt: new Date() })
		.where(
			and(
				eq(participantCodenames.eventId, SINGLE_EVENT_ID),
				eq(participantCodenames.userId, userId)
			)
		)
		.run();
}
