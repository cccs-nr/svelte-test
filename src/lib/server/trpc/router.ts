import { authRouter } from './routers/auth.js';
import { assignmentRouter } from './routers/assignments.js';
import { conversationsRouter } from './routers/conversations.js';
import { eventRouter } from './routers/event.js';
import { householdRouter } from './routers/households.js';
import { messagesRouter } from './routers/messages.js';
import { notificationsRouter } from './routers/notifications.js';
import { participantsRouter } from './routers/participants.js';
import { wishlistsRouter } from './routers/wishlists.js';
import { router } from './init.js';

export const appRouter = router({
	auth: authRouter,
	event: eventRouter,
	assignments: assignmentRouter,
	conversations: conversationsRouter,
	households: householdRouter,
	messages: messagesRouter,
	notifications: notificationsRouter,
	participants: participantsRouter,
	wishlists: wishlistsRouter
});

export type AppRouter = typeof appRouter;
