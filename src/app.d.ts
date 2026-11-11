import type { AuthenticatedUser } from '#lib/auth.js';

declare global {
	const __APP_BASE_PATH__: string;

	namespace App {
		interface Locals {
			/** The participant the request acts as; differs from accountUser when managing a household member. */
			user: AuthenticatedUser | null;
			/** The signed-in account that owns the session. */
			accountUser: AuthenticatedUser | null;
		}

		// interface PageData {}
		interface PageState {
			wishlistTab?: 'ideas' | 'recipient' | 'family' | 'messages';
		}
		// interface Platform {}
	}
}

export {};
