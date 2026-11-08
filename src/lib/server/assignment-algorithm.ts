import { randomInt } from 'node:crypto';

export interface AssignmentParticipant {
	id: string;
	householdId: string | null;
}

export interface GeneratedAssignment {
	giverId: string;
	receiverId: string;
}

function shuffled<T>(values: readonly T[]): T[] {
	const result = [...values];

	for (let index = result.length - 1; index > 0; index -= 1) {
		const swapIndex = randomInt(index + 1);
		[result[index], result[swapIndex]] = [result[swapIndex], result[index]];
	}

	return result;
}

export function generateSecretSantaAssignments(
	participants: readonly AssignmentParticipant[]
): GeneratedAssignment[] | null {
	const participantIds = participants.map((participant) => participant.id);
	if (new Set(participantIds).size !== participantIds.length) {
		throw new Error('Assignment participants must have unique identifiers.');
	}
	if (participants.length < 2) return null;

	const candidatesByGiver = new Map<string, string[]>();

	for (const giver of participants) {
		const candidates = shuffled(
			participants
				.filter(
					(receiver) =>
						receiver.id !== giver.id &&
						(!giver.householdId || receiver.householdId !== giver.householdId)
				)
				.map((receiver) => receiver.id)
		);

		if (candidates.length === 0) return null;
		candidatesByGiver.set(giver.id, candidates);
	}

	const giverByReceiver = new Map<string, string>();

	function findAugmentingPath(giverId: string, visitedReceivers: Set<string>): boolean {
		for (const receiverId of candidatesByGiver.get(giverId) ?? []) {
			if (visitedReceivers.has(receiverId)) continue;
			visitedReceivers.add(receiverId);

			const previousGiver = giverByReceiver.get(receiverId);
			if (previousGiver === undefined || findAugmentingPath(previousGiver, visitedReceivers)) {
				giverByReceiver.set(receiverId, giverId);
				return true;
			}
		}

		return false;
	}

	for (const giverId of shuffled(participantIds)) {
		if (!findAugmentingPath(giverId, new Set())) return null;
	}

	if (giverByReceiver.size !== participants.length) return null;

	return [...giverByReceiver].map(([receiverId, giverId]) => ({ giverId, receiverId }));
}

export function validateSecretSantaAssignments(
	participants: readonly AssignmentParticipant[],
	assignments: readonly GeneratedAssignment[]
): { valid: true } | { valid: false; reason: string } {
	if (participants.length < 2) {
		return { valid: false, reason: 'At least two active participants are required.' };
	}
	if (assignments.length !== participants.length) {
		return { valid: false, reason: 'Every active participant must have exactly one assignment.' };
	}

	const participantById = new Map(participants.map((participant) => [participant.id, participant]));
	const givers = new Set<string>();
	const receivers = new Set<string>();

	for (const assignment of assignments) {
		const giver = participantById.get(assignment.giverId);
		const receiver = participantById.get(assignment.receiverId);

		if (!giver || !receiver) {
			return { valid: false, reason: 'Assignments must only include active participants.' };
		}
		if (givers.has(giver.id) || receivers.has(receiver.id)) {
			return { valid: false, reason: 'Every participant must give and receive exactly once.' };
		}
		if (giver.id === receiver.id) {
			return { valid: false, reason: 'Participants cannot be assigned to themselves.' };
		}
		if (giver.householdId && giver.householdId === receiver.householdId) {
			return { valid: false, reason: 'Participants cannot draw someone in their household.' };
		}

		givers.add(giver.id);
		receivers.add(receiver.id);
	}

	return { valid: true };
}
