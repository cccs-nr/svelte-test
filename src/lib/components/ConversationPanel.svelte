<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import { trpc } from '#lib/trpc/client.js';
	import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';

	type Direction = 'asGiver' | 'asRecipient';
	type Conversations = Awaited<ReturnType<typeof trpc.conversations.list.query>>;
	type ChatMessage = NonNullable<Conversations['asGiver']>['messages'][number];

	type Props = {
		direction: Direction;
		displayName: string;
		hasAvatar: boolean;
		avatarVersion: number;
		fullHeight?: boolean;
	};

	let { direction, displayName, hasAvatar, avatarVersion, fullHeight = false }: Props = $props();
	let conversations = $state<Conversations>({ asGiver: null, asRecipient: null });
	let draft = $state('');
	let isLoading = $state(true);
	let hasLoaded = $state(false);
	let hasLoadedSuccessfully = $state(false);
	let isSending = $state(false);
	let loadError = $state<string | null>(null);
	let sendError = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let refreshPromise: Promise<void> | null = null;
	let isDisposed = false;
	let currentThread = $derived(
		direction === 'asGiver' ? conversations.asGiver : conversations.asRecipient
	);

	onMount(() => {
		isDisposed = false;
		const socket = getRealtimeSocket();
		const handleMessageUpdate = () => void refreshConversation(true);
		const handleConnect = () => void refreshConversation(true);
		socket.on('messages:changed', handleMessageUpdate);
		socket.on('event:changed', handleMessageUpdate);
		socket.on('connect', handleConnect);
		void refreshConversation();
		return () => {
			isDisposed = true;
			socket.off('messages:changed', handleMessageUpdate);
			socket.off('event:changed', handleMessageUpdate);
			socket.off('connect', handleConnect);
		};
	});

	async function refreshConversation(force = false): Promise<void> {
		if (refreshPromise) {
			await refreshPromise;
			if (force) return refreshConversation(true);
			return;
		}

		if (!hasLoaded) isLoading = true;
		loadError = null;
		const request = (async () => {
			const result = await trpc.conversations.list.query();
			if (isDisposed) return;
			conversations = result;
			hasLoadedSuccessfully = true;

			const thread = direction === 'asGiver' ? result.asGiver : result.asRecipient;
			const lastMessage = thread?.messages.at(-1);
			if (lastMessage) {
				await trpc.messages.markRead.mutate({
					direction,
					throughCreatedAt: lastMessage.sentAt
				});
			}
		})();
		refreshPromise = request;

		try {
			await request;
		} catch (error) {
			if (!isDisposed) {
				loadError =
					error instanceof TRPCClientError
						? error.message
						: 'Unable to load this conversation. Please try again.';
			}
		} finally {
			if (refreshPromise === request) refreshPromise = null;
			if (!isDisposed) {
				hasLoaded = true;
				isLoading = false;
			}
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

	async function sendMessage(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSending || isLoading || !draft.trim()) return;

		isSending = true;
		sendError = null;
		notice = null;
		try {
			await trpc.messages.send.mutate({ direction, content: draft.trim() });
			draft = '';
			notice = direction === 'asGiver' ? 'Message sent to Your Assigned Recipient.' : 'Reply sent.';
			await refreshConversation(true);
		} catch (error) {
			sendError =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to send your message. Please try again.';
		} finally {
			isSending = false;
		}
	}

	function handleComposerKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		if (event.currentTarget instanceof HTMLTextAreaElement) {
			event.currentTarget.form?.requestSubmit();
		}
	}
</script>

<Card
	class={fullHeight
		? 'flex min-h-0 flex-1 flex-col border-stone-200 bg-white'
		: 'border-stone-200 bg-white'}
