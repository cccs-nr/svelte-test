import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isExchangeParticipant } from '#lib/auth.js';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { and, asc, eq } from 'drizzle-orm';
import { getParticipantBadgeCounts } from '#lib/server/notification-counts.js';
import { getParticipantCodename } from '#lib/server/codenames.js';
import { isActiveExchangeParticipant } from '#lib/server/wishlist-access.js';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.user || !locals.accountUser) redirect(303, resolve('/login'));
	const avatar = db
		.select({ key: users.avatarKey, updatedAt: users.updatedAt })
		.from(users)
		.where(eq(users.id, locals.user.id))
		.get();
	const account = db
		.select({
			welcomeAcknowledgedAt: users.welcomeAcknowledgedAt,
			previousLoginAt: users.previousLoginAt
		})
		.from(users)
		.where(eq(users.id, locals.accountUser.id))
		.get();
	const hasAcknowledgedWelcome = Boolean(account?.welcomeAcknowledgedAt);
	if (!hasAcknowledgedWelcome && !url.pathname.endsWith('/app/welcome')) {
		redirect(303, resolve('/app/welcome'));
	}
	const badgeCounts = isExchangeParticipant(locals.user)
		? getParticipantBadgeCounts(db, locals.user.id)
		: { wishlist: 0, gift: 0, messages: 0 };
	const codename = isActiveExchangeParticipant(db, locals.user.id)
		? (getParticipantCodename(db, locals.user.id)?.codename ?? null)
		: null;
	const members = isExchangeParticipant(locals.accountUser)
		? [
				{ id: locals.accountUser.id, displayName: locals.accountUser.displayName },
				...db
					.select({ id: users.id, displayName: users.displayName })
					.from(users)
					.where(and(eq(users.managedByUserId, locals.accountUser.id), eq(users.isActive, true)))
					.orderBy(asc(users.createdAt), asc(users.id))
					.all()
			].map((member) => ({
				...member,
				unreadMessages: getParticipantBadgeCounts(db, member.id).messages
			}))
		: [];
	return {
		account: { id: locals.accountUser.id, displayName: locals.accountUser.displayName },
		isManagingOther: locals.user.id !== locals.accountUser.id,
		members,
		previousLoginAt: account?.previousLoginAt?.toISOString() ?? null,
		user: {
			id: locals.user.id,
			displayName: locals.user.displayName,
			role: locals.user.role,
			isParticipating: locals.user.isParticipating,
			codename
		},
		hasAvatar: Boolean(avatar?.key),
		avatarVersion: avatar?.updatedAt.getTime() ?? 0,
		badgeCounts,
		hasAcknowledgedWelcome
	};
};
