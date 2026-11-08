import { error, redirect } from '@sveltejs/kit';
import type { AuthenticatedUser } from '#lib/auth.js';

export function requireOrganizerPage(user: AuthenticatedUser | null): AuthenticatedUser {
	if (!user) redirect(303, '/login');
	if (user.role !== 'organizer') error(403, 'Organizer access is required.');
	return user;
}

export function requireParticipantPage(user: AuthenticatedUser | null): AuthenticatedUser {
	if (!user) redirect(303, '/login');
	if (user.role !== 'participant') error(403, 'Participant access is required.');
	return user;
}
