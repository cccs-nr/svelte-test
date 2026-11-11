<script lang="ts">
	import { TRPCClientError } from '@trpc/client';
	import { Check } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { trpc } from '#lib/trpc/client.js';

	type Member = { id: string; displayName: string; unreadMessages: number };

	let { members, activeId }: { members: Member[]; activeId: string } = $props();
	let dialog = $state<HTMLDialogElement>();
	let selectedId = $state('');
	let isSwitching = $state(false);
	let errorMessage = $state<string | null>(null);

	export function show(): void {
		selectedId = activeId;
		errorMessage = null;
		dialog?.showModal();
	}

	async function confirm(): Promise<void> {
		if (isSwitching) return;
		if (selectedId === activeId) {
			dialog?.close();
			return;
		}
		isSwitching = true;
		errorMessage = null;
		try {
			await trpc.members.switchTo.mutate({ userId: selectedId });
			window.location.reload();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to switch. Please try again.';
			isSwitching = false;
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="app-dialog m-auto max-h-[92dvh] w-[min(95vw,32rem)] overflow-y-auto rounded-xl p-5 shadow-2xl backdrop:bg-black/60 sm:p-6"
	aria-labelledby="switch-user-title"
>
	<form
		class="space-y-4"
		onsubmit={(event) => {
			event.preventDefault();
			void confirm();
		}}
	>
		<div class="space-y-1">
			<h2 id="switch-user-title" class="text-2xl font-bold">Switch user</h2>
			<p class="text-base text-muted-foreground">Choose who you want to use the app as.</p>
		</div>

		<fieldset class="space-y-3">
			<legend class="sr-only">Choose a user</legend>
			{#each members as member (member.id)}
				<label
					class={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-2 text-lg font-semibold has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${
						selectedId === member.id
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-border bg-background hover:bg-secondary'
					}`}
				>
					<input
						type="radio"
						name="switch-user"
						class="sr-only"
						value={member.id}
						bind:group={selectedId}
					/>
					<span
						class={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${
							selectedId === member.id ? 'border-primary-foreground' : 'border-foreground'
						}`}
						aria-hidden="true"
					>
						{#if selectedId === member.id}<Check size={18} />{/if}
					</span>
					<span class="min-w-0 flex-1 truncate">{member.displayName}</span>
					{#if member.id === activeId}
						<span class="text-sm font-medium">Current user</span>
					{:else if member.unreadMessages > 0}
						<span class="text-sm font-medium">{member.unreadMessages} new</span>
					{/if}
				</label>
			{/each}
		</fieldset>

		{#if errorMessage}
			<p class="app-alert app-alert--error" role="alert">{errorMessage}</p>
		{/if}

		<div class="flex flex-wrap justify-end gap-3">
			<Button
				type="button"
				variant="outline"
				disabled={isSwitching}
				onclick={() => dialog?.close()}
			>
				Cancel
			</Button>
			<Button type="submit" disabled={isSwitching}>
				{isSwitching ? 'Switching…' : 'Confirm'}
			</Button>
		</div>
	</form>
</dialog>
