import { describe, expect, it } from 'vitest';
import {
	daysUntilExchange,
	eventSettingsInputSchema,
	formatBudgetInput,
	formatEventBudget
} from './event.js';

describe('event settings', () => {
	it('converts CAD dollar input to exact cents', () => {
		const event = eventSettingsInputSchema.parse({
			name: 'Family Exchange',
			exchangeDate: '2026-12-24',
			giftBudget: '75.10',
			status: 'setup'
		});

		expect(event.giftBudgetCents).toBe(7510);
		expect(formatBudgetInput(event.giftBudgetCents)).toBe('75.10');
		expect(formatEventBudget(event.giftBudgetCents, 'CAD')).toContain('75.10');
	});

	it('rejects invalid dates and money precision', () => {
		expect(() =>
			eventSettingsInputSchema.parse({
				name: 'Family Exchange',
				exchangeDate: '2026-02-31',
				giftBudget: '50.00',
				status: 'setup'
			})
		).toThrow();

		expect(() =>
			eventSettingsInputSchema.parse({
				name: 'Family Exchange',
				exchangeDate: '2026-12-24',
				giftBudget: '50.999',
				status: 'setup'
			})
		).toThrow();
	});

	it('calculates the exchange countdown by calendar day', () => {
		expect(daysUntilExchange('2026-12-24', new Date(2026, 11, 23, 12))).toBe(1);
		expect(daysUntilExchange('2026-12-24', new Date(2026, 11, 24, 8))).toBe(0);
		expect(daysUntilExchange('2026-12-24', new Date(2026, 11, 25, 8))).toBe(-1);
	});
});
