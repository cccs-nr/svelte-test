import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { UPLOADS_DIR } from '$app/env/private';

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

const imageExtensions: Record<ImageMimeType, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
};

const imageKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const pngEndMarker = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

export function getImageDirectory(): string {
	const directory = isAbsolute(UPLOADS_DIR)
		? resolve(UPLOADS_DIR)
		: resolve(process.cwd(), UPLOADS_DIR);
	const sourceDirectory = resolve(process.cwd(), 'src');
	const relativeToSource = relative(sourceDirectory, directory);

	if (
		relativeToSource === '' ||
		(relativeToSource !== '..' &&
			!relativeToSource.startsWith(`..${sep}`) &&
			!isAbsolute(relativeToSource))
	) {
		throw new Error('Uploaded image storage must be outside the application source directory.');
	}

	return directory;
}

export function detectImageMimeType(bytes: Uint8Array): ImageMimeType | null {
	if (
		bytes.length >= 45 &&
		pngSignature.every((byte, index) => bytes[index] === byte) &&
		bytes[8] === 0x00 &&
		bytes[9] === 0x00 &&
		bytes[10] === 0x00 &&
		bytes[11] === 0x0d &&
		bytes[12] === 0x49 &&
		bytes[13] === 0x48 &&
		bytes[14] === 0x44 &&
		bytes[15] === 0x52 &&
		pngEndMarker.every((byte, index) => bytes[bytes.length - pngEndMarker.length + index] === byte)
	) {
		return 'image/png';
	}

	if (
		bytes.length >= 4 &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff &&
		bytes[bytes.length - 2] === 0xff &&
		bytes[bytes.length - 1] === 0xd9
	) {
		return 'image/jpeg';
	}

	if (
		bytes.length >= 20 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		const riffSize = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
		const chunkSize = bytes[16] | (bytes[17] << 8) | (bytes[18] << 16) | (bytes[19] << 24);
		const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
		if (
			riffSize === bytes.length - 8 &&
			['VP8 ', 'VP8L', 'VP8X'].includes(chunkType) &&
			chunkSize > 0 &&
			chunkSize <= bytes.length - 20
		) {
			return 'image/webp';
		}
	}

	return null;
}

function getImagePath(directory: string, imageKey: string, mimeType: ImageMimeType): string {
	if (!imageKeyPattern.test(imageKey)) throw new Error('Invalid wishlist image identifier.');
	const root = resolve(directory);
	const path = resolve(root, `${imageKey}.${imageExtensions[mimeType]}`);
	if (relative(root, path).startsWith(`..${sep}`)) {
		throw new Error('Wishlist image path is outside the configured storage directory.');
	}
	return path;
}

export async function storeImage(
	bytes: Uint8Array,
	mimeType: ImageMimeType,
	directory = getImageDirectory()
): Promise<string> {
	const imageKey = randomUUID();
	await mkdir(directory, { recursive: true, mode: 0o700 });
	await writeFile(getImagePath(directory, imageKey, mimeType), bytes, {
		flag: 'wx',
		mode: 0o600
	});
	return imageKey;
}

export async function readImage(
	imageKey: string,
	mimeType: ImageMimeType,
	directory = getImageDirectory()
): Promise<Buffer> {
	return readFile(getImagePath(directory, imageKey, mimeType));
}

export async function removeImage(
	imageKey: string,
	mimeType: ImageMimeType,
	directory = getImageDirectory()
): Promise<void> {
	try {
		await unlink(getImagePath(directory, imageKey, mimeType));
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
		throw error;
	}
}
