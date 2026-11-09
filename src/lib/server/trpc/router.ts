import { authRouter } from './routers/auth.js';
import { assignmentRouter } from './routers/assignments.js';
import { conversationsRouter } from './routers/conversations.js';
import { codenamesRouter } from './routers/codenames.js';
import { eventRouter } from './routers/event.js';
import { householdRouter } from './routers/households.js';
import { notificationsRouter } from './routers/notifications.js';
import { participantsRouter } from './routers/participants.js';
import { reservationsRouter } from './routers/reservations.js';
import { wishlistsRouter } from './routers/wishlists.js';
import { router } from './init.js';

export const appRouter = router({
	auth: authRouter,
	event: eventRouter,
	assignments: assignmentRouter,
	conversations: conversationsRouter,
	codenames: codenamesRouter,
	households: householdRouter,
	notifications: notificationsRouter,
	participants: participantsRouter,
	reservations: reservationsRouter,
	wishlists: wishlistsRouter
});

export type AppRouter = typeof appRouter;
