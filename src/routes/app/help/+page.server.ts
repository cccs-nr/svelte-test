import type { PageServerLoad } from './$types';
import { getEventSummary } from '#lib/server/event-summary.js';

export const load: PageServerLoad = () => ({ event: getEventSummary() });
