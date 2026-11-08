<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { TRPCClientError } from '@trpc/client';
	import type { PageProps } from './$types';
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

	let { data }: PageProps = $props();
	let households = $derived(data.households);
	let newName = $state('');
	let selectedHouseholdId = $state<string | null>(null);
	let editName = $state('');
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	function selectHousehold(household: (typeof households)[number]): void {
		selectedHouseholdId = household.id;
		editName = household.name;
		errorMessage = null;
		successMessage = null;
	}

	async function createHousehold(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSaving) return;

		isSaving = true;
		errorMessage = null;
		successMessage = null;

		try {
			await trpc.households.create.mutate({ name: newName });
			await invalidateAll();
			newName = '';
			successMessage = 'Household created.';
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
		successMessage = null;

		try {
			await trpc.households.update.mutate({ id: selectedHouseholdId, name: editName });
			await invalidateAll();
			successMessage = 'Household updated.';
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
		successMessage = null;

		try {
			await trpc.households.remove.mutate(selectedHouseholdId);
			await invalidateAll();
			selectedHouseholdId = null;
			successMessage = 'Household deleted. Its participants were kept in the event.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to delete the household.';
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Households | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<div>
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">Organizer</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
			Households
		</h1>
		<p class="mt-3 max-w-2xl text-stone-600">
			Group participants who live together or should not draw one another. You can assign members
			from the Participants page.
		</p>
	</div>

	{#if errorMessage}
		<p
			class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
			role="alert"
		>
			{errorMessage}
		</p>
	{/if}
	{#if successMessage}
		<p class="text-sm text-emerald-800" role="status">{successMessage}</p>
	{/if}

	<Card class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle>Create a household</CardTitle>
			<CardDescription>Household names are visible to event organizers.</CardDescription>
		</CardHeader>
		<CardContent>
			<form class="flex flex-col gap-3 sm:flex-row" onsubmit={createHousehold}>
				<div class="flex-1 space-y-2">
					<label class="text-sm font-medium" for="new-household-name">Household name</label>
					<Input
						id="new-household-name"
						bind:value={newName}
						maxlength={80}
						placeholder="For example, The Lees"
						required
						disabled={isSaving}
					/>
				</div>
				<Button class="sm:mt-7" type="submit" disabled={isSaving}>
					{isSaving ? 'Creating…' : 'Create household'}
				</Button>
			</form>
		</CardContent>
	</Card>

	<Card class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle>Household list</CardTitle>
			<CardDescription>
				{households.length}
				{households.length === 1 ? 'household' : 'households'} configured.
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if households.length === 0}
				<p class="text-sm text-stone-600">No households have been created yet.</p>
			{:else}
				<ul class="divide-y divide-stone-100">
					{#each households as household (household.id)}
						<li class="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
							<div>
								<p class="font-medium text-stone-950">{household.name}</p>
								<p class="mt-1 text-sm text-stone-500">
									{household.memberCount}
									{household.memberCount === 1 ? 'participant' : 'participants'}
								</p>
							</div>
							<Button
								variant="outline"
								type="button"
								aria-label={`Edit ${household.name}`}
								onclick={() => selectHousehold(household)}
							>
								Edit
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</CardContent>
	</Card>

	{#if selectedHouseholdId}
		<Card class="border-stone-200 bg-white">
			<CardHeader>
				<CardTitle>Edit household</CardTitle>
				<CardDescription>
					Deleting a household clears the household assignment but does not delete participant
					accounts.
				</CardDescription>
			</CardHeader>
			<CardContent class="flex flex-col gap-6">
				<form class="flex flex-col gap-3 sm:flex-row" onsubmit={updateHousehold}>
					<div class="flex-1 space-y-2">
						<label class="text-sm font-medium" for="edit-household-name">Household name</label>
						<Input
							id="edit-household-name"
							bind:value={editName}
							maxlength={80}
							required
							disabled={isSaving}
						/>
					</div>
					<div class="flex gap-3 sm:mt-7">
						<Button type="submit" disabled={isSaving}>
							{isSaving ? 'Saving…' : 'Save name'}
						</Button>
						<Button variant="outline" type="button" onclick={() => (selectedHouseholdId = null)}>
							Cancel
						</Button>
					</div>
				</form>
				<div class="border-t border-stone-100 pt-5">
					<Button variant="destructive" type="button" disabled={isSaving} onclick={removeHousehold}>
						Delete household
					</Button>
				</div>
			</CardContent>
		</Card>
	{/if}
</section>
