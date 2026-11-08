import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { passwordSchema, usernameSchema } from '#lib/auth.js';
import { loginRateLimiter } from '#lib/server/auth/login-rate-limiter.js';
import { deleteUserSession, createUserSession } from '#lib/server/auth/session.js';
import { verifyPassword } from '#lib/server/auth/password.js';
import { users } from '#lib/server/db/schema.js';
import { protectedProcedure, publicProcedure, router } from '#lib/server/trpc/init.js';

const loginInput = z.object({
	username: usernameSchema,
	password: passwordSchema
});

export const authRouter = router({
	login: publicProcedure.input(loginInput).mutation(async ({ ctx, input }) => {
		const rateLimitKey = `${ctx.event.getClientAddress()}\u0000${input.username}`;

		if (!loginRateLimiter.allow(rateLimitKey)) {
			throw new TRPCError({
				code: 'TOO_MANY_REQUESTS',
				message: 'Too many sign-in attempts. Try again later.'
			});
		}

		const user = ctx.db.select().from(users).where(eq(users.username, input.username)).get();
		const passwordIsValid =
			user?.isActive && (await verifyPassword(input.password, user.passwordHash));

		if (!user || !passwordIsValid) {
			throw new TRPCError({
				code: 'UNAUTHORIZED',
				message: 'The username or password is not correct.'
			});
		}

		loginRateLimiter.reset(rateLimitKey);
		createUserSession(ctx.db, user.id, ctx.event.cookies);

		return {
			id: user.id,
			username: user.username,
			displayName: user.displayName,
			role: user.role
		};
	}),
	logout: publicProcedure.mutation(({ ctx }) => {
		deleteUserSession(ctx.db, ctx.event.cookies);
		return { success: true };
	}),
	me: protectedProcedure.query(({ ctx }) => ctx.user)
});
