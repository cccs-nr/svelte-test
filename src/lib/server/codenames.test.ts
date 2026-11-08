import { describe, expect, it } from 'vitest';
import { generateCodenames, suggestedCodenames } from './codenames.js';

describe('participant codenames', () => {
	it('provides exactly 50 unique suggested codenames', () => {
		expect(suggestedCodenames).toHaveLength(50);
		expect(new Set(suggestedCodenames).size).toBe(50);
	});

	it('uses the illustrated list before generating overflow names', () => {
		const generated = generateCodenames(
			Array.from({ length: 25 }, (_, index) => `user-${index}`),
			[],
			() => 0
		);
		const suggested = new Set<string>(suggestedCodenames);

		expect(generated.every(({ codename }) => suggested.has(codename))).toBe(true);
	});

	it('generates unique Christmas-themed names beyond the suggested list', () => {
		const generated = generateCodenames(
			Array.from({ length: 55 }, (_, index) => `user-${index}`),
			[],
			() => 0
		);
		const names = generated.map(({ codename }) => codename.toLocaleLowerCase('en'));

		expect(generated).toHaveLength(55);
		expect(new Set(names).size).toBe(55);
		expect(names.some((name) => name.includes(' '))).toBe(true);
	});

	it('does not reuse existing codenames and deduplicates participant identifiers', () => {
		const generated = generateCodenames(['alice', 'alice', 'bob'], ['Frosty'], () => 0);

		expect(generated).toHaveLength(2);
		expect(generated.map(({ userId }) => userId)).toEqual(['alice', 'bob']);
		expect(generated.every(({ codename }) => codename !== 'Frosty')).toBe(true);
	});

	it('keeps producing unique fallback names when the generated combinations are exhausted', () => {
		const generated = generateCodenames(
			Array.from({ length: 425 }, (_, index) => `user-${index}`),
			[],
			() => 0
		);
		const names = generated.map(({ codename }) => codename.toLocaleLowerCase('en'));

		expect(generated).toHaveLength(425);
		expect(new Set(names).size).toBe(425);
	});
});
