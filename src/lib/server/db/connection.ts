import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export function createDatabase(databaseUrl: string) {
	const databasePath =
		databaseUrl === ':memory:'
			? databaseUrl
			: isAbsolute(databaseUrl)
				? databaseUrl
				: resolve(process.cwd(), databaseUrl);

	if (databasePath !== ':memory:') {
		mkdirSync(dirname(databasePath), { recursive: true });
	}

	const client = new Database(databasePath);
	client.pragma('foreign_keys = ON');
	client.pragma('busy_timeout = 5000');

	if (databasePath !== ':memory:') {
		client.pragma('journal_mode = WAL');
	}

	return { client, db: drizzle(client, { schema }) };
}

export type AppDatabase = ReturnType<typeof createDatabase>['db'];
