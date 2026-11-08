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

	it('preserves existing users when adding avatar columns', () => {
		const client = new Database(':memory:');
		try {
			client.pragma('foreign_keys = ON');
			client.exec(`
				CREATE TABLE households (id TEXT PRIMARY KEY);
				CREATE TABLE users (
					id TEXT PRIMARY KEY,
					username TEXT NOT NULL,
					display_name TEXT NOT NULL,
					password_hash TEXT NOT NULL,
					role TEXT NOT NULL,
					is_participating INTEGER NOT NULL DEFAULT 0,
					household_id TEXT,
					is_active INTEGER NOT NULL DEFAULT 1,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL,
					FOREIGN KEY (household_id) REFERENCES households (id)
				);
				CREATE TABLE sessions (
					id TEXT PRIMARY KEY,
					user_id TEXT NOT NULL REFERENCES users (id)
				);
				CREATE TABLE assignments (
					id TEXT PRIMARY KEY,
					giver_id TEXT NOT NULL REFERENCES users (id),
					receiver_id TEXT NOT NULL REFERENCES users (id)
				);
				INSERT INTO users
					(id, username, display_name, password_hash, role, is_participating, is_active, created_at, updated_at)
				VALUES
					('organizer', 'organizer', 'Organizer', 'hash', 'organizer', 0, 1, 1, 1),
					('participant', 'participant', 'Participant', 'hash', 'participant', 1, 1, 1, 1);
				INSERT INTO sessions (id, user_id) VALUES ('session', 'participant');
				INSERT INTO assignments (id, giver_id, receiver_id)
				VALUES ('assignment', 'organizer', 'participant');
			`);
			const migration = readFileSync(
				resolve(process.cwd(), 'drizzle/0006_account_avatars.sql'),
				'utf8'
			);
			client.exec(migration);

			expect(
				client
					.prepare(
						'SELECT id, username, display_name AS displayName, avatar_key AS avatarKey, avatar_mime_type AS avatarMimeType FROM users ORDER BY id'
					)
					.all()
			).toEqual([
				{
					id: 'organizer',
					username: 'organizer',
					displayName: 'Organizer',
					avatarKey: null,
					avatarMimeType: null
				},
				{
					id: 'participant',
					username: 'participant',
					displayName: 'Participant',
					avatarKey: null,
					avatarMimeType: null
				}
			]);
			expect(client.prepare('SELECT id FROM sessions').all()).toEqual([{ id: 'session' }]);
			expect(client.prepare('SELECT id FROM assignments').all()).toEqual([{ id: 'assignment' }]);
			expect(client.pragma('foreign_key_check')).toEqual([]);
		} finally {
			client.close();
		}
	});
});
