import { afterEach, describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '#lib/auth.js';
import { createDatabase } from '#lib/server/db/connection.js';
import type { TRPCContext } from './context.js';
import { organizerProcedure, protectedProcedure, router } from './init.js';

const accessRouter = router({
	protected: protectedProcedure.query(({ ctx }) => ctx.user.id),
	organizer: organizerProcedure.query(({ ctx }) => ctx.user.id)
});

let closeDatabase: (() => void) | undefined;

function createContext(user: AuthenticatedUser | null): TRPCContext {
	const { client, db } = createDatabase(':memory:');
	closeDatabase = () => client.close();

	const request = new Request('http://localhost/api/trpc/access.protected');

	return {
		db,
		user,
		event: {
			request,
			url: new URL(request.url),
			getClientAddress: () => '127.0.0.1',
			cookies: {
				get: () => undefined,
				set: () => undefined,
				delete: () => undefined
			}
		}
	};
}

afterEach(() => {
	closeDatabase?.();
	closeDatabase = undefined;
});

describe('tRPC access procedures', () => {
	it('requires authentication for protected procedures', async () => {
		const caller = accessRouter.createCaller(createContext(null));

		await expect(caller.protected()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('allows participants to use protected procedures but not organizer procedures', async () => {
		const caller = accessRouter.createCaller(
			createContext({
				id: 'participant-id',
				username: 'participant',
				displayName: 'Participant',
				role: 'participant'
			})
		);

		await expect(caller.protected()).resolves.toBe('participant-id');
		await expect(caller.organizer()).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('allows organizers to use organizer procedures', async () => {
		const caller = accessRouter.createCaller(
			createContext({
				id: 'organizer-id',
				username: 'organizer',
				displayName: 'Organizer',
				role: 'organizer'
			})
		);

		await expect(caller.organizer()).resolves.toBe('organizer-id');
	});
});
