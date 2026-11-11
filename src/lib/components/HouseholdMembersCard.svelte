<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { TRPCClientError } from '@trpc/client';
	import { Check, Plus, Trash2, UsersRound } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { trpc } from '#lib/trpc/client.js';

	type Member = { id: string; displayName: string; unreadMessages: number };

	let {
		members,
		activeId,
		accountId
	}: {
		members: Member[];
		activeId: string;
		accountId: string;
	} = $props();

	let newName = $state('');
	let isAdding = $state(false);
	let isFormOpen = $state(false);
	let busyId = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let notice = $state<string | null>(null);

	function describeError(error: unknown, fallback: string): string {
		return error instanceof TRPCClientError ? error.message : fallback;
	}

	async function addMember(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isAdding || !newName.trim()) return;
		isAdding = true;
		errorMessage = null;
		notice = null;
		try {
			const created = await trpc.members.add.mutate({ displayName: newName.trim() });
			notice = `${created.displayName} was added. Select their name in this list to manage their wishlist.`;
			newName = '';
			isFormOpen = false;
			await invalidateAll();
		} catch (error) {
			errorMessage = describeError(error, 'Unable to add this person. Please try again.');
		} finally {
			isAdding = false;
		}
	}

	async function switchTo(member: Member): Promise<void> {
		if (busyId) return;
		busyId = member.id;
		errorMessage = null;
		try {
			await trpc.members.switchTo.mutate({ userId: member.id });
			window.location.reload();
		} catch (error) {
			errorMessage = describeError(error, 'Unable to switch. Please try again.');
			busyId = null;
		}
	}

	async function removeMember(member: Member): Promise<void> {
		if (busyId) return;
		const confirmed = window.confirm(
			`Remove ${member.displayName} from your household? Their wishlist and messages will be deleted.`
		);
		if (!confirmed) return;
		busyId = member.id;
		errorMessage = null;
		notice = null;
		try {
			await trpc.members.remove.mutate({ userId: member.id });
			notice = `${member.displayName} was removed.`;
			await invalidateAll();
		} catch (error) {
			errorMessage = describeError(error, 'Unable to remove this person. Please try again.');
		} finally {
			busyId = null;
		}
	}
</script>

<section class="app-surface rounded-xl border-2 p-5 sm:p-6" aria-labelledby="household-title">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 id="household-title" class="flex items-center gap-3 text-xl font-semibold">
			<UsersRound size={24} aria-hidden="true" />
			Household
		</h2>
		{#if !isFormOpen}
			<Button type="button" onclick={() => (isFormOpen = true)}>
				<Plus aria-hidden="true" />
				Add Person
			</Button>
		{/if}
	</div>
	<p class="mt-2 text-base text-muted-foreground">
		Optional. Add someone who shares this account, such as a spouse, to manage their wishlist from
		here. If that feels complicated, they can simply create their own account instead.
	</p>

	{#if members.length > 1}
		<p class="mt-4 text-base font-semibold">Select a person to switch to them.</p>
		<ul class="mt-2 space-y-3" aria-label="People in your household">
			{#each members as member (member.id)}
				<li class="flex flex-wrap items-stretch gap-3">
					{#if member.id === activeId}
						<p
							class="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border-2 border-primary bg-primary px-4 py-2 text-lg font-semibold text-primary-foreground"
							aria-current="true"
						>
							<span class="flex min-w-0 items-center gap-2">
								<Check size={22} aria-hidden="true" />
								<span class="truncate">{member.displayName}</span>
								{#if member.id === accountId}
									<span class="text-base font-normal">(account owner)</span>
								{/if}
							</span>
							<span class="text-base">Current user</span>
						</p>
					{:else}
						<button
							type="button"
							class="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-lg border-2 border-border bg-background px-4 py-2 text-left text-lg font-semibold hover:border-primary hover:bg-secondary disabled:cursor-not-allowed"
							disabled={busyId !== null}
							onclick={() => switchTo(member)}
							aria-label={`Switch to ${member.displayName}`}
						>
							<span class="flex min-w-0 items-center gap-2">
								<span class="truncate">{member.displayName}</span>
								{#if member.id === accountId}
									<span class="text-base font-normal">(account owner)</span>
								{/if}
							</span>
							{#if member.unreadMessages > 0}
								<span class="text-base font-normal">
									{member.unreadMessages} new
									{member.unreadMessages === 1 ? 'message' : 'messages'}
								</span>
							{/if}
						</button>
					{/if}
					{#if member.id !== accountId}
						<Button
							type="button"
							variant="destructive"
							class="self-center"
							disabled={busyId !== null}
							onclick={() => removeMember(member)}
							aria-label={`Remove ${member.displayName}`}
						>
							<Trash2 aria-hidden="true" />
							Remove
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if errorMessage}
		<p class="app-alert app-alert--error mt-4" role="alert">{errorMessage}</p>
	{/if}
	{#if notice}
		<p class="app-notice mt-4" role="status">{notice}</p>
	{/if}

	{#if isFormOpen}
		<form class="mt-4 space-y-3" onsubmit={addMember}>
			<label class="text-base font-semibold" for="household-member-name">
				Name of the person to add
			</label>
			<Input
				id="household-member-name"
				bind:value={newName}
				maxlength={64}
				placeholder="For example: Dad"
				required
				disabled={isAdding}
			/>
			<div class="flex flex-wrap gap-3">
				<Button type="submit" disabled={isAdding || !newName.trim()}>
					{isAdding ? 'Adding…' : 'Add Person'}
				</Button>
				<Button type="button" variant="outline" onclick={() => (isFormOpen = false)}>Cancel</Button>
			</div>
		</form>
	{/if}
</section>
