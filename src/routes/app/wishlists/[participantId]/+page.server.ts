import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { SINGLE_EVENT_ID } from '#lib/models/event.js';
import { db } from '#lib/server/db/index.js';
import { events, users } from '#lib/server/db/schema.js';
import { requireParticipantPage } from '#lib/server/page-guards.js';
import { isActiveExchangeParticipant } from '#lib/server/wishlist-access.js';

export const load: PageServerLoad = ({ locals, params }) => {
	const user = requireParticipantPage(locals.user);
	if (params.participantId === user.id) redirect(303, resolve('/app/wishlist'));
	if (!isActiveExchangeParticipant(db, params.participantId)) {
		error(404, 'Participant not found.');
	}
	const recipient = db
		.select({ displayName: users.displayName })
		.from(users)
		.where(eq(users.id, params.participantId))
		.get();
	if (!recipient) error(404, 'Participant not found.');
	const event = db
		.select({ giftBudgetCents: events.giftBudgetCents, currency: events.currency })
		.from(events)
		.where(eq(events.id, SINGLE_EVENT_ID))
		.get();

	return {
		currentUserId: user.id,
		participantId: params.participantId,
		recipientDisplayName: recipient.displayName,
		giftBudgetCents: event?.giftBudgetCents ?? null,
		currency: event?.currency ?? 'CAD'
	};
};
