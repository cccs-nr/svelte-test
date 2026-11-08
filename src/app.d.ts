import type { AuthenticatedUser } from '#lib/auth.js';

declare global {
	namespace App {
		interface Locals {
			user: AuthenticatedUser | null;
		}

		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
