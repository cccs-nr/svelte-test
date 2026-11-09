import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('wishlist conversation migration', () => {
	it('preserves both legacy message histories and repairs invalid Gift Coordination membership', () => {
		const client = new Database(':memory:');
		try {
			client.pragma('foreign_keys = ON');
			client.exec(`
				CREATE TABLE events (
					id TEXT PRIMARY KEY,
					revealed_at INTEGER
				);
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
				CREATE TABLE conversations (
					id TEXT PRIMARY KEY,
					assignment_id TEXT NOT NULL REFERENCES assignments(id),
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL
				);
				CREATE TABLE messages (
					id TEXT PRIMARY KEY,
					conversation_id TEXT NOT NULL REFERENCES conversations(id),
					sender_side TEXT NOT NULL,
					content TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					giver_read_at INTEGER,
					recipient_read_at INTEGER
				);
				CREATE TABLE gift_conversations (
					id TEXT PRIMARY KEY,
					event_id TEXT NOT NULL REFERENCES events(id),
					recipient_id TEXT NOT NULL REFERENCES users(id),
					type TEXT NOT NULL,
					created_at INTEGER NOT NULL,
					updated_at INTEGER NOT NULL
				);
				CREATE TABLE gift_conversation_participants (
					conversation_id TEXT NOT NULL REFERENCES gift_conversations(id),
					user_id TEXT NOT NULL REFERENCES users(id),
					joined_at INTEGER NOT NULL,
					PRIMARY KEY (conversation_id, user_id)
				);
				CREATE TABLE gift_conversation_reads (
					conversation_id TEXT NOT NULL REFERENCES gift_conversations(id),
					user_id TEXT NOT NULL REFERENCES users(id),
					last_read_at INTEGER NOT NULL,
					PRIMARY KEY (conversation_id, user_id)
				);
				CREATE TABLE gift_messages (
					id TEXT PRIMARY KEY,
					conversation_id TEXT NOT NULL REFERENCES gift_conversations(id),
					sender_id TEXT NOT NULL REFERENCES users(id),
					content TEXT NOT NULL,
					created_at INTEGER NOT NULL
				);
				INSERT INTO events (id, revealed_at) VALUES ('main', NULL);
				INSERT INTO users (id, display_name, is_active, role, is_participating) VALUES
					('alice', 'Alice', 1, 'participant', 1),
					('bob', 'Bob', 1, 'participant', 1),
					('carol', 'Carol', 1, 'participant', 1),
					('inactive', 'Inactive', 0, 'participant', 0);
				INSERT INTO assignments
					(id, event_id, giver_id, receiver_id, created_at, finalized_at)
				VALUES ('alice-assignment', 'main', 'alice', 'bob', 10, 20);
				INSERT INTO conversations (id, assignment_id, created_at, updated_at)
				VALUES ('legacy-santa', 'alice-assignment', 11, 12);
				INSERT INTO messages
					(id, conversation_id, sender_side, content, created_at, giver_read_at, recipient_read_at)
				VALUES ('santa-message', 'legacy-santa', 'giver', 'A private question.', 30, 30, NULL);
				INSERT INTO gift_conversations
					(id, event_id, recipient_id, type, created_at, updated_at)
				VALUES
					('legacy-discussion', 'main', 'bob', 'recipient_visible', 40, 41),
					('legacy-coordination', 'main', 'bob', 'private_coordination', 50, 51);
				INSERT INTO gift_conversation_participants
					(conversation_id, user_id, joined_at)
				VALUES
					('legacy-discussion', 'alice', 41),
					('legacy-discussion', 'carol', 42),
					('legacy-coordination', 'alice', 51),
					('legacy-coordination', 'bob', 51),
					('legacy-coordination', 'carol', 52),
					('legacy-coordination', 'inactive', 53);
				INSERT INTO gift_conversation_reads (conversation_id, user_id, last_read_at)
				VALUES
					('legacy-discussion', 'alice', 42),
					('legacy-discussion', 'carol', 42),
					('legacy-coordination', 'alice', 52),
					('legacy-coordination', 'bob', 52),
					('legacy-coordination', 'carol', 52),
					('legacy-coordination', 'inactive', 53);
				INSERT INTO gift_messages
					(id, conversation_id, sender_id, content, created_at)
				VALUES
					('discussion-message', 'legacy-discussion', 'alice', 'Which color?', 60),
					('coordination-message', 'legacy-coordination', 'carol', 'I bought it.', 70);
			`);

			const migration = readFileSync(
				resolve(process.cwd(), 'drizzle/0010_aromatic_terror.sql'),
				'utf8'
			);
			client.exec(migration);

			const conversations = client
				.prepare(
					'SELECT id, wishlist_owner_id AS ownerId, conversation_type AS type, title, assignment_id AS assignmentId, last_message_at AS lastMessageAt FROM wishlist_conversations ORDER BY type'
				)
				.all();
			expect(conversations).toHaveLength(3);
			expect(conversations).toContainEqual({
				id: 'legacy-discussion',
				ownerId: 'bob',
				type: 'wishlist_discussion',
				title: "Bob's Wishlist — Wishlist Discussion",
				assignmentId: null,
				lastMessageAt: 60
			});
			expect(conversations).toContainEqual({
				id: 'legacy-coordination',
				ownerId: 'bob',
				type: 'gift_coordination',
				title: "Bob's Wishlist — Gift Coordination",
				assignmentId: null,
				lastMessageAt: 70
			});

			const messages = client
				.prepare('SELECT id, sender_id AS senderId, content FROM wishlist_messages ORDER BY id')
				.all();
			expect(messages).toEqual([
				{
					id: 'gift:coordination-message',
					senderId: 'carol',
					content: 'I bought it.'
				},
				{
					id: 'gift:discussion-message',
					senderId: 'alice',
					content: 'Which color?'
				},
				{
					id: 'santa:santa-message',
					senderId: 'alice',
					content: 'A private question.'
				}
			]);

			const coordinationMembers = client
				.prepare(
					'SELECT user_id AS userId FROM wishlist_conversation_participants WHERE conversation_id = ? ORDER BY user_id'
				)
				.all('legacy-coordination');
			expect(coordinationMembers).toEqual([{ userId: 'alice' }, { userId: 'carol' }]);
			const santaReadMarkers = client
				.prepare(
					'SELECT user_id AS userId, last_read_at AS lastReadAt FROM wishlist_conversation_participants WHERE conversation_id = (SELECT id FROM wishlist_conversations WHERE conversation_type = ?) ORDER BY user_id'
				)
				.all('secret_santa');
			expect(santaReadMarkers).toEqual([
				{ userId: 'alice', lastReadAt: 30 },
				{ userId: 'bob', lastReadAt: 0 }
			]);
			const discussionMembers = client
				.prepare(
					'SELECT user_id AS userId FROM wishlist_conversation_participants WHERE conversation_id = ? ORDER BY user_id'
				)
				.all('legacy-discussion');
			expect(discussionMembers).toEqual([
				{ userId: 'alice' },
				{ userId: 'bob' },
				{ userId: 'carol' }
			]);
			expect(
				client
					.prepare('SELECT related_user_id AS userId, reason FROM conversation_migration_reviews')
					.all()
			).toEqual([
				{
					userId: 'bob',
					reason: 'Wishlist owner was removed from Gift Coordination membership.'
				},
				{
					userId: 'inactive',
					reason: 'Inactive or non-participating member was removed during migration.'
				}
			]);
			expect(client.prepare('SELECT id FROM messages').all()).toEqual([{ id: 'santa-message' }]);
			expect(client.prepare('SELECT id FROM gift_messages').all()).toHaveLength(2);
			expect(client.pragma('foreign_key_check')).toEqual([]);
		} finally {
			client.close();
		}
	});
});
