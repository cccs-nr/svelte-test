<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { formatEventBudget } from '#lib/models/event.js';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import { trpc } from '#lib/trpc/client.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import CodenameAvatar from '#lib/components/CodenameAvatar.svelte';
	import {
		CardAction,
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
		initialRecipientId?: string | null;
		showDirectory?: boolean;
		showReservations?: boolean;
		markAssignedRecipientViewed?: boolean;
	};

	let {
		currentUserId,
		giftBudgetCents,
		currency,
		initialRecipientId = null,
		showDirectory = true,
		showReservations = showDirectory,
		markAssignedRecipientViewed = false
	}: Props = $props();
	let members = $state<FamilyMember[]>([]);
	let selectedMemberId = $state<string | null>(null);
	let wishlist = $state<FamilyWishlist | null>(null);
	let myReservations = $state<Reservation[]>([]);
	let revealedMapping = $state<CodenameMapping | null>(null);
	let search = $state('');
	let isLoadingMembers = $state(true);
	let isLoadingWishlist = $state(false);
	let actionId = $state<string | null>(null);
	let isOpeningConversation = $state(false);
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

	onMount(() => {
		isDisposed = false;
		const socket = getRealtimeSocket();
		const refreshSelectedWishlist = () => {
			if (selectedMemberId) void loadWishlist(selectedMemberId);
			if (showReservations) void loadMyReservations();
		};
		const refreshReveal = () => void loadRevealMapping();
		const handleConnect = () => {
			if (showDirectory) void loadMembers();
			else if (initialRecipientId) void loadWishlist(initialRecipientId);
			refreshSelectedWishlist();
			refreshReveal();
		};
		socket.on('family-wishlist:changed', refreshSelectedWishlist);
		socket.on('recipient-wishlist:changed', refreshSelectedWishlist);
		socket.on('gift-status:changed', refreshSelectedWishlist);
		socket.on('codenames:changed', refreshReveal);
		socket.on('event:changed', refreshSelectedWishlist);
		socket.on('connect', handleConnect);
		if (showDirectory) void loadMembers();
		else if (initialRecipientId) {
			selectedMemberId = initialRecipientId;
			void loadWishlist(initialRecipientId);
		}
		refreshReveal();
		return () => {
			isDisposed = true;
			socket.off('family-wishlist:changed', refreshSelectedWishlist);
			socket.off('recipient-wishlist:changed', refreshSelectedWishlist);
			socket.off('gift-status:changed', refreshSelectedWishlist);
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
			if (showReservations) await loadMyReservations();
			const targetMember = initialRecipientId
				? members.find((member) => member.id === initialRecipientId)
				: selectedMemberId
					? members.find((member) => member.id === selectedMemberId)
					: members.find((member) => member.id !== currentUserId);
			if (targetMember) {
				selectedMemberId = targetMember.id;
				await loadWishlist(targetMember.id);
			} else if (initialRecipientId) {
				errorMessage = 'This participant could not be found.';
			}
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load participants. Please try again.';
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
			if (markAssignedRecipientViewed) {
				await trpc.wishlists.markAssignedRecipientWishlistViewed.mutate();
			}
			if (!isDisposed && sequence === requestSequence) wishlist = result;
		} catch (error) {
			if (isDisposed || sequence !== requestSequence) return;
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load this wishlist. Please try again.';
		} finally {
			if (!isDisposed && sequence === requestSequence) isLoadingWishlist = false;
		}
	}

	async function selectMember(member: FamilyMember): Promise<void> {
		selectedMemberId = member.id;
		wishlist = null;
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

	async function openGiftConversation(
		type: 'recipient_visible' | 'private_coordination'
	): Promise<void> {
		if (!selectedMemberId || isOpeningConversation) return;
		isOpeningConversation = true;
		errorMessage = null;
		notice = null;
		try {
			const thread =
				type === 'recipient_visible'
					? await trpc.conversations.openDiscussion.mutate({
							wishlistOwnerId: selectedMemberId
						})
					: await trpc.conversations.joinCoordination.mutate({
							wishlistOwnerId: selectedMemberId
						});
			await goto(resolve('/app/messages/[conversationId]', { conversationId: thread.id }));
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to open this conversation. Please try again.';
		} finally {
			isOpeningConversation = false;
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

<Card>
	<CardHeader>
		<CardTitle>
			{showDirectory ? 'Everyone’s wishlists' : 'Gift ideas'}
		</CardTitle>
		<CardDescription>
			{#if showDirectory}
				Browse gift ideas from other participants. Wishlist Gifters appear by codename until the
				organizer reveals identities.
			{:else if wishlist}
				{wishlist.suggestions.length}
				{wishlist.suggestions.length === 1 ? ' gift idea' : ' gift ideas'} · Updated
				{wishlist.suggestions[0] ? formatTimestamp(wishlist.suggestions[0].updatedAt) : 'not yet'}
			{:else}
				Review gift ideas and ask the Wishlist Recipient questions.
			{/if}
			{#if giftBudgetCents !== null}
				<br />Suggested gift price: {formatEventBudget(giftBudgetCents, currency)} (a suggestion, not
				a limit).
			{/if}
		</CardDescription>
		{#if !showDirectory && wishlist}
			<CardAction class="flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					variant="outline"
					onclick={() => void openGiftConversation('recipient_visible')}
					disabled={isOpeningConversation || isLoadingWishlist}
				>
					Talk to {wishlist.recipient.displayName}
				</Button>
				<Button
					type="button"
					size="sm"
					onclick={() => void openGiftConversation('private_coordination')}
					disabled={isOpeningConversation || isLoadingWishlist}
				>
					Plan gifts privately
				</Button>
			</CardAction>
		{/if}
	</CardHeader>
	<CardContent class="space-y-5">
		{#if errorMessage}
			<p class="app-alert app-alert--error" role="alert">
				{errorMessage}
			</p>
		{/if}
		{#if notice}
			<p class="app-notice" role="status">{notice}</p>
		{/if}
		{#if revealedMapping}
			<section
				class="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
				aria-labelledby="codename-reveal-title"
			>
				<h3 id="codename-reveal-title" class="font-semibold text-emerald-950">
					The big reveal is here!
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

		{#if showReservations && myReservations.length > 0}
			<section class="space-y-3" aria-labelledby="my-reservations-title">
				<div>
					<h3 id="my-reservations-title" class="font-semibold text-stone-900">Your reservations</h3>
					<p class="mt-1 text-sm text-stone-600">
						These are the gift ideas you reserved for other participants.
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

		<div
			class={showDirectory
				? 'grid gap-5 lg:grid-cols-[minmax(12rem,0.3fr)_minmax(0,1fr)]'
				: 'grid gap-5'}
		>
			{#if showDirectory}
				<aside class="space-y-3">
					<label class="block text-sm font-medium text-stone-800" for="family-wishlist-search">
						Find a participant
					</label>
					<Input
						id="family-wishlist-search"
						bind:value={search}
						type="search"
						placeholder="Search names"
					/>
					{#if isLoadingMembers}
						<p class="text-sm text-stone-500">Loading participants…</p>
					{:else if visibleMembers.length === 0}
						<p class="text-sm text-stone-600">No matching participants.</p>
					{:else}
						<ul class="max-h-80 space-y-1 overflow-y-auto" aria-label="Participants">
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
			{/if}

			<div class="min-w-0 space-y-4">
				{#if isLoadingWishlist}
					<p class="text-sm text-stone-500">Loading gift ideas…</p>
				{:else if !wishlist}
					<p class="text-sm text-stone-600">
						{showDirectory
							? 'Choose a participant to view their ideas.'
							: 'This wishlist is not available.'}
					</p>
				{:else}
					{#if wishlist.suggestions.length === 0}
						<p class="rounded-xl border border-dashed border-stone-300 p-5 text-sm text-stone-600">
							{wishlist.recipient.displayName} has not added any gift ideas yet.
						</p>
					{:else}
						<ul class="space-y-3 lg:hidden" aria-label="Gift ideas">
							{#each wishlist.suggestions as suggestion (suggestion.id)}
								<li class="app-surface rounded-xl border border-border p-3">
									<div class="flex items-start gap-3">
										{#if suggestion.imageKey}
											<button
												type="button"
												class="size-16 shrink-0 cursor-zoom-in overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
											<p class="font-semibold text-foreground">
												{#if suggestion.url}
													<a
														class="text-primary underline-offset-4 hover:underline"
														href={suggestion.url}
														target="_blank"
														rel="noopener noreferrer external"
													>
														{suggestion.title}
													</a>
												{:else}
													{suggestion.title}
												{/if}
											</p>
											{#if suggestion.description}
												<p class="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
													{suggestion.description}
												</p>
											{/if}
											{#if suggestion.notes}
												<p class="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
													Notes: {suggestion.notes}
												</p>
											{/if}
										</div>
									</div>
									<div class="mt-3 flex flex-wrap items-center justify-between gap-2">
										<p class="text-sm font-medium text-foreground">
											{suggestion.estimatedPriceCents === null
												? 'No estimated price'
												: formatEventBudget(suggestion.estimatedPriceCents, currency)}
										</p>
										{#if suggestion.reservationStatus === 'available'}
											<span class="app-status app-status--success"> Available </span>
										{:else if suggestion.reservationStatus === 'reserved' || suggestion.reservationStatus === 'purchased'}
											<span class="app-status app-status--neutral">
												{#if suggestion.reservationStatus === 'reserved' && suggestion.reservationCodename}
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
									{#if suggestion.reservationStatus === 'available'}
										<Button
											type="button"
											class="mt-3 w-full"
											size="sm"
											onclick={() => void updateReservation(suggestion.id, null, 'reserve')}
											disabled={actionId !== null}
										>
											{actionId === suggestion.id ? 'Reserving…' : 'Reserve Wishlist Gift'}
										</Button>
									{:else if suggestion.reservedByMe && suggestion.reservationStatus === 'reserved'}
										<div class="mt-3 flex flex-wrap gap-2">
											<Button
												type="button"
												class="flex-1"
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
												class="flex-1"
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
									<time
										class="mt-2 block text-xs text-muted-foreground"
										datetime={suggestion.updatedAt}
									>
										Updated {formatTimestamp(suggestion.updatedAt)}
									</time>
								</li>
							{/each}
						</ul>
						<div class="app-table-scroll -mx-2 hidden overflow-x-auto px-2 lg:block">
							<table class="w-full min-w-[900px] border-collapse text-left text-sm">
								<thead>
									<tr
										class="border-b border-stone-200 text-xs tracking-wide text-stone-500 uppercase"
									>
										<th scope="col" class="px-3 py-3 font-medium">Gift idea</th>
										<th scope="col" class="px-3 py-3 font-medium">Price</th>
										<th scope="col" class="px-3 py-3 font-medium">Status</th>
										<th scope="col" class="px-3 py-3 font-medium">Updated</th>
										<th scope="col" class="px-3 py-3 font-medium">Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each wishlist.suggestions as suggestion (suggestion.id)}
										<tr class="border-b border-stone-100 last:border-0">
											<th scope="row" class="max-w-2xl px-3 py-4 font-normal">
												<div class="flex items-start gap-3">
													{#if suggestion.imageKey}
														<button
															type="button"
															class="size-14 shrink-0 cursor-zoom-in overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
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
													<div class="min-w-0">
														<p class="font-semibold">
															{#if suggestion.url}
																<a
																	class="text-emerald-800 underline-offset-4 hover:underline"
																	href={suggestion.url}
																	target="_blank"
																	rel="noopener noreferrer external"
																>
																	{suggestion.title}
																</a>
															{:else}
																<span class="text-stone-950">{suggestion.title}</span>
															{/if}
														</p>
														{#if suggestion.description}
															<p class="mt-1 whitespace-pre-wrap text-stone-600">
																{suggestion.description}
															</p>
														{/if}
														{#if suggestion.notes}
															<p class="mt-1 whitespace-pre-wrap text-stone-600">
																Notes: {suggestion.notes}
															</p>
														{/if}
													</div>
												</div>
											</th>
											<td class="px-3 py-4 align-top text-stone-700">
												{suggestion.estimatedPriceCents === null
													? '—'
													: formatEventBudget(suggestion.estimatedPriceCents, currency)}
											</td>
											<td class="px-3 py-4 align-top">
												{#if suggestion.reservationStatus === 'available'}
													<span class="app-status app-status--success"> Available </span>
												{:else if suggestion.reservationStatus === 'reserved' || suggestion.reservationStatus === 'purchased'}
													<span class="app-status app-status--neutral">
														{#if suggestion.reservationStatus === 'reserved' && suggestion.reservationCodename}
															<CodenameAvatar codename={suggestion.reservationCodename} size="xs" />
														{/if}
														{suggestion.reservationStatus === 'purchased'
															? 'Purchased'
															: suggestion.reservedByMe
																? 'Reserved by you'
																: `Reserved by ${suggestion.reservedBy}`}
													</span>
												{:else}
													<span class="text-stone-500">—</span>
												{/if}
											</td>
											<td class="px-3 py-4 align-top text-stone-700">
												<time datetime={suggestion.updatedAt}>
													{formatTimestamp(suggestion.updatedAt)}
												</time>
											</td>
											<td class="px-3 py-4 align-top">
												{#if suggestion.reservationStatus === 'available'}
													<Button
														type="button"
														size="sm"
														onclick={() => void updateReservation(suggestion.id, null, 'reserve')}
														disabled={actionId !== null}
													>
														{actionId === suggestion.id ? 'Reserving…' : 'Reserve Wishlist Gift'}
													</Button>
												{:else if suggestion.reservedByMe && suggestion.reservationStatus === 'reserved'}
													<div class="flex flex-wrap gap-2">
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
												{:else}
													<span class="text-stone-500">—</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</CardContent>
</Card>

<dialog
	bind:this={imageDialog}
	class="m-auto max-h-[92dvh] max-w-[95vw] rounded-2xl bg-transparent p-0 shadow-2xl backdrop:bg-black/80"
	aria-label={fullSizeImage?.alt ?? 'Full-size gift image'}
	onclick={handleImageDialogClick}
	onclose={clearImage}
>
	{#if fullSizeImage}
		<img
			class="max-h-[92dvh] max-w-[95vw] rounded-2xl object-contain"
			src={fullSizeImage.src}
			alt={fullSizeImage.alt}
		/>
	{/if}
</dialog>
