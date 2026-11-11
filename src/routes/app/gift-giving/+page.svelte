<script lang="ts">
	import type { PageProps } from './$types';
	import PageGuide from '#lib/components/PageGuide.svelte';
	import PageSummary from '#lib/components/PageSummary.svelte';
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
		<div class="app-page-titlebar">
			<h1 class="app-page-title">
				{data.assignedRecipient ? data.assignedRecipient.displayName : 'Waiting for the draw'}
			</h1>
			<PageGuide pageId="draw">
				{#if data.assignedRecipient}
					<p>
						This page shows the one person you are buying a gift for, and their wishlist. Your
						assignment is private, so please keep it a secret until the party.
					</p>
					<ol>
						<li>
							Look through their gift ideas below. Each idea may have a description, a link and a
							suggested price.
						</li>
						<li>
							When you decide to buy something, press <strong>Reserve</strong> so nobody else buys
							the same thing. Changed your mind? Press <strong>Release</strong>.
						</li>
						<li>
							Once you have bought it, press <strong>Mark purchased</strong>. This lets the
							organizer see your progress.
						</li>
						<li>
							Not sure what to pick? Press the message button to ask a question. Your messages use
							your codename, so your name stays secret.
						</li>
					</ol>
					<p>
						You do not have to choose from the wishlist. The ideas are only there to help. Your
						official gift is separate from any extra gifts you reserve for other people.
					</p>
				{:else}
					<p>
						The organizer has not done the draw yet. Once the draw is finalized, the name of the
						person you are buying for will appear here, together with their wishlist.
					</p>
					<p>
						In the meantime, add your own gift ideas on <strong>My Wishlist</strong> and browse
						other people’s wishlists from <strong>Home</strong>.
					</p>
				{/if}
				<p>The gift price is only a suggestion, not a limit.</p>
			</PageGuide>
		</div>
		<PageSummary simple="See who you are buying a gift for."
			>This shows the one person you are buying a gift for, and their wishlist. Your assignment is
			private, so keep it a secret.</PageSummary
		>
		{#if !data.assignedRecipient}
			<p class="app-page-status">Your draw will appear here after the organizer finalizes it.</p>
		{/if}
	</header>

	{#if data.assignedRecipient}
		{#key data.assignedRecipient.id}
			<FamilyWishlistPanel
				currentUserId={data.currentUserId}
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
