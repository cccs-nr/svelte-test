import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { serveProfileImage } from '#lib/server/profile-image-response.js';
import { isActiveExchangeParticipant } from '#lib/server/wishlist-access.js';

export const GET: RequestHandler = ({ locals, params }) => {
	if (!locals.user || !isActiveExchangeParticipant(db, locals.user.id)) {
		return new Response('Participant access is required.', { status: 404 });
	}

	if (!isActiveExchangeParticipant(db, params.participantId)) {
		return new Response('Participant avatar not found.', { status: 404 });
	}

	const avatar = db
		.select({ key: users.avatarKey, mimeType: users.avatarMimeType })
		.from(users)
		.where(eq(users.id, params.participantId))
		.get();
	return serveProfileImage(avatar?.key ?? null, avatar?.mimeType ?? null);
};
