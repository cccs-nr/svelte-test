import { z } from 'zod';
import { displayNameSchema, passwordSchema, userRoleSchema, usernameSchema } from '#lib/auth.js';

export const householdNameSchema = z.string().trim().min(1).max(80);

const householdIdSchema = z.string().min(1).nullable();
const accountIdSchema = z.string().min(1);

export const createAccountInputSchema = z.object({
	displayName: displayNameSchema,
	password: passwordSchema,
	role: userRoleSchema,
	householdId: householdIdSchema.default(null)
});

export const updateAccountInputSchema = z.object({
	id: accountIdSchema,
	displayName: displayNameSchema,
	username: usernameSchema.optional(),
	role: userRoleSchema,
	isActive: z.boolean(),
	householdId: householdIdSchema
});

export const resetPasswordInputSchema = z.object({
	id: accountIdSchema,
	password: passwordSchema
});

export const updateProfileInputSchema = z.object({
	displayName: displayNameSchema,
	isParticipating: z.boolean().optional()
});

export const changePasswordInputSchema = z.object({
	currentPassword: passwordSchema,
	newPassword: passwordSchema
});
