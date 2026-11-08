import { createServer } from 'node:http';
import { handler } from './build/handler.js';
import { attachRealtimeServer } from './scripts/realtime-server.mjs';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const server = createServer((request, response) => {
	handler(request, response, () => {
		response.statusCode = 404;
		response.end();
	});
});

attachRealtimeServer(server, () => `http://127.0.0.1:${port}`);
server.listen(port, host, () => {
	console.info(`Secret Santa is listening on ${host}:${port}.`);
});
