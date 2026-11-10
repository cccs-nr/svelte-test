import type { AuthenticatedUser } from '#lib/auth.js';

declare global {
	const __APP_BASE_PATH__: string;

	namespace App {
		interface Locals {
			user: AuthenticatedUser | null;
		}

		// interface PageData {}
		interface PageState {
			wishlistTab?: 'ideas' | 'recipient' | 'family' | 'messages';
		}
		// interface Platform {}
	}
}

export {};
