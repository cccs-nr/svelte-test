import { z } from 'zod';

export const userRoleSchema = z.enum(['organizer', 'participant']);

export const usernameSchema = z
	.string()
	.trim()
	.min(3)
	.max(32)
	.regex(/^[a-zA-Z0-9._-]+$/)
	.transform((username) => username.toLowerCase());

export const passwordSchema = z.string().min(12).max(128);
export const displayNameSchema = z.string().trim().min(1).max(64);
export const registrationSchema = z.object({
	username: usernameSchema,
	displayName: displayNameSchema,
	password: passwordSchema
});

export type UserRole = z.infer<typeof userRoleSchema>;

export interface AuthenticatedUser {
	id: string;
	username: string;
	displayName: string;
	role: UserRole;
	isParticipating: boolean;
}

export function isExchangeParticipant(user: AuthenticatedUser): boolean {
	return user.role === 'participant' || user.isParticipating;
}
