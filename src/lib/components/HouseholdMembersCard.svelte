<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { TRPCClientError } from '@trpc/client';
	import { Check, Plus, Trash2, UserPlus, UsersRound, X } from '@lucide/svelte';
	import PageSummary from '#lib/components/PageSummary.svelte';
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
	<PageSummary simple="Manage the people in your household." />
	<p class="app-hint mt-2 text-base text-muted-foreground">
		Optional. Add someone who shares this account, such as a spouse, to manage their wishlist from
		here. If that feels complicated, they can simply create their own account instead.
	</p>

	{#if members.length > 1}
		<p class="app-hint mt-4 text-base font-semibold">Select a person to switch to them.</p>
		<ul class="mt-2 space-y-3" aria-label="People in your household">
			{#each members as member (member.id)}
				<li class="flex flex-wrap items-center gap-3">
					<button
						type="button"
						class={`flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg border-2 bg-card px-4 py-2 text-left text-lg font-semibold hover:bg-secondary disabled:cursor-not-allowed ${
							member.id === activeId ? 'border-primary' : 'border-border'
						}`}
						aria-current={member.id === activeId ? 'true' : undefined}
						disabled={busyId !== null}
						onclick={() => (member.id === activeId ? undefined : switchTo(member))}
					>
						<span
							class={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${
								member.id === activeId
									? 'border-primary bg-primary text-primary-foreground'
									: 'border-foreground'
							}`}
							aria-hidden="true"
						>
							{#if member.id === activeId}<Check size={18} />{/if}
						</span>
						<span class="min-w-0 flex-1 truncate">
							{member.displayName}
							{#if member.id === accountId}
								<span class="text-base font-normal">(account owner)</span>
							{/if}
						</span>
						{#if member.id === activeId}
							<span class="text-sm font-medium">Current user</span>
						{:else if member.unreadMessages > 0}
							<span class="text-sm font-medium">{member.unreadMessages} new</span>
						{/if}
					</button>
					{#if member.id !== accountId}
						<Button
							type="button"
							variant="destructive"
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
				required
				disabled={isAdding}
			/>
			<div class="flex flex-wrap gap-3">
				<Button type="submit" disabled={isAdding || !newName.trim()}>
					<UserPlus aria-hidden="true" />
					{isAdding ? 'Adding…' : 'Add Person'}
				</Button>
				<Button type="button" variant="outline" onclick={() => (isFormOpen = false)}>
					<X aria-hidden="true" />Cancel</Button
				>
			</div>
		</form>
	{/if}
</section>
