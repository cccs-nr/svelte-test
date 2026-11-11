import 'dotenv/config';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import Database from 'better-sqlite3';

const args = new Set(process.argv.slice(2));
const knownFlags = new Set(['--yes', '--keep-uploads', '--create-organizer', '--help']);
const unknownFlags = [...args].filter((arg) => !knownFlags.has(arg));

if (args.has('--help') || unknownFlags.length > 0) {
	if (unknownFlags.length > 0) console.error(`Unknown option: ${unknownFlags.join(', ')}\n`);
	console.info(`Erase ALL Secret Santa data and start from scratch.

Usage: node --experimental-strip-types scripts/reset-database.mjs [options]

  --yes                Do not ask for confirmation.
  --keep-uploads       Keep uploaded avatars and wishlist images.
  --create-organizer   Create a new organizer afterwards from the
                       INITIAL_ORGANIZER_DISPLAY_NAME / INITIAL_ORGANIZER_PASSWORD variables.`);
	process.exit(unknownFlags.length > 0 ? 1 : 0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set.');
const databasePath = isAbsolute(databaseUrl) ? databaseUrl : resolve(process.cwd(), databaseUrl);
const uploadsUrl = process.env.UPLOADS_DIR;
const uploadsPath = uploadsUrl
	? isAbsolute(uploadsUrl)
		? uploadsUrl
		: resolve(process.cwd(), uploadsUrl)
	: null;

if (!args.has('--yes')) {
	if (!process.stdin.isTTY) {
		console.error('Refusing to erase data without confirmation. Re-run with --yes.');
		process.exit(1);
	}
	const prompt = createInterface({ input: process.stdin, output: process.stdout });
	const answer = await prompt.question(
		`This permanently erases ALL accounts, wishlists, messages and the draw in\n${databasePath}\nType RESET to continue: `
	);
	prompt.close();
	if (answer.trim() !== 'RESET') {
		console.info('Cancelled. Nothing was changed.');
		process.exit(0);
	}
}

if (!existsSync(databasePath)) {
	console.info(`No database found at ${databasePath}. Run "pnpm db:migrate" to create it.`);
	process.exit(0);
}

// Rows are emptied instead of deleting the file so a running server keeps working.
const client = new Database(databasePath);
client.pragma('busy_timeout = 5000');
client.pragma('foreign_keys = OFF');

try {
	const tables = client
		.prepare(
			`select name from sqlite_master
			 where type = 'table' and name not like 'sqlite_%' and name not like '\\_\\_drizzle%' escape '\\'`
		)
		.all()
		.map((row) => row.name);

	client.transaction(() => {
		for (const table of tables) client.exec(`delete from "${table.replaceAll('"', '""')}"`);
	})();

	const violations = client.pragma('foreign_key_check');
	if (violations.length > 0) throw new Error('The database is inconsistent after the reset.');

	client.pragma('wal_checkpoint(TRUNCATE)');
	client.exec('vacuum');
	console.info(`Erased ${tables.length} tables in ${databasePath}.`);
} finally {
	client.close();
}

if (!args.has('--keep-uploads') && uploadsPath && existsSync(uploadsPath)) {
	for (const entry of readdirSync(uploadsPath)) {
		rmSync(join(uploadsPath, entry), { recursive: true, force: true });
	}
	console.info(`Removed uploaded images from ${uploadsPath}.`);
}

if (args.has('--create-organizer')) {
	await import('./create-organizer.mjs');
} else {
	console.info(
		'Done. Create a new organizer with "pnpm db:create-organizer" (or re-run with --create-organizer).'
	);
}
