import { and, eq, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { MAX_IMAGE_BYTES } from '$app/env/private';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import {
	detectImageMimeType,
	removeImage,
	storeImage,
	type ImageMimeType
} from '#lib/server/image-storage.js';
import { serveProfileImage } from '#lib/server/profile-image-response.js';

const maxMultipartOverheadBytes = 64 * 1024;

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

function isImageMimeType(value: string): value is ImageMimeType {
	return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) return new Response('Authentication is required.', { status: 401 });

	const avatar = db
		.select({ key: users.avatarKey, mimeType: users.avatarMimeType })
		.from(users)
		.where(eq(users.id, locals.user.id))
		.get();
	return serveProfileImage(avatar?.key ?? null, avatar?.mimeType ?? null);
};

export const POST: RequestHandler = async ({ request, url, locals }) => {
	if (!locals.user) return failure(401, 'Sign in to upload a profile picture.');
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

	const files = formData.getAll('image');
	const file = files[0];
	if (files.length !== 1 || !(file instanceof File)) {
		return failure(400, 'Select one image to upload.');
	}
	if (file.size === 0) return failure(400, 'The selected image is empty.');
	if (file.size > MAX_IMAGE_BYTES) {
		return failure(413, `Choose an image no larger than ${MAX_IMAGE_BYTES} bytes.`);
	}

	const currentAvatar = db
		.select({ key: users.avatarKey, mimeType: users.avatarMimeType })
		.from(users)
		.where(eq(users.id, locals.user.id))
		.get();
	if (!currentAvatar) return failure(404, 'Account not found.');

	const bytes = Buffer.from(await file.arrayBuffer());
	const mimeType = detectImageMimeType(bytes);
	if (!mimeType) return failure(415, 'Use a valid JPEG, PNG, or WebP image.');

	const avatarKey = await storeImage(bytes, mimeType);
	let updateResult: { changes: number };
	try {
		updateResult = db
			.update(users)
			.set({ avatarKey, avatarMimeType: mimeType, updatedAt: new Date() })
			.where(
				and(
					eq(users.id, locals.user.id),
					currentAvatar.key ? eq(users.avatarKey, currentAvatar.key) : isNull(users.avatarKey)
				)
			)
			.run();
	} catch (error) {
		try {
			await removeImage(avatarKey, mimeType);
		} catch (cleanupError) {
			console.error(
				'Failed to remove a new profile image after its database update failed.',
				cleanupError
			);
		}
		throw error;
	}
	if (updateResult.changes === 0) {
		await removeImage(avatarKey, mimeType);
		return failure(409, 'Your profile picture changed. Refresh and try again.');
	}

	const previousMimeType = currentAvatar.mimeType;
	if (currentAvatar.key && previousMimeType && isImageMimeType(previousMimeType)) {
		await removeImage(currentAvatar.key, previousMimeType);
	}

	return Response.json({ hasAvatar: true });
};

export const DELETE: RequestHandler = async ({ request, url, locals }) => {
	if (!locals.user) return failure(401, 'Sign in to remove a profile picture.');
	if (!hasSameOrigin(request, url)) {
		return failure(403, 'A same-origin request is required.');
	}

	const avatar = db
		.select({ key: users.avatarKey, mimeType: users.avatarMimeType })
		.from(users)
		.where(eq(users.id, locals.user.id))
		.get();
	if (!avatar) return failure(404, 'Account not found.');
	if (!avatar.key || !avatar.mimeType) return new Response(null, { status: 204 });

	const result = db
		.update(users)
		.set({ avatarKey: null, avatarMimeType: null, updatedAt: new Date() })
		.where(and(eq(users.id, locals.user.id), eq(users.avatarKey, avatar.key)))
		.run();
	if (result.changes === 0) {
		return failure(409, 'Your profile picture changed. Refresh and try again.');
	}

	if (isImageMimeType(avatar.mimeType)) await removeImage(avatar.key, avatar.mimeType);
	return new Response(null, { status: 204 });
};
