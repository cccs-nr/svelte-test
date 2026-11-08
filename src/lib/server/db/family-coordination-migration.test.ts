import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('family coordination migration', () => {
	it('backfills randomized unique codenames for active participants and keeps unrelated accounts out', () => {
		const client = new Database(':memory:');
		try {
			client.pragma('foreign_keys = ON');
			client.exec(`
				CREATE TABLE events (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL,
					description TEXT NOT NULL DEFAULT '',
					exchange_date TEXT NOT NULL,
					gift_budget_cents INTEGER NOT NULL,
					currency TEXT NOT NULL,
					instructions TEXT NOT NULL DEFAULT '',
					status TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL
				);
				CREATE TABLE users (
					id TEXT PRIMARY KEY,
					role TEXT NOT NULL,
					is_participating INTEGER NOT NULL DEFAULT 0,
					is_active INTEGER NOT NULL DEFAULT 1
				);
				CREATE TABLE gift_suggestions (id TEXT PRIMARY KEY);
				INSERT INTO events
					(id, name, exchange_date, gift_budget_cents, currency, status, created_at, updated_at)
				VALUES ('main', 'Family Exchange', '2026-12-24', 5000, 'CAD', 'assignments_generated', 1, 1);
				INSERT INTO users (id, role, is_participating, is_active)
				VALUES ('organizer', 'organizer', 0, 1), ('inactive', 'participant', 0, 0);
			`);
			for (let index = 0; index < 22; index += 1) {
				client
					.prepare('INSERT INTO users (id, role, is_participating, is_active) VALUES (?, ?, ?, 1)')
					.run(`participant-${index}`, 'participant', 0);
			}
			client
				.prepare('INSERT INTO users (id, role, is_participating, is_active) VALUES (?, ?, 1, 1)')
				.run('participating-organizer', 'organizer');

			const migration = readFileSync(
				resolve(process.cwd(), 'drizzle/0009_family_gift_coordination.sql'),
				'utf8'
			);
			client.exec(migration);

			const codenames = client
				.prepare('SELECT user_id AS userId, codename FROM participant_codenames ORDER BY user_id')
				.all() as { userId: string; codename: string }[];
			expect(codenames).toHaveLength(23);
			expect(new Set(codenames.map(({ codename }) => codename)).size).toBe(23);
			expect(codenames.some(({ codename }) => /\s\d+$/.test(codename))).toBe(true);
			expect(codenames.map(({ userId }) => userId)).not.toContain('organizer');
			expect(codenames.map(({ userId }) => userId)).not.toContain('inactive');
			expect(codenames.map(({ userId }) => userId)).toContain('participating-organizer');
			expect(client.pragma('foreign_key_check')).toEqual([]);
		} finally {
			client.close();
		}
	});
});
