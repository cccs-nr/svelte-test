<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { TRPCClientError } from '@trpc/client';
	import type { UserRole } from '#lib/auth.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { trpc } from '#lib/trpc/client.js';

	type Household = {
		id: string;
		name: string;
		memberCount: number;
		members: { id: string; displayName: string }[];
	};
	type ParticipantOption = {
		id: string;
		displayName: string;
		role: UserRole;
		isParticipating: boolean;
		householdId: string | null;
		isActive: boolean;
	};
	type Props = {
		households: Household[];
		participants: ParticipantOption[];
		assignmentsExist: boolean;
	};

	let { households, participants, assignmentsExist }: Props = $props();
	let createDialog = $state<HTMLDialogElement>();
	let editDialog = $state<HTMLDialogElement>();
	let selectedHouseholdId = $state<string | null>(null);
	let createName = $state('');
	let createMemberIds = $state<string[]>([]);
	let editName = $state('');
	let editMemberIds = $state<string[]>([]);
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let participantOptions = $derived(
		participants.filter(
			(participant) => participant.role === 'participant' || participant.isParticipating
		)
	);

	function openCreateDialog(): void {
		createName = '';
		createMemberIds = [];
		errorMessage = null;
		createDialog?.showModal();
	}

	function openEditDialog(household: Household): void {
		selectedHouseholdId = household.id;
		editName = household.name;
		editMemberIds = participants
			.filter((participant) => participant.householdId === household.id)
			.map((participant) => participant.id);
		errorMessage = null;
		editDialog?.showModal();
	}

	function closeDialog(dialog: HTMLDialogElement | undefined): void {
		if (!isSaving) dialog?.close();
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === createDialog) closeDialog(createDialog);
		if (event.target === editDialog) closeDialog(editDialog);
	}

	function selectedNames(ids: string[]): string {
		return ids
			.map((id) => participantOptions.find((participant) => participant.id === id)?.displayName)
			.filter((name): name is string => Boolean(name))
			.join(', ');
	}

	async function createHousehold(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSaving) return;

		isSaving = true;
		errorMessage = null;
		try {
			await trpc.households.create.mutate({
				name: createName,
				participantIds: createMemberIds
			});
			await invalidateAll();
			createDialog?.close();
			notice = 'Household created.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to create the household.';
		} finally {
			isSaving = false;
		}
	}

	async function updateHousehold(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!selectedHouseholdId || isSaving) return;

		isSaving = true;
		errorMessage = null;
		try {
			await trpc.households.update.mutate({
				id: selectedHouseholdId,
				name: editName,
				participantIds: editMemberIds
			});
			await invalidateAll();
			editDialog?.close();
			notice = 'Household updated.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to update the household.';
		} finally {
			isSaving = false;
		}
	}

	async function removeHousehold(): Promise<void> {
		if (!selectedHouseholdId || isSaving) return;
		if (
			!globalThis.confirm(
				'Delete this household? Its participants will remain in the event without a household.'
			)
		) {
			return;
		}

		isSaving = true;
		errorMessage = null;
		try {
			await trpc.households.remove.mutate(selectedHouseholdId);
			await invalidateAll();
			editDialog?.close();
			notice = 'Household deleted.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to delete the household.';
		} finally {
			isSaving = false;
		}
	}
</script>

