import { countUnreadMessages, getParticipantConversations } from '#lib/server/messaging.js';
import { participantProcedure, router } from '#lib/server/trpc/init.js';

export const conversationsRouter = router({
	list: participantProcedure.query(({ ctx }) => getParticipantConversations(ctx.db, ctx.user.id)),
	unreadCount: participantProcedure.query(({ ctx }) => ({
		count: countUnreadMessages(ctx.db, ctx.user.id)
	}))
});
