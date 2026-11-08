import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { giftSuggestions } from '#lib/server/db/schema.js';
import { db } from '#lib/server/db/index.js';
import { canViewWishlist } from '#lib/server/wishlist-access.js';
import {
	readWishlistImage,
	type WishlistImageMimeType
} from '#lib/server/wishlist-image-storage.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isImageMimeType(value: string): value is WishlistImageMimeType {
	return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

function notFound(): Response {
	return new Response('Image not found.', { status: 404 });
}

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return new Response('Authentication is required.', { status: 401 });
	if (!uuidPattern.test(params.imageKey)) return notFound();

	const suggestion = db
		.select({
			ownerId: giftSuggestions.ownerId,
			imageKey: giftSuggestions.imageKey,
			imageMimeType: giftSuggestions.imageMimeType
		})
		.from(giftSuggestions)
		.where(eq(giftSuggestions.imageKey, params.imageKey))
		.get();
	if (
		!suggestion ||
		!suggestion.imageKey ||
		!suggestion.imageMimeType ||
		!isImageMimeType(suggestion.imageMimeType) ||
		!canViewWishlist(db, locals.user, suggestion.ownerId)
	) {
		return notFound();
	}

	let image: Buffer;
	try {
		image = await readWishlistImage(suggestion.imageKey, suggestion.imageMimeType);
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return notFound();
		throw error;
	}

	return new Response(Uint8Array.from(image), {
		headers: {
			'Content-Type': suggestion.imageMimeType,
			'Content-Length': String(image.byteLength),
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
