<script lang="ts">
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { Pencil, Plus, RefreshCw, Save, Trash2, X } from '@lucide/svelte';
	import type { PageProps } from './$types';
	import PageGuide from '#lib/components/PageGuide.svelte';
	import PageSummary from '#lib/components/PageSummary.svelte';
	import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import { formatEventBudget, formatBudgetInput } from '#lib/models/event.js';
	import { trpc } from '#lib/trpc/client.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';

	type GiftSuggestion = Awaited<ReturnType<typeof trpc.wishlists.mine.query>>[number];

	let { data }: PageProps = $props();
	let suggestions = $state<GiftSuggestion[]>([]);
	let editingId = $state<string | null>(null);
	let title = $state('');
	let description = $state('');
	let url = $state('');
	let estimatedPrice = $state('');
	let notes = $state('');
	let selectedFiles = $state<FileList>();
	let removeCurrentImage = $state(false);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let isDeleting = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let isLoadFailed = $state(false);
	let loadPromise: Promise<boolean> | null = null;
	let isFormDisabled = $derived(isSaving || isLoading || isDeleting !== null);
	let ideaDialog = $state<HTMLDialogElement>();
	let imageDialog = $state<HTMLDialogElement>();
	let fullSizeImage = $state<{ src: string; alt: string } | null>(null);

	onMount(() => {
		const socket = getRealtimeSocket();
		const handleWishlistUpdate = () => void loadWishlists(true);
		const handleConnect = () => void loadWishlists(true);
		socket.on('wishlist:changed', handleWishlistUpdate);
		socket.on('connect', handleConnect);
		void loadWishlists();
		return () => {
			socket.off('wishlist:changed', handleWishlistUpdate);
			socket.off('connect', handleConnect);
		};
	});

	async function loadWishlists(force = false): Promise<boolean> {
		if (loadPromise) {
			if (!force) return loadPromise;
			await loadPromise;
			return loadWishlists();
		}
		isLoading = true;
		isLoadFailed = false;
		errorMessage = null;
		const request = (async () => {
			const wishlist = await trpc.wishlists.mine.query();
			suggestions = wishlist;
			return true;
		})();
		loadPromise = request;

		try {
			return await request;
		} catch (error) {
			isLoadFailed = true;
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load your wishlists. Please try again.';
			return false;
		} finally {
			if (loadPromise === request) loadPromise = null;
			isLoading = false;
		}
	}

	function startEditing(suggestion: GiftSuggestion): void {
		editingId = suggestion.id;
		title = suggestion.title;
		description = suggestion.description;
		url = suggestion.url ?? '';
		estimatedPrice =
			suggestion.estimatedPriceCents === null
				? ''
				: formatBudgetInput(suggestion.estimatedPriceCents);
		notes = suggestion.notes;
		selectedFiles = undefined;
		removeCurrentImage = false;
		errorMessage = null;
		successMessage = null;
		ideaDialog?.showModal();
	}

	function openNewSuggestionDialog(): void {
		resetEditor();
		errorMessage = null;
		successMessage = null;
		ideaDialog?.showModal();
	}

	function resetEditor(): void {
		editingId = null;
		title = '';
		description = '';
		url = '';
		estimatedPrice = '';
		notes = '';
		selectedFiles = undefined;
		removeCurrentImage = false;
	}

	function closeIdeaDialog(): void {
		if (!isSaving) ideaDialog?.close();
	}

	function handleIdeaDialogClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) closeIdeaDialog();
	}

	function getErrorMessage(error: unknown, fallback: string): string {
		if (error instanceof TRPCClientError) return error.message;
		if (error instanceof Error && error.message) return error.message;
		return fallback;
	}

	async function checkImageResponse(response: Response, fallback: string): Promise<void> {
		if (response.ok) return;

		const responseBody = await response.text();
		let message = `${fallback} (HTTP ${response.status}).`;
		if (responseBody) {
			try {
				const payload: unknown = JSON.parse(responseBody);
				if (
					typeof payload === 'object' &&
					payload !== null &&
					'error' in payload &&
					typeof payload.error === 'string'
				) {
					message = payload.error;
				}
			} catch (error) {
				if (!(error instanceof SyntaxError)) throw error;
			}
		}
		throw new Error(message);
	}

	async function uploadImage(suggestionId: string, file: File): Promise<void> {
		const formData = new FormData();
		formData.set('suggestionId', suggestionId);
		formData.set('image', file, file.name);
		const response = await fetch(resolve('/api/wishlist-images'), {
			method: 'POST',
			body: formData
		});
		await checkImageResponse(response, 'Unable to upload the image.');
	}

	async function deleteImage(suggestionId: string): Promise<void> {
		const imageEndpoint = new URL(resolve('/api/wishlist-images'), window.location.origin);
		imageEndpoint.searchParams.set('suggestionId', suggestionId);
		const response = await fetch(imageEndpoint, { method: 'DELETE' });
		await checkImageResponse(response, 'Unable to remove the image.');
	}

	async function saveSuggestion(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isFormDisabled) return;

		const file = selectedFiles?.[0];
		if (file && file.size > data.maxImageBytes) {
			errorMessage = `Choose an image no larger than ${formatFileSize(data.maxImageBytes)}.`;
			return;
		}

		isSaving = true;
		errorMessage = null;
		successMessage = null;
		const wasEditing = editingId !== null;

		try {
			const input = { title, description, url, estimatedPrice, notes };
			const saved = editingId
				? await trpc.wishlists.update.mutate({ ...input, id: editingId })
				: await trpc.wishlists.create.mutate(input);

			if (file) {
				try {
					await uploadImage(saved.id, file);
				} catch (error) {
					editingId = saved.id;
					await loadWishlists();
					errorMessage = `Suggestion saved, but its image could not be uploaded: ${getErrorMessage(
						error,
						'Please try again.'
					)}`;
					return;
				}
			} else if (removeCurrentImage && saved.imageKey) {
				await deleteImage(saved.id);
			}

			const refreshed = await loadWishlists();
			if (refreshed) {
				successMessage = wasEditing ? 'Suggestion updated.' : 'Suggestion saved.';
				ideaDialog?.close();
				resetEditor();
			}
		} catch (error) {
			errorMessage = getErrorMessage(error, 'Unable to save the gift suggestion.');
		} finally {
			isSaving = false;
		}
	}

	async function deleteSuggestion(suggestion: GiftSuggestion): Promise<void> {
		if (isFormDisabled) return;
		if (!globalThis.confirm(`Delete “${suggestion.title}” from your wishlist?`)) return;

		isDeleting = suggestion.id;
		errorMessage = null;
		successMessage = null;
		try {
			await trpc.wishlists.delete.mutate({ id: suggestion.id });
			if (editingId === suggestion.id) resetEditor();
			if (await loadWishlists()) successMessage = 'Suggestion deleted.';
		} catch (error) {
			errorMessage = getErrorMessage(error, 'Unable to delete the gift suggestion.');
		} finally {
			isDeleting = null;
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

	function formatFileSize(bytes: number): string {
		const mebibyte = 1024 * 1024;
		if (bytes >= mebibyte) {
			const precision = bytes % mebibyte === 0 ? 0 : 1;
			return `${(bytes / mebibyte).toFixed(precision)} MiB`;
		}
		return `${Math.ceil(bytes / 1024)} KiB`;
	}
</script>

<svelte:head>
	<title>My Wishlist | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<div class="flex items-center gap-4">
		<ProfileAvatar
			displayName={data.user.displayName}
			hasAvatar={data.hasAvatar}
			imageVersion={data.avatarVersion}
			size="lg"
		/>
		<div class="min-w-0 flex-1">
			<p class="app-page-kicker">My Wishlist</p>
			<div class="app-page-titlebar">
				<h1 class="app-page-title mt-2">
					{data.user.displayName}
				</h1>
				<PageGuide pageId="wishlist">
					<p>
						This is your own wishlist. Everyone in the event can read it, so the person buying your
						gift knows what you would enjoy. You can add and change ideas at any time.
					</p>
					<ol>
						<li>Press <strong>Add Gift Idea</strong>.</li>
						<li>
							Type a <strong>Gift name</strong>, and add a description if it helps. Add each gift as
							its own idea instead of combining several things.
						</li>
						<li>
							If you found it online, paste the <strong>Link to gift</strong>. You can also add a
							suggested price and a picture.
						</li>
						<li>Press <strong>Add gift idea</strong> at the bottom of the form to save it.</li>
						<li>
							To change or remove an idea later, press the button beside it. Ideas that someone has
							already reserved cannot be deleted.
						</li>
					</ol>
					<p>
						Prices are only suggestions. Nobody has to buy everything on your list or spend an exact
						amount. If someone has a question about an idea, they will send you a message.
					</p>
				</PageGuide>
			</div>
			<PageSummary simple="Add gift ideas so others know what you would like."
				>This is your own wishlist. Everyone in the event can read it, so the person buying your
				gift knows what you would enjoy.</PageSummary
			>
		</div>
	</div>

	{#if errorMessage}
		<p class="app-alert app-alert--error" role="alert">
			{errorMessage}
		</p>
	{/if}
	{#if successMessage}
		<p class="app-notice" role="status">{successMessage}</p>
	{/if}
	<div id="wishlist-panel" class="min-w-0">
		<Card id="my-wishlist">
			<CardHeader class="flex flex-row flex-wrap items-center justify-between gap-4">
				<div class="min-w-0">
					<CardTitle>My Gift Ideas</CardTitle>
					<CardDescription essential>
						{#if data.giftBudgetCents !== null}
							Suggested gift price: {formatEventBudget(data.giftBudgetCents, data.currency)} (a suggestion,
							not a limit).
						{:else}
							Other participants can browse your gift ideas.
						{/if}
					</CardDescription>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						onclick={() => void loadWishlists(true)}
						disabled={isLoading || isSaving || isDeleting !== null}
					>
						<RefreshCw aria-hidden="true" />
						Refresh
					</Button>
					<Button
						type="button"
						size="lg"
						onclick={openNewSuggestionDialog}
						disabled={isFormDisabled}
					>
						<Plus size={16} aria-hidden="true" />
						Add Gift Idea
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{#if isLoading}
					<p class="text-sm text-stone-600">Loading your wishlist…</p>
				{:else if isLoadFailed}
					<p class="text-sm text-stone-600">Your wishlist could not be loaded. Try refreshing.</p>
				{:else if suggestions.length === 0}
					<p class="text-sm text-stone-600">
						No ideas yet. Add your first gift idea to get started.
					</p>
				{:else}
					<ul class="space-y-3 lg:hidden" aria-label="Your gift ideas">
						{#each suggestions as suggestion (suggestion.id)}
							<li class="app-surface rounded-xl border border-border p-3 sm:p-4">
								<div class="flex items-start gap-3">
									{#if suggestion.imageKey}
										<button
											type="button"
											class="size-16 shrink-0 cursor-zoom-in overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
										<p class="font-semibold text-foreground">
											{#if suggestion.url}
												<ExternalLink href={suggestion.url}>{suggestion.title}</ExternalLink>
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
								<div
									class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"
								>
									<div class="text-sm text-muted-foreground">
										<span class="font-medium text-foreground">
											{suggestion.estimatedPriceCents === null
												? 'No estimated price'
												: formatEventBudget(suggestion.estimatedPriceCents, 'CAD')}
										</span>
										<span aria-hidden="true"> · </span>
										<time datetime={suggestion.updatedAt}>
											{formatTimestamp(suggestion.updatedAt)}
										</time>
									</div>
									<div class="flex gap-2">
										<Button
											type="button"
											size="sm"
											variant="outline"
											onclick={() => startEditing(suggestion)}
											disabled={isSaving || isDeleting !== null}
										>
											<Pencil aria-hidden="true" />
											Edit
										</Button>
										<Button
											type="button"
											size="sm"
											variant="destructive"
											onclick={() => deleteSuggestion(suggestion)}
											disabled={isSaving || isDeleting !== null}
										>
											<Trash2 aria-hidden="true" />
											{isDeleting === suggestion.id ? 'Deleting…' : 'Delete'}
										</Button>
									</div>
								</div>
							</li>
						{/each}
					</ul>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						class="app-table-scroll -mx-2 hidden overflow-x-auto px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:block"
						role="region"
						aria-label="Your gift ideas"
						tabindex="0"
					>
						<table class="w-full min-w-[760px] border-collapse text-left text-sm">
							<thead>
								<tr
									class="border-b border-stone-200 text-sm tracking-wide text-stone-600 uppercase"
								>
									<th scope="col" class="px-3 py-3 font-medium">Gift idea</th>
									<th scope="col" class="px-3 py-3 font-medium">Estimated price</th>
									<th scope="col" class="px-3 py-3 font-medium">Updated</th>
									<th scope="col" class="px-3 py-3 font-medium">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each suggestions as suggestion (suggestion.id)}
									<tr class="border-b border-stone-100 last:border-0">
										<th scope="row" class="max-w-2xl px-3 py-4 font-normal">
											<div class="flex items-start gap-3">
												{#if suggestion.imageKey}
													<button
														type="button"
														class="size-14 shrink-0 cursor-zoom-in overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
														aria-label={`View full-size image for ${suggestion.title}`}
														onclick={() =>
															openSuggestionImage(suggestion.imageKey, suggestion.title)}
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
															<ExternalLink href={suggestion.url}>{suggestion.title}</ExternalLink>
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
												: formatEventBudget(suggestion.estimatedPriceCents, 'CAD')}
										</td>
										<td class="px-3 py-4 align-top text-stone-700">
											<time datetime={suggestion.updatedAt}>
												{formatTimestamp(suggestion.updatedAt)}
											</time>
										</td>
										<td class="px-3 py-4 align-top">
											<div class="flex flex-wrap gap-2">
												<Button
													type="button"
													size="sm"
													variant="outline"
													onclick={() => startEditing(suggestion)}
													disabled={isSaving || isDeleting !== null}
												>
													<Pencil aria-hidden="true" />
													Edit
												</Button>
												<Button
													type="button"
													size="sm"
													variant="destructive"
													onclick={() => deleteSuggestion(suggestion)}
													disabled={isSaving || isDeleting !== null}
												>
													<Trash2 aria-hidden="true" />
													{isDeleting === suggestion.id ? 'Deleting…' : 'Delete'}
												</Button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<dialog
		bind:this={ideaDialog}
		class="app-dialog m-auto max-h-[92dvh] w-[min(95vw,42rem)] overflow-y-auto rounded-2xl shadow-2xl backdrop:bg-black/60"
		aria-labelledby="gift-idea-dialog-title"
		onclick={handleIdeaDialogClick}
		onclose={resetEditor}
	>
		<div class="p-5 sm:p-7">
			<div class="mb-6 flex items-start justify-between gap-4">
				<div>
					<h2 id="gift-idea-dialog-title" class="text-xl font-semibold">
						{editingId ? 'Edit a gift idea' : 'Add a gift idea'}
					</h2>
					<p class="mt-1 text-sm text-stone-600">
						{#if data.giftBudgetCents !== null}
							Suggested gift price: {formatEventBudget(data.giftBudgetCents, data.currency)} (a suggestion,
							not a limit).
						{:else}
							Your event budget will appear here once the organizer sets it.
						{/if}
					</p>
				</div>
				<Button type="button" variant="outline" onclick={closeIdeaDialog} disabled={isSaving}>
					<X aria-hidden="true" />
					Close
				</Button>
			</div>

			{#if errorMessage}
				<p class="app-alert app-alert--error mb-5" role="alert">
					{errorMessage}
				</p>
			{/if}

			<form class="grid gap-5" onsubmit={saveSuggestion}>
				<div class="space-y-2">
					<label class="text-base font-semibold" for="wishlist-title">Gift name</label>
					<Input
						id="wishlist-title"
						bind:value={title}
						maxlength={120}
						autocomplete="off"
						required
						disabled={isFormDisabled}
					/>
				</div>
				<div class="space-y-2">
					<label class="text-base font-semibold" for="wishlist-description">Description</label>
					<textarea
						id="wishlist-description"
						bind:value={description}
						maxlength={2000}
						rows="3"
						disabled={isFormDisabled}
						class="app-control"></textarea>
				</div>
				<div class="space-y-2">
					<label class="text-base font-semibold" for="wishlist-url">Link to gift (URL)</label>
					<Input
						id="wishlist-url"
						type="url"
						bind:value={url}
						maxlength={2048}
						placeholder="https://example.com/item"
						disabled={isFormDisabled}
					/>
				</div>
				<div class="space-y-2">
					<label class="text-base font-semibold" for="wishlist-price">Estimated price (CAD)</label>
					<Input
						id="wishlist-price"
						type="text"
						inputmode="decimal"
						bind:value={estimatedPrice}
						maxlength={12}
						placeholder="25.00"
						disabled={isFormDisabled}
					/>
					<p class="app-hint text-sm text-stone-600">
						Enter dollars with up to two decimal places.
					</p>
				</div>
				<div class="space-y-2">
					<label class="text-base font-semibold" for="wishlist-image">Optional image</label>
					<Input
						id="wishlist-image"
						type="file"
						accept="image/jpeg,image/png,image/webp"
						bind:files={selectedFiles}
						disabled={isFormDisabled}
					/>
					<p class="app-hint text-sm text-stone-600">
						JPEG, PNG, or WebP up to {formatFileSize(data.maxImageBytes)}.
					</p>
					{#if editingId && suggestions.find((suggestion) => suggestion.id === editingId)?.imageKey}
						<label class="flex items-center gap-2 text-sm text-stone-600">
							<input
								type="checkbox"
								bind:checked={removeCurrentImage}
								disabled={isFormDisabled || Boolean(selectedFiles?.length)}
							/>
							Remove the current image
						</label>
					{/if}
				</div>
				<div class="flex flex-wrap justify-end gap-3">
					<Button type="button" variant="outline" onclick={closeIdeaDialog} disabled={isSaving}>
						<X aria-hidden="true" />
						Cancel
					</Button>
					<Button type="submit" disabled={isFormDisabled}>
						<Save aria-hidden="true" />
						{isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Add gift idea'}
					</Button>
				</div>
			</form>
		</div>
	</dialog>

	<dialog
		bind:this={imageDialog}
		class="app-dialog m-auto max-h-[95dvh] w-[95vw] max-w-6xl rounded-2xl p-3 shadow-2xl backdrop:bg-black/85 sm:p-5"
		aria-label="Full-size wishlist image"
		onclick={handleImageDialogClick}
		onkeydown={handleImageDialogKeydown}
		onclose={clearFullSizeImage}
	>
		{#if fullSizeImage}
			<div class="relative">
				<Button
					type="button"
					variant="outline"
					size="icon"
					class="absolute top-2 right-2 z-10"
					aria-label="Close full-size image"
					onclick={closeImage}
				>
					<X aria-hidden="true" />
				</Button>
				<img
					class="mx-auto max-h-[86dvh] w-full rounded-lg object-contain"
					src={fullSizeImage.src}
					alt={fullSizeImage.alt}
				/>
			</div>
		{/if}
	</dialog>
</section>
