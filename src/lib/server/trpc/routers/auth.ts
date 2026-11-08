import { TRPCError } from '@trpc/server';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { passwordSchema, registrationSchema, usernameSchema } from '#lib/auth.js';
import { changePasswordInputSchema, updateProfileInputSchema } from '#lib/models/participants.js';
import { loginRateLimiter, registrationRateLimiter } from '#lib/server/auth/login-rate-limiter.js';
import { createUserSession, deleteUserSession } from '#lib/server/auth/session.js';
import { hashPassword, verifyPassword } from '#lib/server/auth/password.js';
import { sessions, users } from '#lib/server/db/schema.js';
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
	register: publicProcedure.input(registrationSchema).mutation(async ({ ctx, input }) => {
		if (ctx.user) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Sign out before creating another account.'
			});
		}

		const address = ctx.event.getClientAddress();
		if (!registrationRateLimiter.allow(address)) {
			throw new TRPCError({
				code: 'TOO_MANY_REQUESTS',
				message: 'Too many accounts were created from this network. Try again later.'
			});
		}

		const id = randomUUID();
		const insertResult = ctx.db
			.insert(users)
			.values({
				id,
				username: input.username,
				displayName: input.displayName,
				passwordHash: await hashPassword(input.password),
				role: 'participant',
				isActive: true
			})
			.onConflictDoNothing({ target: users.username })
			.run();

		if (insertResult.changes === 0) {
			throw new TRPCError({ code: 'CONFLICT', message: 'That username is already taken.' });
		}

		createUserSession(ctx.db, id, ctx.event.cookies);

		return {
			id,
			username: input.username,
			displayName: input.displayName,
			role: 'participant' as const
		};
	}),
	logout: publicProcedure.mutation(({ ctx }) => {
		deleteUserSession(ctx.db, ctx.event.cookies);
		return { success: true };
	}),
	me: protectedProcedure.query(({ ctx }) => ctx.user),
	updateProfile: protectedProcedure.input(updateProfileInputSchema).mutation(({ ctx, input }) => {
		ctx.db
			.update(users)
			.set({ displayName: input.displayName, updatedAt: new Date() })
			.where(eq(users.id, ctx.user.id))
			.run();

		return { ...ctx.user, displayName: input.displayName };
	}),
	changePassword: protectedProcedure
		.input(changePasswordInputSchema)
		.mutation(async ({ ctx, input }) => {
			const user = ctx.db
				.select({ passwordHash: users.passwordHash })
				.from(users)
				.where(and(eq(users.id, ctx.user.id), eq(users.isActive, true)))
				.get();

			if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'The current password is not correct.'
				});
			}

			const passwordHash = await hashPassword(input.newPassword);
			ctx.db.transaction((transaction) => {
				transaction
					.update(users)
					.set({ passwordHash, updatedAt: new Date() })
					.where(eq(users.id, ctx.user.id))
					.run();
				transaction.delete(sessions).where(eq(sessions.userId, ctx.user.id)).run();
			});

			createUserSession(ctx.db, ctx.user.id, ctx.event.cookies);
			return { success: true };
		})
});
