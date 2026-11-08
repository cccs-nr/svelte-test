import { markMessagesReadInputSchema, sendMessageInputSchema } from '#lib/models/messaging.js';
import { markParticipantMessagesRead, sendParticipantMessage } from '#lib/server/messaging.js';
import { participantProcedure, router } from '#lib/server/trpc/init.js';

export const messagesRouter = router({
	send: participantProcedure
		.input(sendMessageInputSchema)
		.mutation(({ ctx, input }) =>
			sendParticipantMessage(ctx.db, ctx.user.id, input.direction, input.content)
		),
	markRead: participantProcedure
		.input(markMessagesReadInputSchema)
		.mutation(({ ctx, input }) =>
			markParticipantMessagesRead(ctx.db, ctx.user.id, input.direction, input.throughCreatedAt)
		)
});
