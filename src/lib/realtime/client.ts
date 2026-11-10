import { io, type Socket } from 'socket.io-client';

let realtimeSocket: Socket | null = null;

export function getRealtimeSocket(): Socket {
	if (!realtimeSocket) {
		realtimeSocket = io({ autoConnect: false, path: `${__APP_BASE_PATH__}/socket.io` });
	}

	return realtimeSocket;
}

export function connectRealtime(): Socket {
	const socket = getRealtimeSocket();
	if (!socket.connected) socket.connect();
	return socket;
}

export function disconnectRealtime(): void {
	realtimeSocket?.disconnect();
}
