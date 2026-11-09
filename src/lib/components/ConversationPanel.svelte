<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { Gift } from '@lucide/svelte';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import { trpc } from '#lib/trpc/client.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import CodenameAvatar from '#lib/components/CodenameAvatar.svelte';
	import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';

	type Thread = Awaited<ReturnType<typeof trpc.conversations.thread.query>>;
	type Props = {
		conversationId: string;
		onWishlistOwnerChange?: (ownerId: string | null) => void;
		fullHeight?: boolean;
	};

	let { conversationId, onWishlistOwnerChange, fullHeight = false }: Props = $props();
	let thread = $state<Thread | null>(null);
	let draft = $state('');
	let isLoading = $state(true);
	let isSending = $state(false);
	let errorMessage = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let isDisposed = false;
	let loadSequence = 0;

	onMount(() => {
		isDisposed = false;
		const socket = getRealtimeSocket();
		const refresh = () => void loadConversation();
		socket.on('messages:changed', refresh);
		socket.on('connect', refresh);
		void loadConversation();
		return () => {
			isDisposed = true;
			socket.off('messages:changed', refresh);
			socket.off('connect', refresh);
		};
	});

	async function loadConversation(): Promise<void> {
		const sequence = ++loadSequence;
		isLoading = true;
		errorMessage = null;
		try {
			const result = await trpc.conversations.thread.query({ conversationId });
			if (isDisposed || sequence !== loadSequence) return;
			thread = result;
			onWishlistOwnerChange?.(result.wishlistOwner.userId);
			if (result.unreadCount > 0) {
				await trpc.conversations.markRead.mutate({ conversationId });
				if (isDisposed || sequence !== loadSequence) return;
				thread = { ...result, unreadCount: 0 };
			}
		} catch (error) {
			if (!isDisposed) {
				onWishlistOwnerChange?.(null);
				errorMessage =
					error instanceof TRPCClientError
						? error.message
						: 'Unable to load this conversation. Please try again.';
			}
		} finally {
			if (!isDisposed && sequence === loadSequence) isLoading = false;
		}
	}

	async function sendMessage(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!thread?.canSend || isSending || !draft.trim()) return;

		isSending = true;
		errorMessage = null;
		notice = null;
		try {
			await trpc.conversations.send.mutate({
				conversationId,
				content: draft.trim()
			});
			draft = '';
			notice = 'Message sent.';
			await loadConversation();
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

	function profileImageUrl(userId: string): string {
		return resolve('/api/conversation-avatar/[conversationId]/[participantId]', {
			conversationId,
			participantId: userId
		});
	}
</script>

<Card class={fullHeight ? 'flex min-h-0 flex-1 flex-col' : ''}>
	<CardHeader class={fullHeight ? 'shrink-0' : undefined}>
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="flex min-w-0 items-center gap-3">
				{#if thread}
					<ProfileAvatar
						displayName={thread.wishlistOwner.displayName}
						hasAvatar={thread.wishlistOwner.avatar.hasAvatar}
						imageVersion={thread.wishlistOwner.avatar.avatarVersion}
						imageSrc={profileImageUrl(thread.wishlistOwner.avatar.userId)}
						size="md"
					/>
				{/if}
				<div class="min-w-0">
					<CardTitle
						>{thread?.title ?? (isLoading ? 'Loading conversation…' : 'Conversation')}</CardTitle
					>
					<CardDescription>
						{#if thread}
							{#if thread.type === 'wishlist_discussion'}
								The wishlist owner and invited gift givers can read and reply.
							{:else}
								Private to participating gift givers. The wishlist owner is excluded.
							{/if}
						{:else}
							Conversation access is limited to its authorized participants.
						{/if}
					</CardDescription>
				</div>
			</div>
			<Button
				type="button"
				size="sm"
				variant="outline"
				onclick={() => void loadConversation()}
				disabled={isLoading || isSending}
			>
				Refresh
			</Button>
		</div>
	</CardHeader>
	<CardContent
		class={fullHeight
			? 'flex min-h-0 flex-1 flex-col gap-3'
			: 'flex h-[min(70dvh,40rem)] min-h-[18rem] flex-col gap-3'}
	>
		{#if errorMessage}
			<p class="app-alert app-alert--error shrink-0" role="alert">
				{errorMessage}
			</p>
		{/if}
		{#if notice}
			<p class="app-notice shrink-0" role="status">{notice}</p>
		{/if}

		{#if thread}
			<div class="shrink-0 border-b border-stone-200 pb-3">
				<p class="mb-2 text-xs font-medium text-stone-500">Participants</p>
				<ul class="flex flex-wrap gap-2" aria-label="Conversation participants">
					{#each thread.participants as participant, index (`${participant.label}-${index}`)}
						<li
							class="inline-flex items-center gap-2 rounded-full bg-stone-100 py-1 pr-3 pl-1 text-sm text-stone-700"
						>
							{#if participant.avatar.type === 'profile'}
								<ProfileAvatar
									displayName={participant.label}
									hasAvatar={participant.avatar.hasAvatar}
									imageVersion={participant.avatar.avatarVersion}
									imageSrc={profileImageUrl(participant.avatar.userId)}
									size="sm"
									class="size-7 text-xs"
								/>
							{:else if participant.avatar.type === 'codename'}
								<CodenameAvatar codename={participant.avatar.codename} size="sm" />
							{:else}
								<span
									class="grid size-7 place-items-center rounded-full bg-emerald-100 text-emerald-800"
									aria-label="Secret Santa identity hidden"
								>
									<Gift size={14} aria-hidden="true" />
								</span>
							{/if}
							{participant.label}
						</li>
					{/each}
				</ul>
			</div>

			{#if (thread.messages?.length ?? 0) === 0}
				<p class="min-h-0 flex-1 overflow-y-auto py-4 text-sm text-stone-600">
					No messages yet. Send the first note.
				</p>
			{:else}
				<ol
					class="min-h-0 flex-1 space-y-3 overflow-y-auto py-2"
					aria-label={`${thread.title} messages`}
					aria-live="polite"
				>
					{#each thread.messages ?? [] as message (message.id)}
						<li
							class={`flex items-start gap-3 ${message.isOwnMessage ? 'flex-row-reverse justify-start' : 'justify-start'}`}
						>
							{#if message.senderAvatar.type === 'profile'}
								<ProfileAvatar
									displayName={message.senderLabel}
									hasAvatar={message.senderAvatar.hasAvatar}
									imageVersion={message.senderAvatar.avatarVersion}
									imageSrc={profileImageUrl(message.senderAvatar.userId)}
									size="sm"
								/>
							{:else if message.senderAvatar.type === 'codename'}
								<CodenameAvatar codename={message.senderAvatar.codename} size="sm" />
							{:else}
								<span
									class="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800"
									aria-label="Secret Santa identity hidden"
								>
									<Gift size={16} aria-hidden="true" />
								</span>
							{/if}
							<div
								class={`max-w-[85%] min-w-0 flex-1 rounded-2xl p-4 ${message.isOwnMessage ? 'bg-emerald-100' : 'bg-stone-50'}`}
							>
								<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
									<p class="font-medium text-stone-900">{message.senderLabel}</p>
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

			{#if thread.canSend}
				<form
					class="shrink-0 space-y-2 border-t border-stone-200 pt-3 pb-[env(safe-area-inset-bottom)]"
					onsubmit={sendMessage}
				>
					<label class="sr-only" for="conversation-message-draft">Write a message</label>
					<textarea
						id="conversation-message-draft"
						class="min-h-20 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						bind:value={draft}
						maxlength="2000"
						placeholder="Write a message…"
						disabled={isSending}
						onkeydown={handleComposerKeydown}></textarea>
					<div class="flex items-center justify-between gap-3">
						<p class="text-xs text-stone-500">Enter to send · Shift+Enter for a new line</p>
						<Button type="submit" disabled={isSending || !draft.trim()}>
							{isSending ? 'Sending…' : 'Send'}
						</Button>
					</div>
				</form>
			{:else}
				<p class="shrink-0 border-t border-stone-200 pt-3 text-sm text-stone-600">
					This event is complete. Messages are available to read but cannot be changed.
				</p>
			{/if}
		{:else if !isLoading}
			<p class="m-auto p-6 text-center text-sm text-stone-600">This conversation is unavailable.</p>
		{/if}
	</CardContent>
</Card>
