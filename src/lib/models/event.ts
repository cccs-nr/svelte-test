import { z } from 'zod';

export const SINGLE_EVENT_ID = 'main';

export const eventStatusSchema = z.enum(['setup', 'open', 'assignments_generated', 'completed']);
export const editableEventStatusSchema = z.enum(['setup', 'open']);

const exchangeDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => {
		const [year, month, day] = value.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
	}, 'Enter a valid exchange date.');

const budgetSchema = z
	.string()
	.trim()
	.regex(/^\d{1,6}(?:\.\d{1,2})?$/, 'Enter an amount with up to two decimal places.')
	.transform((amount) => {
		const [dollars, cents = ''] = amount.split('.');
		return Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
	});

export const eventSettingsInputSchema = z
	.object({
		name: z.string().trim().min(1).max(100),
		description: z.string().trim().max(2000).default(''),
		exchangeDate: exchangeDateSchema,
		giftBudget: budgetSchema,
		instructions: z.string().trim().max(5000).default(''),
		status: editableEventStatusSchema
	})
	.transform(({ giftBudget, ...event }) => ({
		...event,
		giftBudgetCents: giftBudget
	}));

export type EventStatus = z.infer<typeof eventStatusSchema>;
export type EditableEventStatus = z.infer<typeof editableEventStatusSchema>;

export function formatBudgetInput(giftBudgetCents: number): string {
	const dollars = Math.floor(giftBudgetCents / 100);
	const cents = String(giftBudgetCents % 100).padStart(2, '0');
	return `${dollars}.${cents}`;
}

export function formatEventBudget(giftBudgetCents: number, currency: string): string {
	return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(
		giftBudgetCents / 100
	);
}

export function daysUntilExchange(exchangeDate: string, now = new Date()): number {
	const [year, month, day] = exchangeDate.split('-').map(Number);
	const eventDay = new Date(year, month - 1, day);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const millisecondsPerDay = 24 * 60 * 60 * 1000;

	return Math.round((eventDay.getTime() - today.getTime()) / millisecondsPerDay);
}
