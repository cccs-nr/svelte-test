import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectImageMimeType, readImage, removeImage, storeImage } from './image-storage.js';

let temporaryDirectory: string | undefined;

afterEach(async () => {
	if (temporaryDirectory) {
		await rm(temporaryDirectory, { recursive: true, force: true });
		temporaryDirectory = undefined;
	}
});

function pngBytes(): Uint8Array {
	const bytes = new Uint8Array(45);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	bytes.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
	bytes.set([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x06, 0x00, 0x00, 0x00], 16);
	bytes.set([0x00, 0x00, 0x00, 0x00], 29);
	bytes.set([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], 33);
	return bytes;
}

function webpBytes(): Uint8Array {
	const bytes = new Uint8Array(30);
	bytes.set([0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
	bytes.set([0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00], 12);
	return bytes;
}

describe('local image storage', () => {
	it('detects supported image content and rejects extension-only or unsupported content', () => {
		expect(detectImageMimeType(pngBytes())).toBe('image/png');
		expect(detectImageMimeType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]))).toBe(
			'image/jpeg'
		);
		expect(detectImageMimeType(webpBytes())).toBe('image/webp');
		expect(
			detectImageMimeType(
				Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
			)
		).toBeNull();
		expect(detectImageMimeType(new TextEncoder().encode('<svg></svg>'))).toBeNull();
	});

	it('stores images under generated names, reads them, and removes them', async () => {
		temporaryDirectory = await mkdtemp(join(tmpdir(), 'secret-santa-wishlist-'));
		const bytes = pngBytes();
		const imageKey = await storeImage(bytes, 'image/png', temporaryDirectory);

		expect(imageKey).toMatch(/^[0-9a-f-]{36}$/i);
		expect(await readImage(imageKey, 'image/png', temporaryDirectory)).toEqual(Buffer.from(bytes));
		expect((await readFile(join(temporaryDirectory, `${imageKey}.png`))).byteLength).toBe(
			bytes.length
		);

		await removeImage(imageKey, 'image/png', temporaryDirectory);
		await expect(readImage(imageKey, 'image/png', temporaryDirectory)).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('rejects path traversal identifiers before touching the filesystem', async () => {
		temporaryDirectory = await mkdtemp(join(tmpdir(), 'secret-santa-wishlist-'));

		await expect(readImage('../outside', 'image/png', temporaryDirectory)).rejects.toThrow(
			'Invalid wishlist image identifier.'
		);
	});
});
