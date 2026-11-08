interface RateLimitEntry {
	attempts: number;
	resetAt: number;
}

export class LoginRateLimiter {
	private readonly entries = new Map<string, RateLimitEntry>();
	private readonly maxAttempts: number;
	private readonly windowMs: number;
	private readonly maxEntries: number;

	constructor(maxAttempts = 10, windowMs = 15 * 60 * 1000, maxEntries = 10_000) {
		if (maxAttempts < 1 || windowMs < 1 || maxEntries < 1) {
			throw new Error('Rate-limit settings must be positive.');
		}

		this.maxAttempts = maxAttempts;
		this.windowMs = windowMs;
		this.maxEntries = maxEntries;
	}

	allow(key: string, now = Date.now()): boolean {
		this.removeExpiredEntries(now);

		let entry = this.entries.get(key);

		if (!entry) {
			if (this.entries.size >= this.maxEntries) return false;

			entry = { attempts: 0, resetAt: now + this.windowMs };
			this.entries.set(key, entry);
		}

		if (entry.attempts >= this.maxAttempts) return false;

		entry.attempts += 1;
		return true;
	}

	reset(key: string): void {
		this.entries.delete(key);
	}

	private removeExpiredEntries(now: number): void {
		for (const [key, entry] of this.entries) {
			if (entry.resetAt <= now) this.entries.delete(key);
		}
	}
}

export const loginRateLimiter = new LoginRateLimiter();
