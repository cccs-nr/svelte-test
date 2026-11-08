<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { X } from '@lucide/svelte';
	import type { PageProps } from './$types';
	import ConversationPanel from '#lib/components/ConversationPanel.svelte';
	import { formatEventBudget } from '#lib/models/event.js';
	import { trpc } from '#lib/trpc/client.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';

	type GiftWishlist = Awaited<ReturnType<typeof trpc.wishlists.assignedRecipient.query>>;
	type GiftStatus = Awaited<ReturnType<typeof trpc.assignments.myGiftStatus.query>>;

	let { data }: PageProps = $props();
	let wishlist = $state<GiftWishlist>({ recipient: null, suggestions: [] });
	let giftStatus = $state<GiftStatus>({ purchased: false, purchasedAt: null });
	let isLoading = $state(true);
	let isUpdatingStatus = $state(false);
	let errorMessage = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let imageDialog = $state<HTMLDialogElement>();
	let fullSizeImage = $state<{ src: string; alt: string } | null>(null);

	onMount(() => {
		void loadGiftIdeas();
	});

	async function loadGiftIdeas(): Promise<boolean> {
		isLoading = true;
		errorMessage = null;
		try {
			const [recipientWishlist, status] = await Promise.all([
				trpc.wishlists.assignedRecipient.query(),
				trpc.assignments.myGiftStatus.query()
			]);
			wishlist = recipientWishlist;
			giftStatus = status;
			return true;
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load your gift ideas. Please try again.';
			return false;
		} finally {
			isLoading = false;
		}
	}

	async function toggleGiftPurchased(): Promise<void> {
		if (!wishlist.recipient || isUpdatingStatus || isLoading) return;

		isUpdatingStatus = true;
		errorMessage = null;
		notice = null;
		try {
			giftStatus = await trpc.assignments.setGiftPurchased.mutate({
				purchased: !giftStatus.purchased
			});
			notice = giftStatus.purchased
				? 'Your recipient can now see that their gift has been purchased.'
				: 'The purchased status was removed.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to update the gift status. Please try again.';
		} finally {
			isUpdatingStatus = false;
		}
	}

	function formatTimestamp(value: string): string {
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(new Date(value));
	}

	function imageUrl(imageKey: string): string {
		return resolve('/api/wishlist-images/[imageKey]', { imageKey });
	}

	function openImage(src: string, alt: string): void {
		fullSizeImage = { src, alt };
		imageDialog?.showModal();
	}

	function openSuggestionImage(imageKey: string | null, title: string): void {
		if (!imageKey) return;
		openImage(imageUrl(imageKey), `Full-size image for ${title}`);
	}

	function closeImage(): void {
		imageDialog?.close();
	}

	function handleImageDialogClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) closeImage();
	}

	function handleImageDialogKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeImage();
		}
	}

	function clearFullSizeImage(): void {
		fullSizeImage = null;
	}
</script>

