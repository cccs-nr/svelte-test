import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	UPLOADS_DIR: {
		schema: (value) => {
			const directory = value?.trim() || './data/uploads';
			if (!directory) throw new Error('UPLOADS_DIR must be a non-empty path.');
			return directory;
		},
		description: 'A directory outside the source tree where wishlist images are stored.'
	},
	MAX_IMAGE_BYTES: {
		schema: (value) => {
			const maxBytes = value === undefined ? 10 * 1024 * 1024 : Number(value);
			if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 10 * 1024 * 1024) {
				throw new Error('MAX_IMAGE_BYTES must be an integer between 1 and 10485760.');
			}
			return maxBytes;
		},
		description: 'Maximum allowed size for a wishlist or profile image upload (up to 10 MiB).'
	}
});
