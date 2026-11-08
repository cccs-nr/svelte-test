import { TRPCError } from '@trpc/server';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { passwordSchema, registrationSchema, usernameSchema } from '#lib/auth.js';
import { changePasswordInputSchema, updateProfileInputSchema } from '#lib/models/participants.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { loginRateLimiter, registrationRateLimiter } from '#lib/server/auth/login-rate-limiter.js';
import { createUserSession, deleteUserSession } from '#lib/server/auth/session.js';
import { hashPassword, verifyPassword } from '#lib/server/auth/password.js';
import { assignments, sessions, users } from '#lib/server/db/schema.js';
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
			role: user.role,
			isParticipating: user.role === 'participant' || user.isParticipating
		};
	}),
	register: publicProcedure.input(registrationSchema).mutation(async ({ ctx, input }) => {
		if (ctx.user) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Sign out before creating another account.'
			});
		}

		const assignmentSetExists = ctx.db
			.select({ id: assignments.id })
			.from(assignments)
			.where(eq(assignments.eventId, SINGLE_EVENT_ID))
			.get();
		if (assignmentSetExists) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'Registration is paused while assignments exist. Ask the organizer to reset them.'
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
				isParticipating: true,
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
			role: 'participant' as const,
			isParticipating: true
		};
	}),
	logout: publicProcedure.mutation(({ ctx }) => {
		deleteUserSession(ctx.db, ctx.event.cookies);
		return { success: true };
	}),
	me: protectedProcedure.query(({ ctx }) => ctx.user),
	updateProfile: protectedProcedure.input(updateProfileInputSchema).mutation(({ ctx, input }) =>
		ctx.db.transaction((transaction) => {
			const current = transaction
				.select({ role: users.role, isParticipating: users.isParticipating })
				.from(users)
				.where(eq(users.id, ctx.user.id))
				.get();
			if (!current) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found.' });
			}

			if (
				current.role === 'participant' &&
				input.isParticipating !== undefined &&
				!input.isParticipating
			) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Participant accounts are always included in the exchange.'
				});
			}

			const isParticipating =
				current.role === 'participant' ? true : (input.isParticipating ?? current.isParticipating);
			if (isParticipating !== current.isParticipating) {
				const assignmentsExist = transaction
					.select({ id: assignments.id })
					.from(assignments)
					.where(eq(assignments.eventId, SINGLE_EVENT_ID))
					.get();
				if (assignmentsExist) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'Reset assignments before changing your participation setting.'
					});
				}
			}

			transaction
				.update(users)
				.set({ displayName: input.displayName, isParticipating, updatedAt: new Date() })
				.where(eq(users.id, ctx.user.id))
				.run();

			return { ...ctx.user, displayName: input.displayName, isParticipating };
		})
	),
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
