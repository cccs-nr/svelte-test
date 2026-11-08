import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connectSocket, type Socket as ClientSocket } from 'socket.io-client';
import { attachRealtimeServer } from '../../../scripts/realtime-server.mjs';
import { notifyUser } from '#lib/server/realtime.js';

type RealtimeServer = ReturnType<typeof attachRealtimeServer>;
type RealtimeGlobal = typeof globalThis & { secretSantaRealtime?: RealtimeServer };

let httpServer: HttpServer | undefined;
let realtimeServer: RealtimeServer | undefined;
let clientSockets: ClientSocket[] = [];
let origin = '';

function createClient(userId: string, requestOrigin = origin): ClientSocket {
	const socket = connectSocket(origin, {
		autoConnect: false,
		reconnection: false,
		transports: ['websocket'],
		extraHeaders: {
			cookie: `auth=${userId}`,
			origin: requestOrigin
		}
	});
	clientSockets.push(socket);
	return socket;
}

function waitForConnection(socket: ClientSocket): Promise<void> {
	return new Promise((resolve, reject) => {
		socket.once('connect', () => resolve());
		socket.once('connect_error', reject);
		socket.connect();
	});
}

beforeEach(async () => {
	httpServer = createServer((request, response) => {
		if (request.url !== '/api/realtime/session') {
			response.writeHead(404).end();
			return;
		}

		const userId = request.headers.cookie?.replace(/^auth=/, '');
		if (!userId || !['alice', 'bob'].includes(userId)) {
			response.writeHead(401).end();
			return;
		}

		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(JSON.stringify({ userId, role: 'participant' }));
	});
	realtimeServer = attachRealtimeServer(httpServer, () => origin);
	await new Promise<void>((resolve) => httpServer?.listen(0, '127.0.0.1', resolve));
	const address = httpServer.address() as AddressInfo;
	origin = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
	for (const socket of clientSockets) socket.disconnect();
	clientSockets = [];
	if (realtimeServer) {
		await new Promise<void>((resolve) => realtimeServer?.close(() => resolve()));
		realtimeServer = undefined;
	}
	delete (globalThis as RealtimeGlobal).secretSantaRealtime;
	httpServer = undefined;
	origin = '';
});

describe('Socket.IO live updates', () => {
	it('authenticates users and delivers events only to the target account', async () => {
		const alice = createClient('alice');
		const bob = createClient('bob');
		await Promise.all([waitForConnection(alice), waitForConnection(bob)]);

		let bobReceivedMessageEvent = false;
		bob.on('messages:changed', () => {
			bobReceivedMessageEvent = true;
		});
		const aliceReceivedMessage = new Promise<void>((resolve) => {
			alice.once('messages:changed', () => resolve());
		});

		notifyUser('alice', 'messages:changed');
		await aliceReceivedMessage;
		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(bobReceivedMessageEvent).toBe(false);
	});

	it('rejects unauthenticated and cross-origin clients', async () => {
		const anonymous = createClient('unknown');
		await expect(waitForConnection(anonymous)).rejects.toThrow(
			'Authentication is required for live updates.'
		);

		const crossOrigin = createClient('alice', 'https://attacker.example');
		await expect(waitForConnection(crossOrigin)).rejects.toThrow(
			'A same-origin socket connection is required.'
		);
	});
});
