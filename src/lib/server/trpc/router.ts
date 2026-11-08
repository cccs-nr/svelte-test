import { authRouter } from './routers/auth.js';
import { assignmentRouter } from './routers/assignments.js';
import { eventRouter } from './routers/event.js';
import { householdRouter } from './routers/households.js';
import { participantsRouter } from './routers/participants.js';
import { router } from './init.js';

export const appRouter = router({
	auth: authRouter,
	event: eventRouter,
	assignments: assignmentRouter,
	households: householdRouter,
	participants: participantsRouter
});

export type AppRouter = typeof appRouter;
