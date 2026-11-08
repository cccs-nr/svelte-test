import { describe, expect, it } from 'vitest';
import { createGiftSuggestionInputSchema } from './wishlist.js';

describe('wishlist suggestion input', () => {
	it('normalizes text and parses an optional CAD price into cents', () => {
		expect(
			createGiftSuggestionInputSchema.parse({
				title: '  Warm socks  ',
				description: '  Wool blend  ',
				url: 'https://shop.example/socks',
				estimatedPrice: '24.50',
				notes: '  Size medium  '
			})
		).toMatchObject({
			title: 'Warm socks',
			description: 'Wool blend',
			url: 'https://shop.example/socks',
			estimatedPriceCents: 2450,
			notes: 'Size medium'
		});
	});

	it('accepts a text-only suggestion without a price', () => {
		expect(createGiftSuggestionInputSchema.parse({ title: 'Board game' })).toMatchObject({
			url: null,
			estimatedPriceCents: null
		});
	});

	it('rejects unsafe URLs and invalid prices', () => {
		expect(() =>
			createGiftSuggestionInputSchema.parse({ title: 'Gift', url: 'javascript:alert(1)' })
		).toThrow();
		expect(() =>
			createGiftSuggestionInputSchema.parse({
				title: 'Gift',
				url: 'https://user:pass@shop.example'
			})
		).toThrow();
		expect(() =>
			createGiftSuggestionInputSchema.parse({ title: 'Gift', estimatedPrice: '12.999' })
		).toThrow();
	});
});
