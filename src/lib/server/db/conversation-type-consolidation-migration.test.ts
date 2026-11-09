import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('conversation type consolidation migration', () => {
	it('merges assigned-Santa and Wishlist Discussion history into one wishlist discussion', () => {
		const client = new Database(':memory:');
		try {
			client.pragma('foreign_keys = ON');
			client.exec(`
				CREATE TABLE events (id TEXT PRIMARY KEY);
				CREATE TABLE users (
					id TEXT PRIMARY KEY,
					display_name TEXT NOT NULL,
					is_active INTEGER NOT NULL,
					role TEXT NOT NULL,
					is_participating INTEGER NOT NULL
				);
				CREATE TABLE assignments (
					id TEXT PRIMARY KEY,
					event_id TEXT NOT NULL REFERENCES events(id),
					giver_id TEXT NOT NULL REFERENCES users(id),
					receiver_id TEXT NOT NULL REFERENCES users(id),
					created_at INTEGER NOT NULL,
					finalized_at INTEGER
				);
				CREATE TABLE wishlist_conversations (
					id TEXT PRIMARY KEY,
					event_id TEXT NOT NULL REFERENCES events(id),
					wishlist_owner_id TEXT NOT NULL REFERENCES users(id),
					conversation_type TEXT NOT NULL,
					title TEXT NOT NULL,
					assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL,
					last_message_at INTEGER,
					UNIQUE (event_id, wishlist_owner_id, conversation_type),
					CHECK (conversation_type IN ('wishlist_discussion', 'gift_coordination', 'secret_santa'))
				);
				CREATE TABLE wishlist_conversation_participants (
					conversation_id TEXT NOT NULL REFERENCES wishlist_conversations(id) ON DELETE CASCADE,
					user_id TEXT NOT NULL REFERENCES users(id),
					joined_at INTEGER NOT NULL,
					last_read_at INTEGER NOT NULL,
					PRIMARY KEY (conversation_id, user_id)
				);
				CREATE TABLE wishlist_messages (
					id TEXT PRIMARY KEY,
					conversation_id TEXT NOT NULL REFERENCES wishlist_conversations(id) ON DELETE CASCADE,
					sender_id TEXT NOT NULL REFERENCES users(id),
					content TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					edited_at INTEGER
				);
				CREATE TABLE conversation_migration_reviews (
					id TEXT PRIMARY KEY,
					legacy_source TEXT NOT NULL,
					legacy_conversation_id TEXT NOT NULL,
					related_user_id TEXT REFERENCES users(id),
					reason TEXT NOT NULL,
					created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
					resolved_at INTEGER
				);
				INSERT INTO events (id) VALUES ('main');
				INSERT INTO users (id, display_name, is_active, role, is_participating) VALUES
					('alice', 'Alice', 1, 'participant', 1),
					('bob', 'Bob', 1, 'participant', 1),
					('carol', 'Carol', 1, 'participant', 1);
				INSERT INTO assignments
					(id, event_id, giver_id, receiver_id, created_at, finalized_at)
				VALUES ('alice-assignment', 'main', 'alice', 'bob', 1, 2);
				INSERT INTO wishlist_conversations (
					id, event_id, wishlist_owner_id, conversation_type, title, assignment_id,
					created_at, updated_at, last_message_at
				) VALUES
					('santa-thread', 'main', 'bob', 'secret_santa', 'Bob’s Wishlist — Secret Santa', 'alice-assignment', 10, 200, 200),
					('discussion-thread', 'main', 'bob', 'wishlist_discussion', 'Bob’s Wishlist — Wishlist Discussion', NULL, 20, 300, 150),
					('coordination-thread', 'main', 'bob', 'gift_coordination', 'Bob’s Wishlist — Gift Coordination', NULL, 30, 40, 35);
				INSERT INTO wishlist_conversation_participants
					(conversation_id, user_id, joined_at, last_read_at)
				VALUES
					('santa-thread', 'alice', 10, 120),
					('santa-thread', 'bob', 10, 0),
					('discussion-thread', 'alice', 20, 250),
					('discussion-thread', 'bob', 20, 250),
					('discussion-thread', 'carol', 25, 100),
					('coordination-thread', 'alice', 30, 0),
					('coordination-thread', 'carol', 30, 0);
				INSERT INTO wishlist_messages
					(id, conversation_id, sender_id, content, created_at)
				VALUES
					('santa-message', 'santa-thread', 'alice', 'Is local tea okay?', 100),
					('discussion-message', 'discussion-thread', 'carol', 'I can buy tea.', 150),
					('owner-message', 'discussion-thread', 'bob', 'Local tea is great.', 200),
					('coordination-message', 'coordination-thread', 'carol', 'I have it reserved.', 35);
			`);

			const migration = readFileSync(
				resolve(process.cwd(), 'drizzle/0011_curved_silver_centurion.sql'),
				'utf8'
			);
			client.exec(migration);

			const conversations = client
				.prepare(
					'SELECT id, conversation_type AS type, title, last_message_at AS lastMessageAt FROM wishlist_conversations ORDER BY type'
				)
				.all();
			expect(conversations).toEqual([
				{
					id: 'coordination-thread',
					type: 'gift_coordination',
					title: 'Bob — Private gift planning',
					lastMessageAt: 35
				},
				{
					id: 'discussion-thread',
					type: 'wishlist_discussion',
					title: 'Bob — Talk to Bob',
					lastMessageAt: 200
				}
			]);
			expect(
				client
					.prepare(
						'SELECT id, conversation_id AS conversationId, sender_id AS senderId FROM wishlist_messages ORDER BY created_at'
					)
					.all()
			).toEqual([
				{ id: 'coordination-message', conversationId: 'coordination-thread', senderId: 'carol' },
				{ id: 'santa-message', conversationId: 'discussion-thread', senderId: 'alice' },
				{ id: 'discussion-message', conversationId: 'discussion-thread', senderId: 'carol' },
				{ id: 'owner-message', conversationId: 'discussion-thread', senderId: 'bob' }
			]);

			const discussionMembers = client
				.prepare(
					'SELECT user_id AS userId, last_read_at AS lastReadAt FROM wishlist_conversation_participants WHERE conversation_id = ? ORDER BY user_id'
				)
				.all('discussion-thread');
			expect(discussionMembers).toEqual([
				{ userId: 'alice', lastReadAt: 120 },
				{ userId: 'bob', lastReadAt: 0 },
				{ userId: 'carol', lastReadAt: 0 }
			]);
			expect(
				client
					.prepare(
						"SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'wishlist_conversations'"
					)
					.get()
			).toEqual({ count: 1 });
			expect(
				client
					.prepare(
						"SELECT COUNT(*) AS count FROM pragma_table_info('wishlist_conversations') WHERE name = 'assignment_id'"
					)
					.get()
			).toEqual({ count: 0 });
			expect(client.pragma('foreign_key_check')).toEqual([]);
		} finally {
			client.close();
		}
	});
});
