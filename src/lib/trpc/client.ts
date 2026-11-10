import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '#lib/server/trpc/router.js';

export const trpc = createTRPCClient<AppRouter>({
	links: [httpBatchLink({ url: `${__APP_BASE_PATH__}/api/trpc` })]
});
