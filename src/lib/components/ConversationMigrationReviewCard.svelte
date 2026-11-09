<script lang="ts">
	import { TRPCClientError } from '@trpc/client';
	import { trpc } from '#lib/trpc/client.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';

	type Review = Awaited<ReturnType<typeof trpc.conversations.migrationReview.query>>[number];
	let { items: initialItems }: { items: Review[] } = $props();
	let resolvedIds = $state<string[]>([]);
	let items = $derived(initialItems.filter((item) => !resolvedIds.includes(item.id)));
	let resolvingId = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	async function markReviewed(id: string): Promise<void> {
		if (resolvingId) return;
		resolvingId = id;
		errorMessage = null;
		try {
			const result = await trpc.conversations.resolveMigrationReview.mutate({ id });
			if (!result.updated) {
				errorMessage =
					'This review item is no longer pending. Refresh the dashboard and try again.';
				return;
			}
			resolvedIds = [...resolvedIds, id];
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to update the migration review. Please try again.';
		} finally {
			resolvingId = null;
		}
	}
</script>

{#if items.length > 0}
	<Card class="border-amber-300 bg-white">
		<CardHeader>
			<CardTitle>Conversation migration review</CardTitle>
			<CardDescription>
				Some legacy membership records were corrected during migration. Review each flagged record.
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-3">
			{#if errorMessage}
				<p
					class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
					role="alert"
				>
					{errorMessage}
				</p>
			{/if}
			<ul class="space-y-2" aria-label="Pending conversation migration reviews">
				{#each items as item (item.id)}
					<li class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3">
						<div class="min-w-0">
							<p class="text-sm font-medium text-stone-900">
								{item.source === 'assignment'
									? 'Legacy assignment messages'
									: 'Wishlist conversation'}
								{#if item.displayName}
									· {item.displayName}
								{/if}
							</p>
							<p class="mt-1 text-sm text-stone-700">{item.reason}</p>
							<p class="mt-1 truncate text-xs text-stone-500">
								Legacy conversation: {item.conversationId}
							</p>
						</div>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onclick={() => void markReviewed(item.id)}
							disabled={resolvingId !== null}
						>
							{resolvingId === item.id ? 'Saving…' : 'Mark reviewed'}
						</Button>
					</li>
				{/each}
			</ul>
		</CardContent>
	</Card>
{/if}
