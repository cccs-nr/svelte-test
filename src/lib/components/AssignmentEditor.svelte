<script lang="ts">
	import { TRPCClientError } from '@trpc/client';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { trpc } from '#lib/trpc/client.js';

	type Listing = Awaited<ReturnType<typeof trpc.assignments.adminList.query>>;

	let { onChanged }: { onChanged?: () => void } = $props();
	let listing = $state<Listing | null>(null);
	let isLoading = $state(false);
	let savingGiverId = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let notice = $state<string | null>(null);

	async function load(): Promise<void> {
		isLoading = true;
		errorMessage = null;
		try {
			listing = await trpc.assignments.adminList.query();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to load the assignments.';
		} finally {
			isLoading = false;
		}
	}

	async function change(entry: Listing['entries'][number], receiverId: string): Promise<void> {
		if (receiverId === entry.receiverId || savingGiverId) return;
		const newReceiver = listing?.receivers.find((receiver) => receiver.id === receiverId);
		const holder = listing?.entries.find((candidate) => candidate.receiverId === receiverId);
		const confirmed = globalThis.confirm(
			`${entry.giverName} will buy for ${newReceiver?.displayName}. ` +
				`${holder?.giverName} will take over ${entry.receiverName}. ` +
				'Purchase status for both people resets. Continue?'
		);
		if (!confirmed) {
			await load();
			return;
		}

		savingGiverId = entry.giverId;
		errorMessage = null;
		notice = null;
		try {
			await trpc.assignments.adminSet.mutate({ giverId: entry.giverId, receiverId });
			notice = 'Assignments updated.';
			onChanged?.();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to change the assignment.';
		} finally {
			savingGiverId = null;
			await load();
		}
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>Edit who buys for whom</CardTitle>
		<CardDescription>
			For debugging and fixes. This shows the full list of who buys for whom, so only open it when
			you need to.
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-4">
		{#if !listing}
			<Button type="button" variant="outline" size="lg" disabled={isLoading} onclick={load}>
				{isLoading ? 'Loading…' : 'Show assignments'}
			</Button>
		{:else}
			<p class="text-base">
				Pick a new person in the box beside a giver. The person who was buying for that choice
				automatically takes over the giver’s previous choice, so everyone still gives and receives
				exactly once. Household and self-draw rules still apply.
			</p>
			<ul class="space-y-3" aria-label="Assignments">
				{#each listing.entries as entry (entry.giverId)}
					<li
						class="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-3"
					>
						<p class="text-lg font-semibold">
							{entry.giverName}
							<span class="font-normal text-muted-foreground">buys for</span>
						</p>
						<div class="flex flex-wrap items-center gap-3">
							<label class="sr-only" for={`receiver-${entry.giverId}`}>
								Who {entry.giverName} buys for
							</label>
							<select
								id={`receiver-${entry.giverId}`}
								class="h-12 min-w-48 rounded-lg border-2 border-input bg-background px-3 text-lg"
								value={entry.receiverId}
								disabled={savingGiverId !== null}
								onchange={(event) => change(entry, event.currentTarget.value)}
							>
								{#each listing.receivers as receiver (receiver.id)}
									<option value={receiver.id}>{receiver.displayName}</option>
								{/each}
							</select>
							{#if entry.giftPurchased}
								<span class="app-status app-status--success">Gift purchased</span>
							{/if}
							{#if !entry.finalized}
								<span class="app-status app-status--neutral">Draft</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
			<Button type="button" variant="outline" onclick={() => (listing = null)}>
				Hide assignments
			</Button>
		{/if}
		{#if errorMessage}
			<p class="app-alert app-alert--error" role="alert">{errorMessage}</p>
		{/if}
		{#if notice}
			<p class="app-notice" role="status">{notice}</p>
		{/if}
	</CardContent>
</Card>
