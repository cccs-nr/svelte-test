import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('gift purchase status migration', () => {
	it('adds a nullable status without changing existing assignments', () => {
		const client = new Database(':memory:');
		try {
			client.exec(`
				CREATE TABLE assignments (
					id TEXT PRIMARY KEY,
					event_id TEXT NOT NULL,
					giver_id TEXT NOT NULL,
					receiver_id TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					finalized_at INTEGER
				);
				INSERT INTO assignments
					(id, event_id, giver_id, receiver_id, created_at, finalized_at)
				VALUES
					('assignment', 'main', 'giver', 'receiver', 1, 2);
			`);
			const migration = readFileSync(
				resolve(process.cwd(), 'drizzle/0007_sparkling_polaris.sql'),
				'utf8'
			);
			client.exec(migration);

			expect(
				client
					.prepare(
						'SELECT id, giver_id AS giverId, receiver_id AS receiverId, gift_purchased_at AS giftPurchasedAt FROM assignments'
					)
					.all()
			).toEqual([
				{
					id: 'assignment',
					giverId: 'giver',
					receiverId: 'receiver',
					giftPurchasedAt: null
				}
			]);
		} finally {
			client.close();
		}
	});
});
