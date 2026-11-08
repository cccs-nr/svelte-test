import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
	createUsernameCandidate,
	displayNameSchema,
	passwordSchema,
	usernameSchema
} from '../src/lib/auth.ts';
import { hashPassword } from '../src/lib/server/auth/password.ts';
import { users } from '../src/lib/server/db/schema.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set.');

const configuredUsername = process.env.INITIAL_ORGANIZER_USERNAME
	? usernameSchema.parse(process.env.INITIAL_ORGANIZER_USERNAME)
	: null;
const displayName = displayNameSchema.parse(
	process.env.INITIAL_ORGANIZER_DISPLAY_NAME ??
		process.env.INITIAL_ORGANIZER_USERNAME ??
		'Organizer'
);
const password = passwordSchema.parse(process.env.INITIAL_ORGANIZER_PASSWORD ?? '');
const databasePath = isAbsolute(databaseUrl) ? databaseUrl : resolve(process.cwd(), databaseUrl);

mkdirSync(dirname(databasePath), { recursive: true });

const client = new Database(databasePath);
client.pragma('foreign_keys = ON');
const db = drizzle(client, { schema: { users } });
let username = configuredUsername;

try {
	const organizerExists = db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.role, 'organizer'))
		.get();

	if (organizerExists) {
		throw new Error('An organizer account already exists; bootstrap stopped.');
	}

	for (let suffix = 1; !username; suffix += 1) {
		const candidate = createUsernameCandidate(displayName, suffix);
		const existing = db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.username, candidate))
			.get();
		if (!existing) username = candidate;
	}

	db.insert(users)
		.values({
			id: randomUUID(),
			username,
			displayName,
			passwordHash: await hashPassword(password),
			role: 'organizer',
			isParticipating: false
		})
		.run();
} finally {
	client.close();
}

console.info(`Created the organizer account "${username}".`);
