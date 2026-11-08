import { describe, expect, it } from 'vitest';
import {
	generateSecretSantaAssignments,
	validateSecretSantaAssignments,
	type AssignmentParticipant
} from './assignment-algorithm.js';

describe('Secret Santa assignment algorithm', () => {
	it('creates a complete randomized matching across households', () => {
		const participants: AssignmentParticipant[] = [
			{ id: 'alice', householdId: 'home-a' },
			{ id: 'bob', householdId: 'home-a' },
			{ id: 'carol', householdId: 'home-b' },
			{ id: 'dave', householdId: 'home-b' },
			{ id: 'erin', householdId: 'home-c' },
			{ id: 'frank', householdId: 'home-c' },
			{ id: 'grace', householdId: null },
			{ id: 'heidi', householdId: null }
		];

		for (let attempt = 0; attempt < 20; attempt += 1) {
			const assignments = generateSecretSantaAssignments(participants);
			if (!assignments) throw new Error('Expected a valid assignment to be generated.');
			expect(assignments).toHaveLength(participants.length);
			expect(validateSecretSantaAssignments(participants, assignments)).toEqual({ valid: true });

			const receivers = new Set(assignments.map((assignment) => assignment.receiverId));
			expect(receivers.size).toBe(participants.length);
			for (const assignment of assignments) {
				expect(assignment.giverId).not.toBe(assignment.receiverId);
				const giver = participants.find((participant) => participant.id === assignment.giverId);
				const receiver = participants.find(
					(participant) => participant.id === assignment.receiverId
				);
				expect(giver).toBeDefined();
				expect(receiver).toBeDefined();
				if (giver?.householdId) {
					expect(giver.householdId).not.toBe(receiver?.householdId);
				}
			}
		}
	});

	it('reports configurations with impossible household constraints', () => {
		const participants: AssignmentParticipant[] = [
			{ id: 'alice', householdId: 'home-a' },
			{ id: 'bob', householdId: 'home-a' },
			{ id: 'carol', householdId: 'home-a' },
			{ id: 'dave', householdId: 'home-b' }
		];

		expect(generateSecretSantaAssignments(participants)).toBeNull();
	});

	it('requires at least two unique participants', () => {
		expect(generateSecretSantaAssignments([{ id: 'alice', householdId: null }])).toBeNull();
		expect(() =>
			generateSecretSantaAssignments([
				{ id: 'alice', householdId: null },
				{ id: 'alice', householdId: null }
			])
		).toThrow('Assignment participants must have unique identifiers.');
	});

	it('validates complete one-to-one assignments and rejects self or household matches', () => {
		const participants: AssignmentParticipant[] = [
			{ id: 'alice', householdId: 'home-a' },
			{ id: 'bob', householdId: 'home-a' },
			{ id: 'carol', householdId: 'home-b' }
		];

		expect(
			validateSecretSantaAssignments(participants, [
				{ giverId: 'alice', receiverId: 'bob' },
				{ giverId: 'bob', receiverId: 'carol' },
				{ giverId: 'carol', receiverId: 'alice' }
			])
		).toMatchObject({ valid: false });
	});
});
