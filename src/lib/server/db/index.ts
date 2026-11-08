import { DATABASE_URL } from '$app/env/private';
import { createDatabase } from './connection.js';

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

export const { client, db } = createDatabase(DATABASE_URL);
