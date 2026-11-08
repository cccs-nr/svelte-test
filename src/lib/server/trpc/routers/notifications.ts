import { getParticipantBadgeCounts } from '#lib/server/notification-counts.js';
import { participantProcedure, router } from '#lib/server/trpc/init.js';

export const notificationsRouter = router({
	badges: participantProcedure.query(({ ctx }) => getParticipantBadgeCounts(ctx.db, ctx.user.id))
});
