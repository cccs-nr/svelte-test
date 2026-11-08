<script lang="ts">
	import { onMount } from 'svelte';
	import { TRPCClientError } from '@trpc/client';
	import { trpc } from '#lib/trpc/client.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';

	type Conversations = Awaited<ReturnType<typeof trpc.conversations.list.query>>;
	type Direction = 'asGiver' | 'asRecipient';
	type ChatMessage = NonNullable<Conversations['asGiver']>['messages'][number];

	let conversations = $state<Conversations>({ asGiver: null, asRecipient: null });
	let drafts = $state<Record<Direction, string>>({ asGiver: '', asRecipient: '' });
	let isLoading = $state(true);
	let hasLoaded = $state(false);
	let hasLoadedSuccessfully = $state(false);
	let isSending = $state<Direction | null>(null);
	let loadError = $state<string | null>(null);
	let sendError = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let refreshPromise: Promise<void> | null = null;
	let isDisposed = false;

	onMount(() => {
		isDisposed = false;
		void refreshConversations();
		const interval = window.setInterval(() => void refreshConversations(), 15_000);
		return () => {
			isDisposed = true;
			window.clearInterval(interval);
		};
	});

	async function refreshConversations(force = false): Promise<void> {
		if (refreshPromise) {
			await refreshPromise;
			if (!force) return;
			return refreshConversations();
		}

		if (!hasLoaded) isLoading = true;
		loadError = null;
		const request = (async () => {
			const result = await trpc.conversations.list.query();
			if (isDisposed) return;
			conversations = result;
			hasLoadedSuccessfully = true;

			const readRequests: Promise<{ markedCount: number }>[] = [];
			const lastAsGiverMessage = result.asGiver?.messages.at(-1);
			const lastAsRecipientMessage = result.asRecipient?.messages.at(-1);
			if (lastAsGiverMessage) {
				readRequests.push(
					trpc.messages.markRead.mutate({
						direction: 'asGiver',
						throughCreatedAt: lastAsGiverMessage.sentAt
					})
				);
			}
			if (lastAsRecipientMessage) {
				readRequests.push(
					trpc.messages.markRead.mutate({
						direction: 'asRecipient',
						throughCreatedAt: lastAsRecipientMessage.sentAt
					})
				);
			}
			await Promise.all(readRequests);
		})();
		refreshPromise = request;

		try {
			await request;
		} catch (error) {
			if (!isDisposed) {
				loadError =
					error instanceof TRPCClientError
						? error.message
						: 'Unable to load your private conversations.';
			}
		} finally {
			if (refreshPromise === request) refreshPromise = null;
			if (!isDisposed) {
				hasLoaded = true;
				isLoading = false;
			}
		}
	}

	function getErrorMessage(error: unknown, fallback: string): string {
		if (error instanceof TRPCClientError) return error.message;
		if (error instanceof Error && error.message) return error.message;
		return fallback;
	}

	async function sendMessage(event: SubmitEvent, direction: Direction): Promise<void> {
		event.preventDefault();
		if (isSending || isLoading) return;

		const content = drafts[direction].trim();
		if (!content) return;

		isSending = direction;
		sendError = null;
		notice = null;
		try {
			await trpc.messages.send.mutate({ direction, content });
			drafts[direction] = '';
			notice = 'Message sent.';
			await refreshConversations(true);
		} catch (error) {
			sendError = getErrorMessage(error, 'Unable to send your message.');
		} finally {
			isSending = null;
		}
	}

	function formatTimestamp(value: string): string {
		return new Intl.DateTimeFormat('en-CA', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	function messageKey(message: ChatMessage): string {
		return message.id;
	}
</script>

<svelte:head>
	<title>Private messages | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">Participant</p>
			<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
				Private messages
			</h1>
			<p class="mt-3 max-w-2xl text-stone-600">
				Ask a gift question without revealing who you are. Recipients see giver messages as “Your
				Secret Santa.”
			</p>
		</div>
		<Button
			type="button"
			variant="outline"
			onclick={() => void refreshConversations(true)}
			disabled={isLoading || isSending !== null}
		>
			Refresh messages
		</Button>
	</div>

	{#if loadError}
		<p
			class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
			role="alert"
		>
			{loadError}
		</p>
	{/if}
	{#if sendError}
		<p
			class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
			role="alert"
		>
			{sendError}
		</p>
	{/if}
	{#if notice}
		<p class="text-sm text-emerald-800" role="status">{notice}</p>
	{/if}

	{#if isLoading}
		<Card class="border-stone-200 bg-white">
			<CardContent class="py-8 text-sm text-stone-500">Loading your conversations…</CardContent>
		</Card>
	{:else if loadError && !hasLoadedSuccessfully}
		<Card class="border-stone-200 bg-white">
			<CardHeader>
				<CardTitle>Conversations unavailable</CardTitle>
				<CardDescription>Refresh the page or try again in a moment.</CardDescription>
			</CardHeader>
		</Card>
	{:else if !conversations.asGiver && !conversations.asRecipient}
		<Card class="border-stone-200 bg-white">
			<CardHeader>
				<CardTitle>Conversations unlock after the draw</CardTitle>
				<CardDescription>
					Once assignments are finalized, you can message your recipient and reply to your own
					Secret Santa.
				</CardDescription>
			</CardHeader>
		</Card>
	{:else}
		<div class="grid gap-6 lg:grid-cols-2">
			{#if conversations.asGiver}
				<Card class="border-stone-200 bg-white">
					<CardHeader>
						<CardTitle>Message {conversations.asGiver.recipientDisplayName}</CardTitle>
						<CardDescription>
							Your recipient sees your messages as “Your Secret Santa.”
						</CardDescription>
					</CardHeader>
					<CardContent class="space-y-5">
						{#if conversations.asGiver.messages.length === 0}
							<p class="text-sm text-stone-600">No messages yet. Send the first note.</p>
						{:else}
							<ol
								class="max-h-[28rem] space-y-4 overflow-y-auto"
								aria-label={`Messages with ${conversations.asGiver.recipientDisplayName}`}
								aria-live="polite"
							>
								{#each conversations.asGiver.messages as message (messageKey(message))}
									<li class="rounded-xl bg-stone-50 p-4">
										<div class="flex items-baseline justify-between gap-3">
											<p class="font-medium text-stone-900">{message.senderLabel}</p>
											<time class="text-xs text-stone-500" datetime={message.sentAt}>
												{formatTimestamp(message.sentAt)}
											</time>
										</div>
										<p class="mt-2 text-sm whitespace-pre-wrap text-stone-700">
											{message.content}
										</p>
									</li>
								{/each}
							</ol>
						{/if}

						<form class="space-y-3" onsubmit={(event) => sendMessage(event, 'asGiver')}>
							<label class="block space-y-2" for="giver-message">
								<span class="text-sm font-medium">Your message</span>
								<textarea
									id="giver-message"
									bind:value={drafts.asGiver}
									maxlength={2000}
									rows="3"
									required
									disabled={isSending !== null}
									class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
								></textarea>
							</label>
							<Button type="submit" disabled={isSending !== null || !drafts.asGiver.trim()}>
								{isSending === 'asGiver'
									? 'Sending…'
									: conversations.asGiver.hasConversation
										? 'Send message'
										: 'Start conversation'}
							</Button>
						</form>
					</CardContent>
				</Card>
			{/if}

			{#if conversations.asRecipient}
				<Card class="border-stone-200 bg-white">
					<CardHeader>
						<CardTitle>Your Secret Santa</CardTitle>
						<CardDescription>
							Your Secret Santa’s identity stays private, including in message details.
						</CardDescription>
					</CardHeader>
					<CardContent class="space-y-5">
						{#if !conversations.asRecipient.hasConversation}
							<p class="text-sm text-stone-600">
								Your Secret Santa hasn’t started a conversation yet. You can reply here when they
								do.
							</p>
						{:else if conversations.asRecipient.messages.length === 0}
							<p class="text-sm text-stone-600">No messages yet.</p>
						{:else}
							<ol
								class="max-h-[28rem] space-y-4 overflow-y-auto"
								aria-label="Messages with your Secret Santa"
								aria-live="polite"
							>
								{#each conversations.asRecipient.messages as message (messageKey(message))}
									<li class="rounded-xl bg-stone-50 p-4">
										<div class="flex items-baseline justify-between gap-3">
											<p class="font-medium text-stone-900">{message.senderLabel}</p>
											<time class="text-xs text-stone-500" datetime={message.sentAt}>
												{formatTimestamp(message.sentAt)}
											</time>
										</div>
										<p class="mt-2 text-sm whitespace-pre-wrap text-stone-700">
											{message.content}
										</p>
									</li>
								{/each}
							</ol>
						{/if}

						{#if conversations.asRecipient.hasConversation}
							<form class="space-y-3" onsubmit={(event) => sendMessage(event, 'asRecipient')}>
								<label class="block space-y-2" for="recipient-message">
									<span class="text-sm font-medium">Your reply</span>
									<textarea
										id="recipient-message"
										bind:value={drafts.asRecipient}
										maxlength={2000}
										rows="3"
										required
										disabled={isSending !== null}
										class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
									></textarea>
								</label>
								<Button type="submit" disabled={isSending !== null || !drafts.asRecipient.trim()}>
									{isSending === 'asRecipient' ? 'Sending…' : 'Send reply'}
								</Button>
							</form>
						{/if}
					</CardContent>
				</Card>
			{/if}
		</div>
	{/if}
</section>
