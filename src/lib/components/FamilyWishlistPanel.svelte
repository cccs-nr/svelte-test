<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { formatEventBudget } from '#lib/models/event.js';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import { trpc } from '#lib/trpc/client.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import CodenameAvatar from '#lib/components/CodenameAvatar.svelte';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';

	type FamilyMember = Awaited<ReturnType<typeof trpc.wishlists.familyDirectory.query>>[number];
	type FamilyWishlist = Awaited<ReturnType<typeof trpc.wishlists.familyWishlist.query>>;
	type Reservation = Awaited<ReturnType<typeof trpc.reservations.mine.query>>[number];
	type CodenameMapping = NonNullable<
		Awaited<ReturnType<typeof trpc.codenames.revealMapping.query>>
	>;
	type Props = {
		currentUserId: string;
		giftBudgetCents: number | null;
		currency: string;
	};

	let { currentUserId, giftBudgetCents, currency }: Props = $props();
	let members = $state<FamilyMember[]>([]);
	let selectedMemberId = $state<string | null>(null);
	let wishlist = $state<FamilyWishlist | null>(null);
	let myReservations = $state<Reservation[]>([]);
	let revealedMapping = $state<CodenameMapping | null>(null);
	let search = $state('');
	let ideaSearch = $state('');
	let isLoadingMembers = $state(true);
	let isLoadingWishlist = $state(false);
	let actionId = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let requestSequence = 0;
	let isDisposed = false;
	let imageDialog = $state<HTMLDialogElement>();
	let fullSizeImage = $state<{ src: string; alt: string } | null>(null);
	let visibleMembers = $derived(
		members.filter(
			(member) =>
				member.id !== currentUserId &&
				member.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
		)
	);
	let visibleSuggestions = $derived(
		(wishlist?.suggestions ?? []).filter((suggestion) => {
			const query = ideaSearch.trim().toLocaleLowerCase();
			return (
				!query ||
				[suggestion.title, suggestion.description, suggestion.notes]
					.join(' ')
					.toLocaleLowerCase()
					.includes(query)
			);
		})
	);

	onMount(() => {
		isDisposed = false;
		const socket = getRealtimeSocket();
		const refreshSelectedWishlist = () => {
			if (selectedMemberId) void loadWishlist(selectedMemberId);
			void loadMyReservations();
		};
		const refreshReveal = () => void loadRevealMapping();
		const handleConnect = () => {
			void loadMembers();
			refreshSelectedWishlist();
			refreshReveal();
		};
		socket.on('family-wishlist:changed', refreshSelectedWishlist);
		socket.on('codenames:changed', refreshReveal);
		socket.on('event:changed', refreshSelectedWishlist);
		socket.on('connect', handleConnect);
		void loadMembers();
		refreshReveal();
		return () => {
			isDisposed = true;
			socket.off('family-wishlist:changed', refreshSelectedWishlist);
			socket.off('codenames:changed', refreshReveal);
			socket.off('event:changed', refreshSelectedWishlist);
			socket.off('connect', handleConnect);
		};
	});

	async function loadMembers(): Promise<void> {
		isLoadingMembers = true;
		errorMessage = null;
		try {
			members = await trpc.wishlists.familyDirectory.query({ search: '' });
			await loadMyReservations();
			if (!selectedMemberId) {
				const firstMember = members.find((member) => member.id !== currentUserId);
				if (firstMember) {
					selectedMemberId = firstMember.id;
					await loadWishlist(firstMember.id);
				}
			}
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load family members. Please try again.';
		} finally {
			if (!isDisposed) isLoadingMembers = false;
		}
	}

	async function loadMyReservations(): Promise<void> {
		try {
			myReservations = await trpc.reservations.mine.query();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load your reservations. Please try again.';
		}
	}

	async function loadRevealMapping(): Promise<void> {
		try {
			revealedMapping = await trpc.codenames.revealMapping.query();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load the event reveal. Please try again.';
		}
	}

	async function loadWishlist(recipientId: string): Promise<void> {
		const sequence = ++requestSequence;
		isLoadingWishlist = true;
		errorMessage = null;
		try {
			const result = await trpc.wishlists.familyWishlist.query({ recipientId });
			if (!isDisposed && sequence === requestSequence) wishlist = result;
		} catch (error) {
			if (isDisposed || sequence !== requestSequence) return;
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load this family wishlist. Please try again.';
		} finally {
			if (!isDisposed && sequence === requestSequence) isLoadingWishlist = false;
		}
	}

	async function selectMember(member: FamilyMember): Promise<void> {
		selectedMemberId = member.id;
		wishlist = null;
		ideaSearch = '';
		notice = null;
		await loadWishlist(member.id);
	}

	async function updateReservation(
		suggestionId: string,
		reservationId: string | null,
		action: 'reserve' | 'release' | 'purchase'
	): Promise<void> {
		if (actionId) return;
		actionId = suggestionId;
		errorMessage = null;
		notice = null;
		try {
			if (action === 'reserve') {
				await trpc.reservations.reserve.mutate({ giftSuggestionId: suggestionId });
				notice = 'Gift idea reserved.';
			} else if (reservationId) {
				if (action === 'release') {
					await trpc.reservations.release.mutate({ reservationId });
					notice = 'Reservation released.';
				} else {
					await trpc.reservations.markPurchased.mutate({ reservationId });
					notice = 'Gift marked as purchased.';
				}
			}
			if (selectedMemberId) await loadWishlist(selectedMemberId);
			await loadMyReservations();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to update this reservation. Please try again.';
		} finally {
			actionId = null;
		}
	}

	function formatTimestamp(value: string): string {
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(new Date(value));
	}

	function imageUrl(imageKey: string): string {
		return resolve('/api/wishlist-images/[imageKey]', { imageKey });
	}

	function openImage(imageKey: string | null, title: string): void {
		if (!imageKey) return;
		fullSizeImage = { src: imageUrl(imageKey), alt: `Full-size image for ${title}` };
		imageDialog?.showModal();
	}

	function closeImage(): void {
		imageDialog?.close();
	}

	function handleImageDialogClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) closeImage();
	}

	function clearImage(): void {
		fullSizeImage = null;
	}
