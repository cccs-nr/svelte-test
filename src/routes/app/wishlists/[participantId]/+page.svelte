<script lang="ts">
	import type { PageProps } from './$types';
	import FamilyWishlistPanel from '#lib/components/FamilyWishlistPanel.svelte';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.recipientDisplayName} | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<header>
		<p class="app-page-kicker">Wishlist</p>
		<h1 class="app-page-title">
			{data.recipientDisplayName}
		</h1>
		<p class="app-page-description">
			Browse gift ideas or plan a gift. Reservation details are only visible to gift buyers.
		</p>
	</header>

	{#key data.participantId}
		<FamilyWishlistPanel
			currentUserId={data.currentUserId}
			giftBudgetCents={data.giftBudgetCents}
			currency={data.currency}
			initialRecipientId={data.participantId}
			showDirectory={false}
			showReservations={false}
		/>
	{/key}
</section>
