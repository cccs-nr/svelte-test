<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import ConversationPanel from '#lib/components/ConversationPanel.svelte';

	let { data }: PageProps = $props();
	let associatedWishlistOwnerId = $state<string | null>(null);
</script>

<svelte:head>
	<title>Conversation | Secret Santa</title>
</svelte:head>

<section class="flex min-h-0 flex-1 flex-col gap-0 sm:gap-3">
	<div
		class="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0"
	>
		<a
			class="inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-0 sm:border sm:border-border sm:px-3 sm:py-2 sm:text-foreground sm:no-underline sm:hover:bg-muted"
			href={resolve('/app/messages')}
		>
			Back to Messages
		</a>
		<p class="hidden text-base text-stone-600 sm:block">
			Type your message in the box at the bottom, then press Send.
		</p>
		{#if associatedWishlistOwnerId}
			<a
				class="text-sm font-medium text-emerald-800 underline underline-offset-4"
				href={associatedWishlistOwnerId === data.user.id
					? resolve('/app/wishlist')
					: resolve('/app/wishlists/[participantId]', {
							participantId: associatedWishlistOwnerId
						})}
			>
				View associated wishlist
			</a>
		{/if}
	</div>

	{#key data.conversationId}
		<ConversationPanel
			conversationId={data.conversationId}
			onWishlistOwnerChange={(ownerId) => (associatedWishlistOwnerId = ownerId)}
			fullHeight
		/>
	{/key}
</section>