<Card id="households">
	<CardHeader class="flex flex-row flex-wrap items-center justify-between gap-4">
		<div>
			<CardTitle>Households</CardTitle>
			<CardDescription>
				Use households to prevent participants from drawing someone who lives with them.
			</CardDescription>
		</div>
		<Button type="button" onclick={openCreateDialog}>Create household</Button>
	</CardHeader>
	<CardContent class="space-y-4">
		{#if notice}
			<p class="app-notice" role="status">{notice}</p>
		{/if}
		{#if households.length === 0}
			<p class="text-sm text-stone-600">No households have been created yet.</p>
		{:else}
			<ul class="space-y-3 md:hidden" aria-label="Households">
				{#each households as household (household.id)}
					<li class="app-surface rounded-xl border border-border p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="font-semibold text-foreground">{household.name}</p>
								<p class="mt-1 text-sm text-muted-foreground">
									{household.memberCount}
									{household.memberCount === 1 ? 'member' : 'members'}
								</p>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onclick={() => openEditDialog(household)}
							>
								Edit
							</Button>
						</div>
						<p class="mt-3 border-t border-border pt-3 text-sm text-foreground">
							{household.members.map((member) => member.displayName).join(', ') || 'No members'}
						</p>
					</li>
				{/each}
			</ul>
			<div class="app-table-scroll -mx-2 hidden overflow-x-auto px-2 md:block">
				<table class="w-full min-w-[620px] border-collapse text-left text-sm">
					<thead>
						<tr class="border-b border-stone-200 text-sm tracking-wide text-stone-600 uppercase">
							<th scope="col" class="px-3 py-2 font-medium">Household</th>
							<th scope="col" class="px-3 py-2 font-medium">Members</th>
							<th scope="col" class="px-3 py-2 text-right font-medium">Count</th>
							<th scope="col" class="px-3 py-2 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each households as household (household.id)}
							<tr class="border-b border-stone-100 last:border-0">
								<th scope="row" class="px-3 py-3 font-medium text-stone-950">
									{household.name}
								</th>
								<td class="max-w-md px-3 py-3 text-stone-700">
									{household.members.map((member) => member.displayName).join(', ') || 'No members'}
								</td>
								<td class="px-3 py-3 text-right text-stone-700 tabular-nums">
									{household.memberCount}
								</td>
								<td class="px-3 py-3">
									<Button
										type="button"
										size="sm"
										variant="outline"
										onclick={() => openEditDialog(household)}
									>
										Edit
									</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</CardContent>
</Card>

<dialog
	bind:this={createDialog}
	class="app-dialog m-auto max-h-[92dvh] w-[min(95vw,36rem)] overflow-y-auto rounded-2xl shadow-2xl backdrop:bg-black/60"
	aria-labelledby="create-household-title"
	onclick={handleBackdropClick}
>
	<div class="p-5 sm:p-7">
		<div class="mb-6 flex items-start justify-between gap-4">
			<div>
				<h2 id="create-household-title" class="text-xl font-semibold">Create household</h2>
				<p class="app-hint mt-1 text-sm text-stone-600">
					Choose a name and assign the members who live together.
				</p>
			</div>
			<Button
				type="button"
				variant="outline"
				onclick={() => closeDialog(createDialog)}
				disabled={isSaving}
			>
				Close
			</Button>
		</div>
		{#if errorMessage}
			<p class="app-alert app-alert--error mb-4" role="alert">
				{errorMessage}
			</p>
		{/if}
		<form class="space-y-5" onsubmit={createHousehold}>
			<div class="space-y-2">
				<label class="text-base font-semibold" for="create-household-name">Household name</label>
				<Input
					id="create-household-name"
					bind:value={createName}
					maxlength={80}
					required
					disabled={isSaving}
				/>
			</div>
			<fieldset class="space-y-3">
				<legend class="text-sm font-medium">Select participants</legend>
				{#if assignmentsExist}
					<p class="text-sm text-stone-600">
						Reset assignments before changing household membership.
					</p>
				{/if}
				<div class="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-stone-200 p-3">
					{#each participantOptions as participant (participant.id)}
						<label class="flex items-center gap-3 text-sm text-stone-700">
							<input
								type="checkbox"
								value={participant.id}
								bind:group={createMemberIds}
								disabled={isSaving || assignmentsExist}
							/>
							<span class="min-w-0 flex-1 truncate">{participant.displayName}</span>
							{#if participant.householdId}
								<span class="text-sm text-stone-600">Currently assigned</span>
							{/if}
						</label>
					{/each}
				</div>
				<p class="text-sm text-stone-600">
					{createMemberIds.length} selected{createMemberIds.length
						? `: ${selectedNames(createMemberIds)}`
						: ''}
				</p>
			</fieldset>
			<div class="flex justify-end gap-3">
				<Button
					type="button"
					variant="outline"
					onclick={() => closeDialog(createDialog)}
					disabled={isSaving}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isSaving}>
					{isSaving ? 'Creating…' : 'Create household'}
				</Button>
			</div>
		</form>
	</div>
</dialog>

<dialog
	bind:this={editDialog}
	class="app-dialog m-auto max-h-[92dvh] w-[min(95vw,36rem)] overflow-y-auto rounded-2xl shadow-2xl backdrop:bg-black/60"
	aria-labelledby="edit-household-title"
	onclick={handleBackdropClick}
	onclose={() => (selectedHouseholdId = null)}
>
	<div class="p-5 sm:p-7">
		<div class="mb-6 flex items-start justify-between gap-4">
			<div>
				<h2 id="edit-household-title" class="text-xl font-semibold">Edit household</h2>
				<p class="app-hint mt-1 text-sm text-stone-600">
					Update the household name and membership.
				</p>
			</div>
			<Button
				type="button"
				variant="outline"
				onclick={() => closeDialog(editDialog)}
				disabled={isSaving}
			>
				Close
			</Button>
		</div>
		{#if errorMessage}
			<p class="app-alert app-alert--error mb-4" role="alert">
				{errorMessage}
			</p>
		{/if}
		<form class="space-y-5" onsubmit={updateHousehold}>
			<div class="space-y-2">
				<label class="text-base font-semibold" for="edit-household-name">Household name</label>
				<Input
					id="edit-household-name"
					bind:value={editName}
					maxlength={80}
					required
					disabled={isSaving}
				/>
			</div>
			<fieldset class="space-y-3">
				<legend class="text-sm font-medium">Household members</legend>
				{#if assignmentsExist}
					<p class="text-sm text-stone-600">
						Reset assignments before changing household membership.
					</p>
				{/if}
				<div class="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-stone-200 p-3">
					{#each participantOptions as participant (participant.id)}
						<label class="flex items-center gap-3 text-sm text-stone-700">
							<input
								type="checkbox"
								value={participant.id}
								bind:group={editMemberIds}
								disabled={isSaving || assignmentsExist}
							/>
							<span class="min-w-0 flex-1 truncate">{participant.displayName}</span>
							{#if participant.householdId && participant.householdId !== selectedHouseholdId}
								<span class="text-sm text-stone-600">Currently assigned elsewhere</span>
							{/if}
						</label>
					{/each}
				</div>
				<p class="text-sm text-stone-600">
					{editMemberIds.length} selected{editMemberIds.length
						? `: ${selectedNames(editMemberIds)}`
						: ''}
				</p>
			</fieldset>
			<div class="flex flex-wrap justify-between gap-3">
				<Button type="button" variant="destructive" onclick={removeHousehold} disabled={isSaving}>
					Delete household
				</Button>
				<div class="flex gap-3">
					<Button
						type="button"
						variant="outline"
						onclick={() => closeDialog(editDialog)}
						disabled={isSaving}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={isSaving}>
						{isSaving ? 'Saving…' : 'Save household'}
					</Button>
				</div>
			</div>
		</form>
	</div>
</dialog>
