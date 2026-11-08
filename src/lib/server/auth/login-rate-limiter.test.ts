import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter } from './login-rate-limiter.js';

describe('FixedWindowRateLimiter', () => {
	it('limits attempts per key until the fixed window expires', () => {
		const limiter = new FixedWindowRateLimiter(2, 100, 2);

		expect(limiter.allow('user-a', 0)).toBe(true);
		expect(limiter.allow('user-a', 1)).toBe(true);
		expect(limiter.allow('user-a', 2)).toBe(false);
		expect(limiter.allow('user-b', 10)).toBe(true);
		expect(limiter.allow('user-c', 10)).toBe(false);
		expect(limiter.allow('user-c', 101)).toBe(true);
	});

	it('clears a key after a successful sign-in', () => {
		const limiter = new FixedWindowRateLimiter(1, 100, 1);

		expect(limiter.allow('user-a', 0)).toBe(true);
		expect(limiter.allow('user-a', 1)).toBe(false);
		limiter.reset('user-a');
		expect(limiter.allow('user-a', 2)).toBe(true);
	});

	it('rejects invalid limiter settings', () => {
		expect(() => new FixedWindowRateLimiter(0)).toThrow('Rate-limit settings must be positive.');
	});
});
