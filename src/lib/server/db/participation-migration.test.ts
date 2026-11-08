import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('organizer participation migration', () => {
	it('keeps existing participants in the draw and opts existing organizers out', () => {
		const client = new Database(':memory:');
		try {
			client.exec(`
				CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT NOT NULL);
				INSERT INTO users (id, role) VALUES ('participant', 'participant');
				INSERT INTO users (id, role) VALUES ('organizer', 'organizer');
			`);
			const migration = readFileSync(
				resolve(process.cwd(), 'drizzle/0005_organizer_participation.sql'),
				'utf8'
			);
			client.exec(migration);

			const rows = client
				.prepare('SELECT id, is_participating AS isParticipating FROM users ORDER BY id')
				.all();
			expect(rows).toEqual([
				{ id: 'organizer', isParticipating: 0 },
				{ id: 'participant', isParticipating: 1 }
			]);
		} finally {
			client.close();
		}
	});
});
