import { z } from 'zod';

export const userRoleSchema = z.enum(['organizer', 'participant']);

export const usernameSchema = z
	.string()
	.trim()
	.min(3)
	.max(32)
	.regex(/^[a-zA-Z0-9._-]+$/)
	.transform((username) => username.toLowerCase());

export const passwordSchema = z.string().min(3).max(128);
export const displayNameSchema = z.string().trim().min(1).max(64);

export function createUsernameCandidate(displayName: string, suffix = 1): string {
	const slug = displayName
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '.')
		.replace(/\.{2,}/g, '.')
		.replace(/^[._-]+|[._-]+$/g, '');
	const base = (slug.length >= 3 ? slug : `member${slug}`).slice(0, 32);
	const suffixText = suffix === 1 ? '' : `.${suffix}`;
	return `${base.slice(0, 32 - suffixText.length)}${suffixText}`;
}

export const registrationSchema = z.object({
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
