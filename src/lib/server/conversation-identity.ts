import { TRPCError } from '@trpc/server';

export type WishlistConversationType = 'wishlist_discussion' | 'gift_coordination';

type ProfileIdentity = {
	type: 'profile';
	label: string;
	userId: string;
	hasAvatar: boolean;
	avatarVersion: number;
};

export type ConversationIdentity =
	| ProfileIdentity
	| { type: 'codename'; label: string; codename: string }
	| { type: 'secret'; label: 'Secret Santa' };

type IdentityInput = {
	viewerId: string;
	senderId: string;
	wishlistOwnerId: string;
	type: WishlistConversationType;
	assignedSecretSantaId: string | null;
	senderDisplayName: string;
	senderAvatarKey: string | null;
	senderAvatarVersion: number;
	senderCodename: string | null;
};

function profileIdentity(input: IdentityInput): ProfileIdentity {
	return {
		type: 'profile',
		label: input.senderDisplayName,
		userId: input.senderId,
		hasAvatar: Boolean(input.senderAvatarKey),
		avatarVersion: input.senderAvatarVersion
	};
}

export function resolveConversationIdentity(input: IdentityInput): ConversationIdentity {
	if (input.senderId === input.wishlistOwnerId) {
		return profileIdentity(input);
	}

	if (input.viewerId === input.wishlistOwnerId && input.senderId === input.assignedSecretSantaId) {
		return { type: 'secret', label: 'Secret Santa' };
	}

	if (!input.senderCodename) {
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'A conversation participant is missing their codename.'
		});
	}

	return {
		type: 'codename',
		label: input.senderCodename,
		codename: input.senderCodename
	};
}
