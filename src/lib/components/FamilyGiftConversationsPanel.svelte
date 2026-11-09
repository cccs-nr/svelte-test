<script lang="ts">
	import { onMount } from 'svelte';
	import { TRPCClientError } from '@trpc/client';
	import { UserRound } from '@lucide/svelte';
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

	type FamilyMember = Awaited<ReturnType<typeof trpc.wishlists.familyDirectory.query>>[number];
	type GiftConversation = Awaited<ReturnType<typeof trpc.giftConversations.list.query>>[number];
	type GiftThread = Awaited<ReturnType<typeof trpc.giftConversations.thread.query>>;
	type Props = {
		currentUserId: string;
		conversationId?: string | null;
		onAssociatedWishlistChange?: (recipientId: string | null) => void;
		fullHeight?: boolean;
	};

	let {
		currentUserId,
		conversationId = null,
		onAssociatedWishlistChange,
		fullHeight = false
	}: Props = $props();
	let members = $state<FamilyMember[]>([]);
	let conversations = $state<GiftConversation[]>([]);
	let selectedRecipientId = $state('');
	let currentThread = $state<GiftThread | null>(null);
	let search = $state('');
	let draft = $state('');
	let isLoading = $state(true);
	let isSending = $state(false);
	let errorMessage = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let selectedConversationId = $state<string | null>(null);
	let isFocused = $derived(conversationId !== null);
	let isDisposed = false;
	let loadSequence = 0;
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
		const refresh = () => void loadPage();
		socket.on('family-messages:changed', refresh);
		socket.on('codenames:changed', refresh);
		socket.on('event:changed', refresh);
		socket.on('connect', refresh);
		void loadPage();
		return () => {
			isDisposed = true;
			socket.off('family-messages:changed', refresh);
			socket.off('codenames:changed', refresh);
			socket.off('event:changed', refresh);
			socket.off('connect', refresh);
		};
	});

	async function loadPage(): Promise<void> {
		const sequence = ++loadSequence;
		isLoading = true;
		errorMessage = null;
		try {
			const [memberRows, conversationRows] = await Promise.all([
				conversationId ? Promise.resolve([]) : trpc.wishlists.familyDirectory.query({ search: '' }),
				trpc.giftConversations.list.query()
			]);
			if (isDisposed || sequence !== loadSequence) return;
			members = memberRows;
			conversations = conversationRows;
			if (conversationId) {
				selectedConversationId = conversationId;
				const existing = conversationRows.find(
					(conversation) => conversation.id === conversationId
				);
				if (existing) await openConversation(existing);
				else {
					currentThread = null;
					errorMessage = 'This conversation is not available to your account.';
				}
			} else if (selectedConversationId) {
				const existing = conversationRows.find(
					(conversation) => conversation.id === selectedConversationId
				);
				if (existing) await openConversation(existing);
				else {
					selectedConversationId = null;
					currentThread = null;
				}
			}
		} catch (error) {
			if (!isDisposed) {
				errorMessage =
					error instanceof TRPCClientError
						? error.message
						: 'Unable to load family conversations. Please try again.';
			}
		} finally {
			if (!isDisposed && sequence === loadSequence) isLoading = false;
		}
	}

	async function openConversation(conversation: GiftConversation): Promise<void> {
		errorMessage = null;
		selectedConversationId = conversation.id;
		try {
			const thread = await trpc.giftConversations.thread.query({
				conversationId: conversation.id
			});
			if (isDisposed || selectedConversationId !== conversation.id) return;
			currentThread = thread;
			onAssociatedWishlistChange?.(thread.recipientId);
			const lastMessage = thread.messages.at(-1);
			if (lastMessage && thread.unreadCount > 0) {
				await trpc.giftConversations.markRead.mutate({ conversationId: conversation.id });
				currentThread = { ...thread, unreadCount: 0 };
			}
		} catch (error) {
			onAssociatedWishlistChange?.(null);
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to open this conversation. Please try again.';
		}
	}

	async function startConversation(
		type: 'recipient_visible' | 'private_coordination'
	): Promise<void> {
		if (!selectedRecipientId) return;
		errorMessage = null;
		notice = null;
		try {
			const thread =
				type === 'recipient_visible'
					? await trpc.giftConversations.openDiscussion.mutate({
							recipientId: selectedRecipientId
						})
					: await trpc.giftConversations.joinCoordination.mutate({
							recipientId: selectedRecipientId
						});
			currentThread = thread;
			selectedConversationId = thread.id;
			onAssociatedWishlistChange?.(thread.recipientId);
			if (thread.unreadCount > 0) {
				await trpc.giftConversations.markRead.mutate({ conversationId: thread.id });
				currentThread = { ...thread, unreadCount: 0 };
			}
			notice =
				type === 'recipient_visible'
					? 'Opened the Wishlist Discussion.'
					: 'Joined the private Gift Coordination conversation.';
			conversations = await trpc.giftConversations.list.query();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to open this conversation. Please try again.';
		}
	}

	async function sendMessage(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!currentThread || !currentThread.canSend || isSending || !draft.trim()) return;

		isSending = true;
		errorMessage = null;
		notice = null;
		try {
			await trpc.giftConversations.send.mutate({
				conversationId: currentThread.id,
				content: draft.trim()
			});
			draft = '';
			currentThread = await trpc.giftConversations.thread.query({
				conversationId: currentThread.id
			});
			conversations = await trpc.giftConversations.list.query();
		} catch (error) {
			errorMessage =
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

	function formatTimestamp(value: string): string {
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(value)
		);
	}

	function conversationTypeLabel(type: GiftConversation['type']): string {
		return type === 'recipient_visible' ? 'Wishlist Discussion' : 'Gift Coordination';
	}
