<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { TRPCClientError } from '@trpc/client';
	import { Plus, Trash2, UsersRound } from '@lucide/svelte';
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
			notice = `${created.displayName} was added. Use “Switch to ${created.displayName}” to manage their wishlist.`;
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

<section class="app-surface rounded-2xl border-2 p-5 sm:p-6" aria-labelledby="household-title">
	<div class="flex items-start gap-4">
		<span
			class="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"
			aria-hidden="true"
		>
			<UsersRound size={26} />
		</span>
		<div class="min-w-0 space-y-1">
			<h2 id="household-title" class="text-xl font-semibold">Your household</h2>
			<p class="text-base text-muted-foreground">
				Do you also manage a gift list for someone else, like a husband, wife or parent? Add them
				here. They get their own wishlist and their own draw name, and you manage both from this one
				account. People in the same household never draw each other.
			</p>
		</div>
	</div>

	<ul class="mt-4 space-y-3" aria-label="People you manage">
		{#each members as member (member.id)}
			<li
				class="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-3"
			>
				<div class="min-w-0">
					<p class="text-lg font-semibold">
						{member.displayName}
						{#if member.id === accountId}<span class="font-normal text-muted-foreground">(you)</span
							>{/if}
					</p>
					{#if member.id === activeId}
						<p class="text-base font-medium">✔ Currently using the app as this person</p>
					{:else if member.unreadMessages > 0}
						<p class="text-base">
							{member.unreadMessages}
							{member.unreadMessages === 1 ? 'message is' : 'messages are'} waiting
						</p>
					{/if}
				</div>
				<div class="flex flex-wrap gap-2">
					{#if member.id !== activeId}
						<Button
							type="button"
							variant="outline"
							disabled={busyId !== null}
							onclick={() => switchTo(member)}
						>
							Switch to {member.displayName}
						</Button>
					{/if}
					{#if member.id !== accountId}
						<Button
							type="button"
							variant="outline"
							disabled={busyId !== null}
							onclick={() => removeMember(member)}
							aria-label={`Remove ${member.displayName}`}
						>
							<Trash2 size={18} aria-hidden="true" />
							Remove
						</Button>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

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
			<div class="flex flex-wrap gap-2">
				<Button type="submit" size="lg" disabled={isAdding || !newName.trim()}>
					{isAdding ? 'Adding…' : 'Add this person'}
				</Button>
				<Button type="button" size="lg" variant="outline" onclick={() => (isFormOpen = false)}>
					Cancel
				</Button>
			</div>
		</form>
	{:else}
		<Button
			type="button"
			size="lg"
			class="mt-4 h-auto min-h-12 w-full py-2 whitespace-normal sm:w-auto"
			onclick={() => (isFormOpen = true)}
		>
			<Plus size={20} aria-hidden="true" />
			Add a person to my household
		</Button>
	{/if}
</section>