</script>

<Card class="border-stone-200 bg-white">
	<CardHeader>
		<CardTitle>Family wishlists</CardTitle>
		<CardDescription>
			Browse gift ideas from other family members. Buyers appear by codename until the organizer
			reveals identities.
			{#if giftBudgetCents !== null}
				Event budget: {formatEventBudget(giftBudgetCents, currency)} (a guideline).
			{/if}
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-5">
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
		{#if revealedMapping}
			<section
				class="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
				aria-labelledby="codename-reveal-title"
			>
				<h3 id="codename-reveal-title" class="font-semibold text-emerald-950">
					The family reveal is here!
				</h3>
				<ul class="mt-3 grid gap-2 text-sm text-emerald-950 sm:grid-cols-2 lg:grid-cols-3">
					{#each revealedMapping as participant (`${participant.codename}-${participant.displayName}`)}
						<li>
							<span class="font-medium">{participant.codename}</span> was {participant.displayName}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if myReservations.length > 0}
			<section class="space-y-3" aria-labelledby="my-reservations-title">
				<div>
					<h3 id="my-reservations-title" class="font-semibold text-stone-900">Your reservations</h3>
					<p class="mt-1 text-sm text-stone-600">
						These are the gift ideas you reserved for other family members.
					</p>
				</div>
				<ul class="grid gap-3 md:grid-cols-2">
					{#each myReservations as reservation (reservation.id)}
						<li
							class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-4"
						>
							<div>
								<p class="font-medium text-stone-950">{reservation.title}</p>
								<p class="mt-1 text-sm text-stone-600">
									For {reservation.ownerDisplayName} · {reservation.status}
								</p>
							</div>
							{#if reservation.canChange && reservation.status === 'reserved'}
								<div class="flex flex-wrap gap-2">
									<Button
										type="button"
										size="sm"
										onclick={() =>
											void updateReservation(
												reservation.giftSuggestionId,
												reservation.id,
												'purchase'
											)}
										disabled={actionId !== null}
									>
										Mark purchased
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onclick={() =>
											void updateReservation(
												reservation.giftSuggestionId,
												reservation.id,
												'release'
											)}
										disabled={actionId !== null}
									>
										Release
									</Button>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<div class="grid gap-5 lg:grid-cols-[minmax(12rem,0.3fr)_minmax(0,1fr)]">
			<aside class="space-y-3">
				<label class="block text-sm font-medium text-stone-800" for="family-wishlist-search">
					Find a family member
				</label>
				<Input
					id="family-wishlist-search"
					bind:value={search}
					type="search"
					placeholder="Search names"
				/>
				{#if isLoadingMembers}
					<p class="text-sm text-stone-500">Loading family members…</p>
				{:else if visibleMembers.length === 0}
					<p class="text-sm text-stone-600">No matching family members.</p>
				{:else}
					<ul class="max-h-80 space-y-1 overflow-y-auto" aria-label="Family members">
						{#each visibleMembers as member (member.id)}
							<li>
								<button
									type="button"
									class={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
										selectedMemberId === member.id
											? 'bg-emerald-800 text-white'
											: 'text-stone-700 hover:bg-stone-100'
									}`}
									aria-pressed={selectedMemberId === member.id}
									onclick={() => void selectMember(member)}
								>
									{member.displayName}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</aside>

			<div class="min-w-0 space-y-4">
				{#if isLoadingWishlist}
					<p class="text-sm text-stone-500">Loading gift ideas…</p>
				{:else if !wishlist}
					<p class="text-sm text-stone-600">Choose a family member to view their ideas.</p>
				{:else if wishlist.suggestions.length === 0}
					<p class="rounded-xl border border-dashed border-stone-300 p-5 text-sm text-stone-600">
						{wishlist.recipient.displayName} has not added any gift ideas yet.
					</p>
				{:else if visibleSuggestions.length === 0}
					<div class="space-y-3">
						<label class="block text-sm font-medium text-stone-800" for="family-gift-filter">
							Filter gift ideas
						</label>
						<input
							id="family-gift-filter"
							class="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 placeholder:text-stone-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
							bind:value={ideaSearch}
							type="search"
							placeholder="Search titles and descriptions"
						/>
						<p class="text-sm text-stone-600">No gift ideas match that search.</p>
					</div>
				{:else}
					<div class="space-y-3">
						<label class="block text-sm font-medium text-stone-800" for="family-gift-filter">
							Filter gift ideas
						</label>
						<input
							id="family-gift-filter"
							class="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 placeholder:text-stone-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
							bind:value={ideaSearch}
							type="search"
							placeholder="Search titles and descriptions"
						/>
						<ul class="space-y-3">
							{#each visibleSuggestions as suggestion (suggestion.id)}
								<li class="rounded-xl border border-stone-200 p-4">
									<div class="flex flex-col gap-4 sm:flex-row">
										{#if suggestion.imageKey}
											<button
												type="button"
												class="size-20 shrink-0 cursor-zoom-in overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:size-24"
												aria-label={`View full-size image for ${suggestion.title}`}
												onclick={() => openImage(suggestion.imageKey, suggestion.title)}
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
											<div class="flex flex-wrap items-start justify-between gap-3">
												<div>
													<h3 class="font-semibold text-stone-950">{suggestion.title}</h3>
													{#if suggestion.description}
														<p class="mt-1 text-sm whitespace-pre-wrap text-stone-600">
															{suggestion.description}
														</p>
													{/if}
												</div>
												{#if suggestion.reservationStatus === 'available'}
													<span
														class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
													>
														Available
													</span>
												{:else if suggestion.reservationStatus === 'reserved' || suggestion.reservationStatus === 'purchased'}
													<span
														class="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700"
													>
														{#if suggestion.reservationCodename}
															<CodenameAvatar codename={suggestion.reservationCodename} size="xs" />
														{/if}
														{suggestion.reservationStatus === 'purchased'
															? 'Purchased'
															: suggestion.reservedByMe
																? 'Reserved by you'
																: `Reserved by ${suggestion.reservedBy}`}
													</span>
												{/if}
											</div>
											{#if suggestion.notes}
												<p class="mt-2 text-sm whitespace-pre-wrap text-stone-600">
													Notes: {suggestion.notes}
												</p>
											{/if}
											<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
												{#if suggestion.estimatedPriceCents !== null}
													<p class="text-stone-600">
														{formatEventBudget(suggestion.estimatedPriceCents, currency)}
													</p>
												{/if}
												{#if suggestion.url}
													<a
														class="font-medium text-emerald-800 underline-offset-4 hover:underline"
														href={suggestion.url}
														target="_blank"
														rel="noopener noreferrer external"
													>
														View gift link
													</a>
												{/if}
												<time class="text-xs text-stone-500" datetime={suggestion.updatedAt}>
													Updated {formatTimestamp(suggestion.updatedAt)}
												</time>
											</div>
											{#if suggestion.reservationStatus === 'available'}
												<Button
													class="mt-3"
													type="button"
													size="sm"
													onclick={() => void updateReservation(suggestion.id, null, 'reserve')}
													disabled={actionId !== null}
												>
													{actionId === suggestion.id ? 'Reserving…' : 'Reserve gift'}
												</Button>
											{:else if suggestion.reservedByMe && suggestion.reservationStatus === 'reserved'}
												<div class="mt-3 flex flex-wrap gap-2">
													<Button
														type="button"
														size="sm"
														onclick={() =>
															void updateReservation(
																suggestion.id,
																suggestion.reservationId,
																'purchase'
															)}
														disabled={actionId !== null || !suggestion.reservationId}
													>
														{actionId === suggestion.id ? 'Updating…' : 'Mark purchased'}
													</Button>
													<Button
														type="button"
														size="sm"
														variant="outline"
														onclick={() =>
															void updateReservation(
																suggestion.id,
																suggestion.reservationId,
																'release'
															)}
														disabled={actionId !== null || !suggestion.reservationId}
													>
														Release reservation
													</Button>
												</div>
											{/if}
										</div>
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>
	</CardContent>
</Card>

<dialog
	bind:this={imageDialog}
	class="m-auto max-h-[92vh] max-w-[95vw] rounded-2xl bg-transparent p-0 shadow-2xl backdrop:bg-black/80"
	aria-label={fullSizeImage?.alt ?? 'Full-size gift image'}
	onclick={handleImageDialogClick}
	onclose={clearImage}
>
	{#if fullSizeImage}
		<img
			class="max-h-[92vh] max-w-[95vw] rounded-2xl object-contain"
			src={fullSizeImage.src}
			alt={fullSizeImage.alt}
		/>
	{/if}
</dialog>
