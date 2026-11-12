import { createServer } from 'node:http';
import { attachRealtimeServer } from './scripts/realtime-server.mjs';

process.env.BODY_SIZE_LIMIT ??= String(11 * 1024 * 1024);
const { handler } = await import('./build/handler.js');

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const basePath = process.env.BASE_PATH ?? '';
const server = createServer((request, response) => {
	handler(request, response, () => {
		response.statusCode = 404;
		response.end();
	});
});

attachRealtimeServer(server, () => `http://127.0.0.1:${port}`, basePath);
server.listen(port, host, () => {
	console.info(`Secret Santa is listening on ${host}:${port}.`);
});