<svelte:head>
	<title>Gift ideas | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">
				For your recipient
			</p>
			<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
				Gift ideas
			</h1>
			<p class="mt-3 max-w-2xl text-stone-600">
				Review your recipient’s wishlist and mark the gift purchased when you’re ready. They’ll see
				the status without learning who you are.
			</p>
		</div>
		<Button
			type="button"
			variant="outline"
			onclick={() => void loadGiftIdeas()}
			disabled={isLoading || isUpdatingStatus}
		>
			Refresh gift ideas
		</Button>
	</div>

	{#if errorMessage}
		<p
			class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
			role="alert"
		>
			{errorMessage}
		</p>
	{/if}
	{#if notice}
		<p class="text-sm text-emerald-800" role="status">{notice}</p>
	{/if}

	<Card class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle
				>{wishlist.recipient
					? `Ideas for ${wishlist.recipient.displayName}`
					: 'Your recipient'}</CardTitle
			>
			<CardDescription>
				{#if data.giftBudgetCents !== null}
					The event budget is {formatEventBudget(data.giftBudgetCents, data.currency)}, as a
					guideline.
				{:else}
					The organizer has not set the event budget yet.
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-5">
			{#if isLoading}
				<p class="text-sm text-stone-500">Loading your recipient’s gift ideas…</p>
			{:else if !wishlist.recipient}
				<p class="text-sm text-stone-600">
					Your recipient’s wishlist will be available after the organizer finalizes the draw.
				</p>
			{:else}
				<div
					class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 p-4"
				>
					<div>
						<p class="font-medium text-stone-950">Gift purchase status</p>
						<p class="mt-1 text-sm text-stone-600">
							{#if giftStatus.purchased}
								Marked as purchased{giftStatus.purchasedAt
									? ` on ${formatTimestamp(giftStatus.purchasedAt)}`
									: ''}.
							{:else}
								Not marked as purchased yet.
							{/if}
						</p>
					</div>
					<Button
						type="button"
						variant={giftStatus.purchased ? 'outline' : 'default'}
						onclick={() => void toggleGiftPurchased()}
						disabled={isLoading || isUpdatingStatus}
					>
						{isUpdatingStatus
							? 'Updating…'
							: giftStatus.purchased
								? 'Undo purchased status'
								: 'Mark gift as purchased'}
					</Button>
				</div>

				{#if wishlist.suggestions.length === 0}
					<p class="text-sm text-stone-600">Your recipient hasn’t added any gift ideas yet.</p>
				{:else}
					<ul class="space-y-4">
						{#each wishlist.suggestions as suggestion (suggestion.id)}
							<li class="rounded-xl border border-stone-200 p-4">
								{#if suggestion.imageKey}
									<button
										type="button"
										class="mb-4 block w-full cursor-zoom-in overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
										aria-label={`View full-size image for ${suggestion.title}`}
										onclick={() => openSuggestionImage(suggestion.imageKey, suggestion.title)}
									>
										<img
											class="max-h-56 w-full rounded-lg object-cover"
											src={imageUrl(suggestion.imageKey)}
											alt=""
											loading="lazy"
										/>
									</button>
								{/if}
								<h2 class="font-semibold text-stone-950">{suggestion.title}</h2>
								{#if suggestion.description}
									<p class="mt-2 text-sm whitespace-pre-wrap text-stone-600">
										{suggestion.description}
									</p>
								{/if}
								{#if suggestion.url}
									<a
										class="mt-3 inline-block text-sm font-medium text-emerald-800 underline-offset-4 hover:underline"
										href={suggestion.url}
										target="_blank"
										rel="noopener noreferrer external"
									>
										View gift link
									</a>
								{/if}
								{#if suggestion.estimatedPriceCents !== null}
									<p class="mt-2 text-sm text-stone-600">
										Estimated price: {formatEventBudget(
											suggestion.estimatedPriceCents,
											data.currency
										)}
									</p>
								{/if}
								{#if suggestion.notes}
									<p class="mt-2 text-sm whitespace-pre-wrap text-stone-600">
										Notes: {suggestion.notes}
									</p>
								{/if}
								<p class="mt-3 text-xs text-stone-500">
									Added {formatTimestamp(suggestion.createdAt)} · Updated
									{formatTimestamp(suggestion.updatedAt)}
								</p>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</CardContent>
	</Card>

	<ConversationPanel
		direction="asGiver"
		displayName={data.user.displayName}
		hasAvatar={data.hasAvatar}
		avatarVersion={data.avatarVersion}
	/>

	<dialog
		bind:this={imageDialog}
		class="m-auto max-h-[95vh] w-[95vw] max-w-6xl rounded-2xl bg-white p-3 text-stone-950 shadow-2xl backdrop:bg-black/85 sm:p-5"
		aria-label="Full-size gift idea image"
		onclick={handleImageDialogClick}
		onkeydown={handleImageDialogKeydown}
		onclose={clearFullSizeImage}
	>
		{#if fullSizeImage}
			<div class="relative">
				<Button
					type="button"
					variant="outline"
					class="absolute top-2 right-2 z-10 size-10 rounded-full bg-white/90 p-0"
					aria-label="Close full-size image"
					onclick={closeImage}
				>
					<X size={18} aria-hidden="true" />
				</Button>
				<img
					class="mx-auto max-h-[86vh] w-full rounded-lg object-contain"
					src={fullSizeImage.src}
					alt={fullSizeImage.alt}
				/>
			</div>
		{/if}
	</dialog>
</section>
