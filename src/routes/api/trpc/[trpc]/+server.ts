import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { RequestHandler } from './$types';
import { createTRPCContext } from '#lib/server/trpc/context.js';
import { appRouter } from '#lib/server/trpc/router.js';

const handler: RequestHandler = (event) =>
	fetchRequestHandler({
		endpoint: `${__APP_BASE_PATH__}/api/trpc`,
		req: event.request,
		router: appRouter,
		createContext: () => createTRPCContext(event)
	});

export { handler as GET, handler as POST };
