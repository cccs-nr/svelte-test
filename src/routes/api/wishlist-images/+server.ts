import { and, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { MAX_IMAGE_BYTES } from '$app/env/private';
import { giftSuggestions } from '#lib/server/db/schema.js';
import { db } from '#lib/server/db/index.js';
import {
	detectWishlistImageMimeType,
	removeWishlistImage,
	storeWishlistImage,
	type WishlistImageMimeType
} from '#lib/server/wishlist-image-storage.js';

const maxMultipartOverheadBytes = 64 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(status: number, message: string): Response {
	return Response.json({ error: message }, { status });
}

function hasSameOrigin(request: Request, requestUrl: URL): boolean {
	const origin = request.headers.get('origin');
	if (!origin) return false;

	try {
		return new URL(origin).origin === requestUrl.origin;
	} catch {
		return false;
	}
}

function isImageMimeType(value: string): value is WishlistImageMimeType {
	return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

export const POST: RequestHandler = async ({ request, url, locals }) => {
	if (!locals.user) return failure(401, 'Sign in to upload an image.');
	if (locals.user.role !== 'participant') {
		return failure(403, 'Only participants can upload wishlist images.');
	}
	if (!hasSameOrigin(request, url)) {
		return failure(403, 'A same-origin request is required.');
	}

	const contentLengthHeader = request.headers.get('content-length');
	if (!contentLengthHeader || !/^\d+$/.test(contentLengthHeader)) {
		return failure(411, 'A valid Content-Length header is required.');
	}
	const contentLength = Number(contentLengthHeader);
	if (
		!Number.isSafeInteger(contentLength) ||
		contentLength > MAX_IMAGE_BYTES + maxMultipartOverheadBytes
	) {
		return failure(413, 'The image upload is too large.');
	}
	if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
		return failure(415, 'Upload the image as multipart form data.');
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return failure(400, 'The image upload form could not be read.');
	}

	const suggestionId = formData.get('suggestionId');
	const files = formData.getAll('image');
	const file = files[0];
	if (typeof suggestionId !== 'string' || !uuidPattern.test(suggestionId)) {
		return failure(400, 'A valid gift suggestion is required.');
	}
	if (files.length !== 1 || !(file instanceof File)) {
		return failure(400, 'Select one image to upload.');
	}
	if (file.size === 0) return failure(400, 'The selected image is empty.');
	if (file.size > MAX_IMAGE_BYTES) {
		return failure(413, `Choose an image no larger than ${MAX_IMAGE_BYTES} bytes.`);
	}

	const suggestion = db
		.select({
			id: giftSuggestions.id,
			imageKey: giftSuggestions.imageKey,
			imageMimeType: giftSuggestions.imageMimeType
		})
		.from(giftSuggestions)
		.where(and(eq(giftSuggestions.id, suggestionId), eq(giftSuggestions.ownerId, locals.user.id)))
		.get();
	if (!suggestion) return failure(404, 'Gift suggestion not found.');

	const bytes = Buffer.from(await file.arrayBuffer());
	const mimeType = detectWishlistImageMimeType(bytes);
	if (!mimeType) {
		return failure(415, 'Use a valid JPEG, PNG, or WebP image.');
	}

	const imageKey = await storeWishlistImage(bytes, mimeType);
	let updateResult: { changes: number };
	try {
		updateResult = db
			.update(giftSuggestions)
			.set({ imageKey, imageMimeType: mimeType, updatedAt: new Date() })
			.where(
				and(
					eq(giftSuggestions.id, suggestionId),
					eq(giftSuggestions.ownerId, locals.user.id),
					suggestion.imageKey
						? eq(giftSuggestions.imageKey, suggestion.imageKey)
						: isNull(giftSuggestions.imageKey)
				)
			)
			.run();
	} catch (error) {
		try {
			await removeWishlistImage(imageKey, mimeType);
		} catch (cleanupError) {
			console.error('Failed to remove a new image after its database update failed.', cleanupError);
		}
		throw error;
	}
	if (updateResult.changes === 0) {
		await removeWishlistImage(imageKey, mimeType);
		return failure(409, 'The suggestion image changed. Refresh your wishlist and try again.');
	}

	const previousMimeType = suggestion.imageMimeType;
	if (suggestion.imageKey && previousMimeType && isImageMimeType(previousMimeType)) {
		await removeWishlistImage(suggestion.imageKey, previousMimeType);
	}

	return Response.json({ imageKey });
};

export const DELETE: RequestHandler = async ({ request, url, locals }) => {
	if (!locals.user) return failure(401, 'Sign in to manage wishlist images.');
	if (locals.user.role !== 'participant') {
		return failure(403, 'Only participants can manage wishlist images.');
	}
	if (!hasSameOrigin(request, url)) {
		return failure(403, 'A same-origin request is required.');
	}

	const suggestionId = url.searchParams.get('suggestionId');
	if (!suggestionId || !uuidPattern.test(suggestionId)) {
		return failure(400, 'A valid gift suggestion is required.');
	}

	const suggestion = db
		.select({
			id: giftSuggestions.id,
			imageKey: giftSuggestions.imageKey,
			imageMimeType: giftSuggestions.imageMimeType
		})
		.from(giftSuggestions)
		.where(and(eq(giftSuggestions.id, suggestionId), eq(giftSuggestions.ownerId, locals.user.id)))
		.get();
	if (!suggestion) return failure(404, 'Gift suggestion not found.');
	if (!suggestion.imageKey || !suggestion.imageMimeType) return new Response(null, { status: 204 });

	const result = db
		.update(giftSuggestions)
		.set({ imageKey: null, imageMimeType: null, updatedAt: new Date() })
		.where(
			and(
				eq(giftSuggestions.id, suggestionId),
				eq(giftSuggestions.ownerId, locals.user.id),
				eq(giftSuggestions.imageKey, suggestion.imageKey)
			)
		)
		.run();
	if (result.changes === 0) {
		return failure(409, 'The suggestion image changed. Refresh your wishlist and try again.');
	}

	await removeWishlistImage(suggestion.imageKey, suggestion.imageMimeType);
	return new Response(null, { status: 204 });
};
