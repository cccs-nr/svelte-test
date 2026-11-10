import { Server } from 'socket.io';
import { TLSSocket } from 'node:tls';

/** @param {import('node:http').IncomingMessage} request */
function isSameOrigin(request) {
	const origin = request.headers.origin;
	const host = request.headers['x-forwarded-host'] ?? request.headers.host;
	const protocol =
		request.headers['x-forwarded-proto'] ??
		(request.socket instanceof TLSSocket ? 'https' : 'http');
	if (typeof origin !== 'string' || typeof host !== 'string') return false;

	try {
		const parsedOrigin = new URL(origin);
		const expectedHost = host.split(',')[0].trim().toLowerCase();
		const expectedProtocol = String(protocol).split(',')[0].trim();
		return (
			parsedOrigin.host.toLowerCase() === expectedHost &&
			parsedOrigin.protocol === `${expectedProtocol}:`
		);
	} catch {
		return false;
	}
}

/**
 * @param {unknown} value
 * @returns {value is { userId: string; role: 'organizer' | 'participant' }}
 */
function isIdentity(value) {
	return (
		typeof value === 'object' &&
		value !== null &&
		'userId' in value &&
		typeof value.userId === 'string' &&
		value.userId.length > 0 &&
		'role' in value &&
		(value.role === 'organizer' || value.role === 'participant')
	);
}

/**
 * @param {import('node:http').Server} httpServer
 * @param {() => string} getInternalOrigin
 */
export function attachRealtimeServer(httpServer, getInternalOrigin, basePath = '') {
	const normalizedBasePath = basePath.replace(/\/+$/, '');
	const io = new Server(httpServer, {
		serveClient: false,
		path: `${normalizedBasePath}/socket.io`
	});

	/** @param {string} cookie */
	async function resolveIdentity(cookie) {
		const response = await fetch(
			new URL(`${normalizedBasePath}/api/realtime/session`, getInternalOrigin()),
			{
				headers: cookie ? { cookie } : {},
				signal: AbortSignal.timeout(5_000)
			}
		);
		if (!response.ok) return null;

		const identity = await response.json();
		return isIdentity(identity) ? identity : null;
	}

	io.use(async (socket, next) => {
		if (!isSameOrigin(socket.request)) {
			next(new Error('A same-origin socket connection is required.'));
			return;
		}

		try {
			const identity = await resolveIdentity(socket.request.headers.cookie ?? '');
			if (!identity) {
				next(new Error('Authentication is required for live updates.'));
				return;
			}

			socket.data.userId = identity.userId;
			socket.data.role = identity.role;
			next();
		} catch (error) {
			console.error('Unable to validate a live-update session.', error);
			next(new Error('Live-update authentication is unavailable.'));
		}
	});

	io.on('connection', (socket) => {
		const userId = socket.data.userId;
		const role = socket.data.role;
		socket.join(`user:${userId}`);
		if (role === 'organizer') socket.join('organizers');

		const revalidate = setInterval(() => {
			void resolveIdentity(socket.request.headers.cookie ?? '')
				.then((identity) => {
					if (!identity || identity.userId !== userId) socket.disconnect(true);
				})
				.catch((error) => {
					console.error('Unable to revalidate a live-update session.', error);
					socket.disconnect(true);
				});
		}, 60_000);
		revalidate.unref();
		socket.on('disconnect', () => clearInterval(revalidate));
	});

	/** @type {typeof globalThis & { secretSantaRealtime?: import('socket.io').Server }} */
	const sharedGlobal = globalThis;
	sharedGlobal.secretSantaRealtime = io;
	return io;
}
