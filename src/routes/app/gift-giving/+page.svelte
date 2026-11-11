<script lang="ts">
	import type { PageProps } from './$types';
	import PageGuide from '#lib/components/PageGuide.svelte';
	import RecipientGiftIdeasPanel from '#lib/components/RecipientGiftIdeasPanel.svelte';
	import FamilyWishlistPanel from '#lib/components/FamilyWishlistPanel.svelte';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>
		{data.assignedRecipient ? `You drew ${data.assignedRecipient.displayName}` : 'Your draw'} | Secret
		Santa
	</title>
</svelte:head>

<section class="space-y-8">
	<header>
		<p class="app-page-kicker">
			{data.assignedRecipient ? 'You drew' : 'Your draw'}
		</p>
		<h1 class="app-page-title">
			{data.assignedRecipient ? data.assignedRecipient.displayName : 'Waiting for the draw'}
		</h1>
		<p class="app-page-description">
			{#if data.assignedRecipient}
				Your official gift is separate from optional Wishlist Gifts you choose as a Wishlist Gifter.
			{:else}
				Your draw will appear here after the organizer finalizes it.
			{/if}
		</p>
	</header>

	<PageGuide simple="This is who you buy for. Pick a gift idea and press Reserve.">
		{#if data.assignedRecipient}
			<p>
				This is the person you are buying a gift for. Look through their gift ideas below. When you
				find one you like, press <strong>Reserve</strong> so nobody else buys the same thing, then
				press <strong>Mark purchased</strong> once you have bought it.
			</p>
			<p>Have a question? Press the message button to ask. Your name stays secret.</p>
		{:else}
			<p>
				The organizer has not done the draw yet. Once they have, the name of the person you are
				buying for will appear here. Check back soon!
			</p>
		{/if}
		<p>The gift price is only a suggestion, not a limit.</p>
	</PageGuide>

	{#if data.assignedRecipient}
		{#key data.assignedRecipient.id}
			<FamilyWishlistPanel
				currentUserId={data.currentUserId}
				giftBudgetCents={data.giftBudgetCents}
				currency={data.currency}
				initialRecipientId={data.assignedRecipient.id}
				showDirectory={false}
				showReservations={false}
				markAssignedRecipientViewed
			/>
		{/key}
	{:else}
		<RecipientGiftIdeasPanel giftBudgetCents={data.giftBudgetCents} currency={data.currency} />
	{/if}
</section>
