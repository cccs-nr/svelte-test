<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
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
		<Button variant="outline" href={resolve('/app/messages')}>Back to Messages</Button>
		<p class="w-full text-base text-stone-700">
			Type your message in the box at the bottom, then press <strong>Send</strong>. Your name stays
			secret.
		</p>
		{#if associatedWishlistOwnerId}
			<Button
				variant="outline"
				href={associatedWishlistOwnerId === data.user.id
					? resolve('/app/wishlist')
					: resolve('/app/wishlists/[participantId]', {
							participantId: associatedWishlistOwnerId
						})}
			>
				View associated wishlist
			</Button>
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
