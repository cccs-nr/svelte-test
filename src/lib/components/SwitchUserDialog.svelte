<script lang="ts">
	import { TRPCClientError } from '@trpc/client';
	import { Check } from '@lucide/svelte';
	import { trpc } from '#lib/trpc/client.js';

	type Member = { id: string; displayName: string; unreadMessages: number };

	let { members, activeId }: { members: Member[]; activeId: string } = $props();
	let dialog = $state<HTMLDialogElement>();
	let busyId = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	export function show(): void {
		errorMessage = null;
		dialog?.showModal();
	}

	// Choosing a person switches immediately; choosing the current person just closes the dialog.
	async function choose(member: Member): Promise<void> {
		if (busyId) return;
		if (member.id === activeId) {
			dialog?.close();
			return;
		}
		busyId = member.id;
		errorMessage = null;
		try {
			await trpc.members.switchTo.mutate({ userId: member.id });
			window.location.reload();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to switch. Please try again.';
			busyId = null;
		}
	}

	// Only a click on the backdrop itself (not on the content) dismisses the dialog.
	function closeOnBackdrop(event: MouseEvent): void {
		if (event.target === dialog) dialog?.close();
	}
</script>

<dialog
	bind:this={dialog}
	class="app-dialog m-auto max-h-[92dvh] w-[min(95vw,32rem)] overflow-y-auto rounded-xl p-0 shadow-2xl backdrop:bg-black/60"
	aria-labelledby="switch-user-title"
	onclick={closeOnBackdrop}
>
	<div class="space-y-4 p-5 sm:p-6">
		<div class="space-y-1">
			<h2 id="switch-user-title" class="text-2xl font-bold">Switch user</h2>
			<p class="app-hint text-base text-muted-foreground">Select who you want to use the app as.</p>
		</div>

		<ul class="space-y-3" aria-label="People">
			{#each members as member (member.id)}
				<li>
					<button
						type="button"
						class={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg border-2 bg-card px-4 py-2 text-left text-lg font-semibold hover:bg-secondary disabled:cursor-not-allowed ${
							member.id === activeId ? 'border-primary' : 'border-border'
						}`}
						aria-current={member.id === activeId ? 'true' : undefined}
						disabled={busyId !== null}
						onclick={() => choose(member)}
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
						<span class="min-w-0 flex-1 truncate">{member.displayName}</span>
						{#if member.id === activeId}
							<span class="text-sm font-medium">Current user</span>
						{:else if member.unreadMessages > 0}
							<span class="text-sm font-medium">{member.unreadMessages} new</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>

		{#if errorMessage}
			<p class="app-alert app-alert--error" role="alert">{errorMessage}</p>
		{/if}
	</div>
</dialog>
