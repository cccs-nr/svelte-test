import { attachRealtimeServer } from './realtime-server.mjs';

/** @param {import('node:http').Server} httpServer */
function getInternalOrigin(httpServer) {
	const address = httpServer.address();
	if (!address || typeof address === 'string') {
		throw new Error('The local HTTP server is not listening.');
	}
	return `http://127.0.0.1:${address.port}`;
}

/** @param {{ httpServer: import('node:http').Server | null }} server */
function attach(server) {
	const httpServer = server.httpServer;
	if (!httpServer) return;
	attachRealtimeServer(httpServer, () => getInternalOrigin(httpServer));
}

export function realtimeVitePlugin() {
	return {
		name: 'secret-santa-realtime',
		configureServer: attach,
		configurePreviewServer: attach
	};
}
