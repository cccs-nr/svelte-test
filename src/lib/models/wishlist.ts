import { z } from 'zod';

function isSafeExternalUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			(url.protocol === 'http:' || url.protocol === 'https:') &&
			url.hostname.length > 0 &&
			url.username.length === 0 &&
			url.password.length === 0
		);
	} catch {
		return false;
	}
}

const externalUrlSchema = z
	.union([
		z.literal(''),
		z.string().trim().max(2048).refine(isSafeExternalUrl, 'Enter a valid HTTP or HTTPS URL.')
	])
	.nullable()
	.optional()
	.transform((value) => value || null);

const estimatedPriceSchema = z
	.union([
		z.literal(''),
		z
			.string()
			.trim()
			.regex(/^\d{1,9}(?:\.\d{1,2})?$/, 'Enter a price with up to two decimal places.')
	])
	.default('')
	.transform((value) => {
		if (!value) return null;
		const [dollars, cents = ''] = value.split('.');
		return Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
	});

const suggestionFieldsSchema = z.object({
	title: z.string().trim().min(1).max(120),
	description: z.string().trim().max(2000).default(''),
	url: externalUrlSchema,
	estimatedPrice: estimatedPriceSchema,
	notes: z.string().trim().max(2000).default('')
});

function transformSuggestionInput<
	T extends {
		title: string;
		description: string;
		url: string | null;
		estimatedPrice: number | null;
		notes: string;
	}
>({ estimatedPrice, ...suggestion }: T) {
	return { ...suggestion, estimatedPriceCents: estimatedPrice };
}

export const createGiftSuggestionInputSchema =
	suggestionFieldsSchema.transform(transformSuggestionInput);
export const updateGiftSuggestionInputSchema = suggestionFieldsSchema
	.extend({ id: z.string().uuid() })
	.transform(transformSuggestionInput);
export const deleteGiftSuggestionInputSchema = z.object({ id: z.string().uuid() });

export type GiftSuggestionInput = z.infer<typeof createGiftSuggestionInputSchema>;
