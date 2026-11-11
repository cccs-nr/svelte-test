<script lang="ts">
	import type { PageProps } from './$types';
	import PageGuide from '#lib/components/PageGuide.svelte';
	import PageSummary from '#lib/components/PageSummary.svelte';
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
		<PageSummary>Browse gift ideas and reserve one you plan to buy.</PageSummary>
	</header>

	<PageGuide>
		<p>
			This is {data.recipientDisplayName}’s wishlist: a list of things they would enjoy. You do not
			have to buy anything from it, but it is a good place to look for gift ideas, even if they are
			not the person you drew.
		</p>
		<ol>
			<li>
				Read each idea. It may include a description, a link to the gift and a suggested price.
			</li>
			<li>
				If you decide to buy one, press <strong>Reserve</strong>. Other people will see it is taken,
				so you will not both buy the same thing. Press <strong>Release</strong> if you change your mind.
			</li>
			<li>
				After you buy it, press <strong>Mark purchased</strong>. {data.recipientDisplayName} never sees
				who reserved or bought an idea.
			</li>
			<li>
				Have a question about an idea? Start a conversation with the message button. You appear by
				your codename, so your identity stays secret.
			</li>
		</ol>
		<p>The gift price is only a suggestion, not a limit.</p>
	</PageGuide>

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
