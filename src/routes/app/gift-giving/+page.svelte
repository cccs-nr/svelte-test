<script lang="ts">
	import type { PageProps } from './$types';
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
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">
			{data.assignedRecipient ? 'You drew' : 'Your draw'}
		</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
			{data.assignedRecipient ? data.assignedRecipient.displayName : 'Waiting for the draw'}
		</h1>
		<p class="mt-3 max-w-2xl text-stone-600">
			{#if data.assignedRecipient}
				Your official gift is separate from optional Wishlist Gifts you choose as a Wishlist Gifter.
			{:else}
				Your draw will appear here after the organizer finalizes it.
			{/if}
		</p>
	</header>

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
