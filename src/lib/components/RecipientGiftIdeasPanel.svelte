<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { X } from '@lucide/svelte';
	import { formatEventBudget } from '#lib/models/event.js';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
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
	type Props = { giftBudgetCents: number | null; currency: string };

	let { giftBudgetCents, currency }: Props = $props();
	let wishlist = $state<GiftWishlist>({ recipient: null, suggestions: [] });
	let giftStatus = $state<GiftStatus>({ purchased: false, purchasedAt: null });
	let isLoading = $state(true);
	let isUpdatingStatus = $state(false);
	let errorMessage = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let loadPromise: Promise<boolean> | null = null;
	let imageDialog = $state<HTMLDialogElement>();
	let fullSizeImage = $state<{ src: string; alt: string } | null>(null);

	onMount(() => {
		const socket = getRealtimeSocket();
		const handleWishlistUpdate = () => void loadGiftIdeas(true);
		const handleGiftStatusUpdate = () => void loadGiftIdeas(true);
		const handleConnect = () => void loadGiftIdeas(true);
		socket.on('recipient-wishlist:changed', handleWishlistUpdate);
		socket.on('gift-status:changed', handleGiftStatusUpdate);
		socket.on('connect', handleConnect);
		void loadGiftIdeas();
		return () => {
			socket.off('recipient-wishlist:changed', handleWishlistUpdate);
			socket.off('gift-status:changed', handleGiftStatusUpdate);
			socket.off('connect', handleConnect);
		};
	});

	async function loadGiftIdeas(force = false): Promise<boolean> {
		if (loadPromise) {
			if (!force) return loadPromise;
			await loadPromise;
			return loadGiftIdeas();
		}
		isLoading = true;
		errorMessage = null;
		const request = (async () => {
			const [recipientWishlist, status] = await Promise.all([
				trpc.wishlists.assignedRecipient.query(),
				trpc.assignments.myGiftStatus.query()
			]);
			wishlist = recipientWishlist;
			giftStatus = status;
			await trpc.wishlists.markAssignedRecipientWishlistViewed.mutate();
			return true;
		})();
		loadPromise = request;

		try {
			return await request;
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load your recipient’s gift ideas. Please try again.';
			return false;
		} finally {
			if (loadPromise === request) loadPromise = null;
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

<Card class="border-stone-200 bg-white">
	<CardHeader>
		<CardTitle
			>{wishlist.recipient
				? `Ideas for ${wishlist.recipient.displayName}`
				: 'Your recipient'}</CardTitle
		>
		<CardDescription>
			{#if giftBudgetCents !== null}
				The event budget is {formatEventBudget(giftBudgetCents, currency)}, as a guideline.
			{:else}
				The organizer has not set the event budget yet.
			{/if}
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-5">
		<div class="flex flex-wrap justify-end">
			<Button
				type="button"
				size="sm"
				variant="outline"
				onclick={() => void loadGiftIdeas(true)}
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
				<ul class="space-y-3">
					{#each wishlist.suggestions as suggestion (suggestion.id)}
						<li class="flex gap-4 rounded-xl border border-stone-200 p-3 sm:p-4">
							{#if suggestion.imageKey}
								<button
									type="button"
									class="size-20 shrink-0 cursor-zoom-in overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:size-24"
									aria-label={`View full-size image for ${suggestion.title}`}
									onclick={() => openSuggestionImage(suggestion.imageKey, suggestion.title)}
								>
									<img
										class="size-full object-cover"
										src={imageUrl(suggestion.imageKey)}
										alt=""
										loading="lazy"
									/>
								</button>
							{/if}
							<div class="min-w-0 flex-1">
								<h3 class="font-semibold text-stone-950">{suggestion.title}</h3>
								{#if suggestion.description}
									<p class="mt-1 text-sm whitespace-pre-wrap text-stone-600">
										{suggestion.description}
									</p>
								{/if}
								{#if suggestion.url}
									<a
										class="mt-2 inline-block text-sm font-medium text-emerald-800 underline-offset-4 hover:underline"
										href={suggestion.url}
										target="_blank"
										rel="noopener noreferrer external"
									>
										View gift link
									</a>
								{/if}
								{#if suggestion.estimatedPriceCents !== null}
									<p class="mt-2 text-sm text-stone-600">
										Estimated price: {formatEventBudget(suggestion.estimatedPriceCents, currency)}
									</p>
								{/if}
								{#if suggestion.notes}
									<p class="mt-2 text-sm whitespace-pre-wrap text-stone-600">
										Notes: {suggestion.notes}
									</p>
								{/if}
								<p class="mt-2 text-xs text-stone-500">
									Updated {formatTimestamp(suggestion.updatedAt)}
								</p>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</CardContent>
</Card>

<dialog
	bind:this={imageDialog}
	class="m-auto max-h-[95vh] w-[95vw] max-w-6xl rounded-2xl bg-white p-3 text-stone-950 shadow-2xl backdrop:bg-black/85 sm:p-5"
	aria-label="Full-size recipient gift idea image"
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
