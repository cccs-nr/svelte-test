import type { Server } from 'socket.io';

export type RealtimeEventName =
	| 'messages:changed'
	| 'wishlist:changed'
	| 'family-wishlist:changed'
	| 'family-messages:changed'
	| 'recipient-wishlist:changed'
	| 'gift-status:changed'
	| 'badges:changed'
	| 'codenames:changed'
	| 'event:changed'
	| 'dashboard:changed';

type RealtimeGlobal = typeof globalThis & {
	secretSantaRealtime?: Server;
};

function getRealtimeServer(): Server | undefined {
	return (globalThis as RealtimeGlobal).secretSantaRealtime;
}

export function notifyUser(userId: string, event: RealtimeEventName): void {
	const realtime = getRealtimeServer();
	if (!realtime) return;

	const userRoom = realtime.to(`user:${userId}`);
	userRoom.emit(event);
	if (event !== 'badges:changed') userRoom.emit('badges:changed');
}

export function notifyOrganizerDashboard(): void {
	getRealtimeServer()?.to('organizers').emit('dashboard:changed');
}

export function disconnectUserRealtime(userId: string): void {
	getRealtimeServer()?.in(`user:${userId}`).disconnectSockets(true);
}
