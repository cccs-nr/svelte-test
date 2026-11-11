<script lang="ts">
	import { ChevronLeft, Gift, RefreshCw } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import PageGuide from '#lib/components/PageGuide.svelte';
	import ConversationPanel from '#lib/components/ConversationPanel.svelte';

	let { data }: PageProps = $props();
	let associatedWishlistOwnerId = $state<string | null>(null);
	let panel = $state<ConversationPanel>();
	let isLoading = $state(true);
</script>

<svelte:head>
	<title>Conversation | Secret Santa</title>
</svelte:head>

<section class="flex min-h-0 flex-1 flex-col gap-0 sm:gap-3">
	{#key data.conversationId}
		<ConversationPanel
			bind:this={panel}
			bind:isLoading
			conversationId={data.conversationId}
			onWishlistOwnerChange={(ownerId) => (associatedWishlistOwnerId = ownerId)}
			fullHeight
		>
			{#snippet leading()}
				<Button variant="outline" href={resolve('/app/messages')} aria-label="Back to Messages">
					<ChevronLeft aria-hidden="true" />
					Back
				</Button>
			{/snippet}
			{#snippet actions()}
				<div class="flex shrink-0 items-center gap-2">
					<PageGuide pageId="conversation" title="How to use a conversation" iconOnly>
						<p>
							A conversation lets you talk with other participants about a wishlist, usually to ask
							a question about a gift idea.
						</p>
						<ol>
							<li>Type your message in the box at the bottom of the page.</li>
							<li>Press <strong>Send</strong>, or press Enter on your keyboard.</li>
							<li>Press <strong>Clear</strong> to empty the box without sending.</li>
							<li>
								Press <strong>Back</strong>, at the bottom left, to return to your list of messages.
							</li>
							<li>
								The buttons at the top show the <strong>participants</strong> in this conversation,
								this help, <strong>refresh</strong>, and the owner’s <strong>wishlist</strong>.
							</li>
							<li>
								New messages appear here by themselves. Under your latest message you can see who
								has read it.
							</li>
						</ol>
						<p>
							You appear by your codename, so your real name stays secret. If you are the Secret
							Santa of the wishlist’s owner, they see you only as “Secret Santa”.
						</p>
					</PageGuide>
					<Button
						variant="outline"
						size="icon"
						aria-label="Refresh"
						title="Refresh"
						onclick={() => void panel?.refresh()}
						disabled={isLoading}
					>
						<RefreshCw aria-hidden="true" />
					</Button>
					{#if associatedWishlistOwnerId}
						<Button
							variant="outline"
							size="icon"
							aria-label="View associated wishlist"
							title="View associated wishlist"
							href={associatedWishlistOwnerId === data.user.id
								? resolve('/app/wishlist')
								: resolve('/app/wishlists/[participantId]', {
										participantId: associatedWishlistOwnerId
									})}
						>
							<Gift aria-hidden="true" />
						</Button>
					{/if}
				</div>
			{/snippet}
		</ConversationPanel>
	{/key}
</section>
