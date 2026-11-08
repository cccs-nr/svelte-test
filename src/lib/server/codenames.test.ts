import { describe, expect, it } from 'vitest';
import { generateCodenames } from './codenames.js';

describe('participant codenames', () => {
	it('generates unique Christmas-themed names beyond the suggested list', () => {
		const generated = generateCodenames(
			Array.from({ length: 25 }, (_, index) => `user-${index}`),
			[],
			() => 0
		);
		const names = generated.map(({ codename }) => codename.toLocaleLowerCase('en'));

		expect(generated).toHaveLength(25);
		expect(new Set(names).size).toBe(25);
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
