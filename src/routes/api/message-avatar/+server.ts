import { and, eq, isNotNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { isExchangeParticipant } from '#lib/auth.js';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { db } from '#lib/server/db/index.js';
import { assignments, users } from '#lib/server/db/schema.js';
import { readImage, type ImageMimeType } from '#lib/server/image-storage.js';

function isImageMimeType(value: string): value is ImageMimeType {
	return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

function notFound(): Response {
	return new Response('Image not found.', { status: 404 });
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return new Response('Authentication is required.', { status: 401 });
	if (!isExchangeParticipant(locals.user)) return notFound();

	const recipientAvatar = db
		.select({ key: users.avatarKey, mimeType: users.avatarMimeType })
		.from(assignments)
		.innerJoin(users, eq(users.id, assignments.receiverId))
		.where(
			and(
				eq(assignments.eventId, SINGLE_EVENT_ID),
				eq(assignments.giverId, locals.user.id),
				isNotNull(assignments.finalizedAt)
			)
		)
		.get();
	if (
		!recipientAvatar?.key ||
		!recipientAvatar.mimeType ||
		!isImageMimeType(recipientAvatar.mimeType)
	) {
		return notFound();
	}

	let image: Buffer;
	try {
		image = await readImage(recipientAvatar.key, recipientAvatar.mimeType);
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return notFound();
		throw error;
	}

	return new Response(Uint8Array.from(image), {
		headers: {
			'Content-Type': recipientAvatar.mimeType,
			'Content-Length': String(image.byteLength),
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
