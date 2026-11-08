import { initTRPC, TRPCError } from '@trpc/server';
import { isExchangeParticipant, type AuthenticatedUser } from '#lib/auth.js';
import type { TRPCContext } from './context.js';

const t = initTRPC.context<TRPCContext>().create();

function assertSameOrigin(ctx: TRPCContext): void {
	const requestOrigin = ctx.event.request.headers.get('origin');

	if (!requestOrigin) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'A same-origin request is required.' });
	}

	let origin: URL;

	try {
		origin = new URL(requestOrigin);
	} catch {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid request origin.' });
	}

	if (origin.origin !== ctx.event.url.origin) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Cross-origin requests are not allowed.' });
	}
}

export function requireAuthenticatedUser(user: AuthenticatedUser | null): AuthenticatedUser {
	if (!user) {
		throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication is required.' });
	}

	return user;
}

export function requireOrganizer(user: AuthenticatedUser | null): AuthenticatedUser {
	const authenticatedUser = requireAuthenticatedUser(user);

	if (authenticatedUser.role !== 'organizer') {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Organizer access is required.' });
	}

	return authenticatedUser;
}

const sameOriginMiddleware = t.middleware(({ ctx, next, type }) => {
	if (type === 'mutation') assertSameOrigin(ctx);
	return next();
});

export const router = t.router;
export const publicProcedure = t.procedure.use(sameOriginMiddleware);
export const protectedProcedure = publicProcedure.use(({ ctx, next }) =>
	next({ ctx: { ...ctx, user: requireAuthenticatedUser(ctx.user) } })
);
export const organizerProcedure = protectedProcedure.use(({ ctx, next }) => {
	requireOrganizer(ctx.user);
	return next();
});
export const participantProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (!isExchangeParticipant(ctx.user)) {
		throw new TRPCError({ code: 'FORBIDDEN', message: 'Participant access is required.' });
	}

	return next();
});
