import { authRouter } from './routers/auth.js';
import { router } from './init.js';

export const appRouter = router({
	auth: authRouter
});

export type AppRouter = typeof appRouter;
