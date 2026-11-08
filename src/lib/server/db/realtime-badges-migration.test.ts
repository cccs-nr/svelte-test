import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('realtime badge migration', () => {
	it('adds nullable read markers without changing existing gift purchase status', () => {
		const client = new Database(':memory:');
		try {
			client.exec(`
				CREATE TABLE assignments (
					id TEXT PRIMARY KEY,
					event_id TEXT NOT NULL,
					giver_id TEXT NOT NULL,
					receiver_id TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					finalized_at INTEGER,
					gift_purchased_at INTEGER
				);
				INSERT INTO assignments
					(id, event_id, giver_id, receiver_id, created_at, finalized_at, gift_purchased_at)
				VALUES
					('assignment', 'main', 'giver', 'receiver', 1, 2, 3);
			`);
			const migration = readFileSync(
				resolve(process.cwd(), 'drizzle/0008_bitter_oracle.sql'),
				'utf8'
			);
			client.exec(migration);

			expect(
				client
					.prepare(
						'SELECT gift_purchased_at AS giftPurchasedAt, giver_wishlist_viewed_at AS wishlistViewedAt, receiver_gift_status_seen_at AS statusSeenAt FROM assignments WHERE id = ?'
					)
					.get('assignment')
			).toEqual({ giftPurchasedAt: 3, wishlistViewedAt: null, statusSeenAt: null });
		} finally {
			client.close();
		}
	});
});
