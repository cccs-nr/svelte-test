import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
	it('creates salted scrypt hashes and verifies the password', async () => {
		const password = 'family-exchange-password';
		const firstHash = await hashPassword(password);
		const secondHash = await hashPassword(password);

		expect(firstHash).toMatch(/^scrypt\$32768\$8\$1\$/);
		expect(firstHash).not.toBe(secondHash);
		await expect(verifyPassword(password, firstHash)).resolves.toBe(true);
		await expect(verifyPassword('a-different-password', firstHash)).resolves.toBe(false);
	});

	it('rejects malformed or unsupported hash encodings', async () => {
		await expect(verifyPassword('password', 'not-a-hash')).resolves.toBe(false);
		await expect(verifyPassword('password', 'scrypt$16384$8$1$invalid$invalid')).resolves.toBe(
			false
		);
	});
});
