import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(
			password,
			salt,
			KEY_LENGTH,
			{ N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAX_MEMORY },
			(error, derivedKey) => {
				if (error) {
					reject(error);
					return;
				}

				resolve(derivedKey);
			}
		);
	});
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_LENGTH);
	const key = await deriveKey(password, salt);

	return [
		'scrypt',
		SCRYPT_N,
		SCRYPT_R,
		SCRYPT_P,
		salt.toString('base64url'),
		key.toString('base64url')
	].join('$');
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
	const parts = encodedHash.split('$');

	if (parts.length !== 6) return false;

	const [algorithm, n, r, p, saltValue, keyValue] = parts;

	if (
		algorithm !== 'scrypt' ||
		n !== String(SCRYPT_N) ||
		r !== String(SCRYPT_R) ||
		p !== String(SCRYPT_P)
	) {
		return false;
	}

	const salt = Buffer.from(saltValue, 'base64url');
	const expectedKey = Buffer.from(keyValue, 'base64url');

	if (salt.length !== SALT_LENGTH || expectedKey.length !== KEY_LENGTH) return false;

	const actualKey = await deriveKey(password, salt);
	return timingSafeEqual(actualKey, expectedKey);
}
