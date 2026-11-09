import { readImage, type ImageMimeType } from '#lib/server/image-storage.js';

function isImageMimeType(value: string): value is ImageMimeType {
	return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

export async function serveProfileImage(
	key: string | null,
	mimeType: string | null
): Promise<Response> {
	if (!key || !mimeType || !isImageMimeType(mimeType)) {
		return new Response('Profile image not found.', { status: 404 });
	}

	let image: Buffer;
	try {
		image = await readImage(key, mimeType);
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
			return new Response('Profile image not found.', { status: 404 });
		}
		throw error;
	}

	return new Response(Uint8Array.from(image), {
		headers: {
			'Content-Type': mimeType,
			'Content-Length': String(image.byteLength),
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
}