>
	<CardHeader class={fullHeight ? 'shrink-0' : undefined}>
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<CardTitle>
					{#if direction === 'asGiver'}
						{conversations.asGiver
							? `Message ${conversations.asGiver.recipientDisplayName}`
							: 'Message Your Assigned Recipient'}
					{:else}
						Your Secret Santa
					{/if}
				</CardTitle>
				<CardDescription>
					{#if direction === 'asGiver'}
						Your Assigned Recipient sees your messages as “Your Secret Santa.”
					{:else}
						Your Secret Santa’s identity stays private, including in message details.
					{/if}
				</CardDescription>
			</div>
			<Button
				type="button"
				size="sm"
				variant="outline"
				onclick={() => void refreshConversation(true)}
				disabled={isLoading || isSending}
			>
				Refresh
			</Button>
		</div>
	</CardHeader>
	<CardContent
		class={fullHeight
			? 'flex min-h-0 flex-1 flex-col gap-4'
			: 'flex h-[min(70dvh,40rem)] min-h-[18rem] flex-col gap-4'}
	>
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
			<p class="text-sm text-stone-500">Loading messages…</p>
		{:else if loadError && !hasLoadedSuccessfully}
			<p class="text-sm text-stone-600">Refresh the page or try again in a moment.</p>
		{:else if !currentThread}
			<p class="text-sm text-stone-600">
				Messages become available after the organizer finalizes the assignments.
			</p>
		{:else if direction === 'asRecipient' && !currentThread.hasConversation}
			<p class="text-sm text-stone-600">
				Your Secret Santa hasn’t started a conversation yet. You can reply here when they do.
			</p>
		{:else}
			{#if currentThread.messages.length === 0}
				<p class="text-sm text-stone-600">
					{direction === 'asGiver' ? 'No messages yet. Send the first note.' : 'No messages yet.'}
				</p>
			{:else}
				<ol
					class="min-h-0 flex-1 space-y-4 overflow-y-auto"
					aria-label={direction === 'asGiver'
						? `Messages with ${conversations.asGiver?.recipientDisplayName ?? 'Your Assigned Recipient'}`
						: 'Messages with your Secret Santa'}
					aria-live="polite"
				>
					{#each currentThread.messages as message (messageKey(message))}
						<li
							class={`flex items-start gap-3 ${message.senderLabel === 'You' ? 'flex-row-reverse justify-start' : 'justify-start'}`}
						>
							{#if message.senderLabel === 'You'}
								<ProfileAvatar {displayName} {hasAvatar} imageVersion={avatarVersion} size="sm" />
							{:else if direction === 'asGiver' && conversations.asGiver}
								<ProfileAvatar
									displayName={conversations.asGiver.recipientDisplayName}
									hasAvatar={conversations.asGiver.recipientHasAvatar}
									imageSrc={resolve('/api/message-avatar')}
									imageVersion={conversations.asGiver.recipientAvatarVersion}
									size="sm"
								/>
							{:else if message.senderLabel !== 'You'}
								<ProfileAvatar displayName="Secret Santa" hasAvatar={false} size="sm" />
							{/if}
							<div
								class={`max-w-[85%] min-w-0 flex-1 rounded-2xl p-4 ${message.senderLabel === 'You' ? 'bg-emerald-100' : 'bg-stone-50'}`}
							>
								<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
									<p class="font-medium text-stone-900">{message.senderLabel}</p>
									<time class="text-xs text-stone-500" datetime={message.sentAt}>
										{formatTimestamp(message.sentAt)}
									</time>
								</div>
								<p class="mt-2 text-sm whitespace-pre-wrap text-stone-700">{message.content}</p>
							</div>
						</li>
					{/each}
				</ol>
			{/if}

			{#if currentThread.canSend && (direction === 'asGiver' || currentThread.hasConversation)}
				<form
					class="sticky bottom-0 mt-auto shrink-0 space-y-3 border-t border-stone-100 bg-white pt-3 pb-[env(safe-area-inset-bottom)]"
					onsubmit={sendMessage}
				>
					<label class="block space-y-2" for={`message-${direction}`}>
						<span class="text-sm font-medium">
							{direction === 'asGiver' ? 'Your message' : 'Your reply'}
						</span>
						<textarea
							id={`message-${direction}`}
							bind:value={draft}
							maxlength={2000}
							rows="3"
							required
							disabled={isSending}
							onkeydown={handleComposerKeydown}
							class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
						></textarea>
						<p class="text-xs text-stone-500">Press Enter to send; Shift+Enter for a new line.</p>
					</label>
					<Button type="submit" disabled={isSending || !draft.trim()}>
						{isSending
							? 'Sending…'
							: direction === 'asGiver' && !currentThread.hasConversation
								? 'Start conversation'
								: direction === 'asRecipient'
									? 'Send reply'
									: 'Send message'}
					</Button>
				</form>
			{:else if !currentThread.canSend}
				<p class="border-t border-stone-100 pt-3 text-sm text-stone-600">
					The event is complete. This conversation is available to read but cannot be changed.
				</p>
			{/if}
		{/if}
	</CardContent>
</Card>