</script>

<Card
	class={fullHeight
		? 'flex min-h-0 flex-1 flex-col border-stone-200 bg-white'
		: 'border-stone-200 bg-white'}
>
	<CardHeader class={fullHeight ? 'shrink-0' : undefined}>
		<CardTitle>
			{currentThread
				? `${conversationTypeLabel(currentThread.type)} · ${currentThread.recipientLabel}`
				: isFocused
					? 'Conversation unavailable'
					: 'Family messages'}
		</CardTitle>
		<CardDescription>
			{#if currentThread}
				{currentThread.type === 'recipient_visible'
					? 'The Wishlist Recipient can read and reply.'
					: 'Only joined Wishlist Gifters can read this conversation.'}
			{:else}
				Wishlist Discussion includes its Wishlist Recipient. Private Gift Coordination excludes the
				Wishlist Recipient. Other participants appear by codename until reveal.
			{/if}
		</CardDescription>
	</CardHeader>
	<CardContent class={fullHeight ? 'flex min-h-0 flex-1 flex-col gap-5' : 'space-y-5'}>
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

		<div
			class={isFocused
				? fullHeight
					? 'flex min-h-0 flex-1 flex-col gap-5'
					: 'grid gap-5'
				: 'grid gap-5 lg:grid-cols-[minmax(14rem,0.35fr)_minmax(0,1fr)]'}
		>
			{#if !isFocused}
				<aside class="space-y-4">
					<div class="space-y-2">
						<label class="block text-sm font-medium text-stone-800" for="gift-chat-search">
							Find a family member
						</label>
						<input
							id="gift-chat-search"
							class="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 placeholder:text-stone-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
							bind:value={search}
							type="search"
							placeholder="Search names"
						/>
						<label class="sr-only" for="gift-chat-recipient">Choose a recipient</label>
						<select
							id="gift-chat-recipient"
							class="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
							bind:value={selectedRecipientId}
						>
							<option value="">Choose a family member</option>
							{#each visibleMembers as member (member.id)}
								<option value={member.id}>{member.displayName}</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-2">
						<Button
							type="button"
							variant="outline"
							onclick={() => void startConversation('recipient_visible')}
							disabled={!selectedRecipientId || isLoading}
						>
							Open Wishlist Discussion
						</Button>
						<Button
							type="button"
							onclick={() => void startConversation('private_coordination')}
							disabled={!selectedRecipientId || isLoading}
						>
							Join Gift Coordination
						</Button>
					</div>

					<div class="space-y-2 border-t border-stone-200 pt-4">
						<h3 class="text-sm font-semibold text-stone-800">Your conversations</h3>
						{#if isLoading}
							<p class="text-sm text-stone-500">Loading conversations…</p>
						{:else if conversations.length === 0}
							<p class="text-sm text-stone-600">No family conversations yet.</p>
						{:else}
							<ul class="space-y-1">
								{#each conversations as conversation (conversation.id)}
									<li>
										<button
											type="button"
											class={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
												selectedConversationId === conversation.id
													? 'bg-emerald-800 text-white'
													: 'text-stone-700 hover:bg-stone-100'
											}`}
											aria-current={selectedConversationId === conversation.id ? 'true' : undefined}
											onclick={() => void openConversation(conversation)}
										>
											<span class="block font-medium">
												{conversationTypeLabel(conversation.type)} · {conversation.recipientLabel}
											</span>
											{#if conversation.unreadCount > 0}
												<span class="mt-1 block text-xs"> {conversation.unreadCount} unread </span>
											{/if}
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</aside>
			{/if}

			<section
				class={fullHeight
					? 'flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-stone-200'
					: 'flex min-h-[24rem] min-w-0 flex-col rounded-xl border border-stone-200'}
			>
				{#if currentThread}
					{#if currentThread.messages.length === 0}
						<p class="flex-1 p-4 text-sm text-stone-600">No messages yet. Send the first note.</p>
					{:else}
						<ol
							class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
							aria-label={`${conversationTypeLabel(currentThread.type)} messages`}
							aria-live="polite"
						>
							{#each currentThread.messages as message (message.id)}
								<li
									class={`flex items-start gap-2 ${message.senderLabel === 'You' ? 'flex-row-reverse justify-start' : 'justify-start'}`}
								>
									{#if message.senderCodename}
										<CodenameAvatar codename={message.senderCodename} size="sm" />
									{:else}
										<span
											class="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-600"
											aria-hidden="true"
										>
											<UserRound size={16} />
										</span>
									{/if}
									<div
										class={`max-w-[90%] rounded-2xl px-4 py-3 ${
											message.senderLabel === 'You' ? 'bg-emerald-100' : 'bg-stone-100'
										}`}
									>
										<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
											<p class="text-sm font-medium text-stone-900">{message.senderLabel}</p>
											<time class="text-xs text-stone-500" datetime={message.sentAt}>
												{formatTimestamp(message.sentAt)}
											</time>
										</div>
										<p class="mt-2 text-sm whitespace-pre-wrap text-stone-700">
											{message.content}
										</p>
									</div>
								</li>
							{/each}
						</ol>
					{/if}

					{#if currentThread.canSend}
						<form
							class="shrink-0 space-y-2 border-t border-stone-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
							onsubmit={sendMessage}
						>
							<label class="sr-only" for="gift-message-draft">Write a message</label>
							<textarea
								id="gift-message-draft"
								class="min-h-20 w-full resize-y rounded-lg border border-stone-300 bg-white p-3 text-sm text-stone-950 placeholder:text-stone-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
								bind:value={draft}
								maxlength="2000"
								placeholder="Write a message…"
								onkeydown={handleComposerKeydown}></textarea>
							<div class="flex items-center justify-between gap-3">
								<p class="text-xs text-stone-500">Enter to send · Shift+Enter for a new line</p>
								<Button type="submit" disabled={isSending || !draft.trim()}>
									{isSending ? 'Sending…' : 'Send'}
								</Button>
							</div>
						</form>
					{:else}
						<p class="border-t border-stone-200 p-3 text-sm text-stone-600">
							This event is complete. Messages are available to read but cannot be changed.
						</p>
					{/if}
				{:else}
					<p class="m-auto p-6 text-center text-sm text-stone-600">
						{isFocused
							? 'This conversation is unavailable.'
							: 'Choose a family member and open a Wishlist Discussion or join a private Gift Coordination conversation.'}
					</p>
				{/if}
			</section>
		</div>
	</CardContent>
</Card>
