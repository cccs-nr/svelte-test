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
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">Wishlist</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
			{data.recipientDisplayName}
		</h1>
		<p class="mt-3 max-w-2xl text-stone-600">
			Browse their gift ideas, reserve an optional Wishlist Gift, or start a conversation. The
			Wishlist Recipient cannot see reservation or purchase details.
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
