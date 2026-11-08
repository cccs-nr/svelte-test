import { z } from 'zod';

export const messageDirectionSchema = z.enum(['asGiver', 'asRecipient']);

export const sendMessageInputSchema = z.object({
	direction: messageDirectionSchema,
	content: z.string().trim().min(1).max(2000)
});

export const markMessagesReadInputSchema = z.object({
	direction: messageDirectionSchema,
	throughCreatedAt: z.string().datetime()
});

export type MessageDirection = z.infer<typeof messageDirectionSchema>;
