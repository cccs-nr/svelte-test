<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import {
		Check,
		CheckCheck,
		Eraser,
		Gift,
		Lock,
		MessageCircle,
		Send,
		Users,
		X
	} from '@lucide/svelte';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import { trpc } from '#lib/trpc/client.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import CodenameAvatar from '#lib/components/CodenameAvatar.svelte';
	import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '#lib/components/ui/card/index.js';

	type Thread = Awaited<ReturnType<typeof trpc.conversations.thread.query>>;
	type Props = {
		conversationId: string;
		onWishlistOwnerChange?: (ownerId: string | null) => void;
		fullHeight?: boolean;
		isLoading?: boolean;
		/** Rendered at the start and end of the compact header row. */
		leading?: Snippet;
		actions?: Snippet;
	};

	let {
		conversationId,
		onWishlistOwnerChange,
		fullHeight = false,
		isLoading = $bindable(true),
		leading,
		actions
	}: Props = $props();
	let thread = $state<Thread | null>(null);
	let draft = $state('');
	let participantsDialog = $state<HTMLDialogElement>();
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

	export function refresh(): Promise<void> {
		return loadConversation();
	}

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

	let isPrivate = $derived(thread?.type === 'gift_coordination');

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

<Card
	style="background-color: var({isPrivate
		? '--convo-private-bg'
		: '--convo-open-bg'}); border-color: var({isPrivate ? '--accent-red' : '--primary'})"
	class={fullHeight
		? 'flex min-h-0 flex-1 flex-col rounded-none border-0 shadow-none sm:rounded-xl sm:border-2 sm:shadow-sm'
		: ''}
>
	<CardHeader
		style="border-color: var({isPrivate ? '--accent-red' : '--primary'})"
		class={fullHeight ? 'shrink-0 border-b-4 px-4 py-2 sm:border-b-0 sm:py-0' : undefined}
	>
		<div class="flex w-full flex-nowrap items-center justify-between gap-2 sm:gap-3">
			<div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
				{#if thread}
					<ProfileAvatar
						displayName={thread.wishlistOwner.displayName}
						hasAvatar={thread.wishlistOwner.avatar.hasAvatar}
						imageVersion={thread.wishlistOwner.avatar.avatarVersion}
						imageSrc={profileImageUrl(thread.wishlistOwner.avatar.userId)}
						size="sm"
						class="hidden sm:inline-grid"
					/>
				{/if}
				<CardTitle class="flex min-w-0 items-center gap-2 text-lg sm:text-xl">
					{#if thread?.type === 'gift_coordination'}
						<Lock size={20} aria-hidden="true" class="shrink-0 text-(--accent-red)" />
					{:else if thread}
						<MessageCircle size={20} aria-hidden="true" class="shrink-0 text-primary" />
					{/if}
					<span class="min-w-0 truncate">
						{thread?.title ?? (isLoading ? 'Loading conversation…' : 'Conversation')}
					</span>
				</CardTitle>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				{#if thread}
					<Button
						variant="outline"
						size="icon"
						aria-label={`Participants (${thread.participants.length})`}
						title="Participants"
						onclick={() => participantsDialog?.showModal()}
					>
						<Users aria-hidden="true" />
					</Button>
				{/if}
				{@render actions?.()}
			</div>
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
			{#if (thread.messages?.length ?? 0) === 0}
				<p class="min-h-0 flex-1 overflow-y-auto py-4 text-sm text-muted-foreground">
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
								class={`max-w-[85%] min-w-0 flex-1 rounded-2xl p-4 ${message.isOwnMessage ? (thread.type === 'gift_coordination' ? 'bg-(--convo-private-bubble)' : 'bg-(--convo-open-bubble)') : 'bg-stone-50'}`}
							>
								<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
									<p class="app-convo-text font-medium text-stone-900">{message.senderLabel}</p>
									<time class="app-convo-meta text-stone-600" datetime={message.sentAt}>
										{formatTimestamp(message.sentAt)}
									</time>
								</div>
								<p class="app-convo-text mt-2 whitespace-pre-wrap text-stone-800">
									{message.content}
								</p>
								{#if message.receipt}
									<p
										class="app-convo-meta mt-2 flex items-center justify-end gap-1.5 font-medium text-stone-700"
									>
										{#if message.receipt.seenLabels.length > 0}
											<CheckCheck size={18} aria-hidden="true" />
											Seen by {message.receipt.seenLabels.join(', ')}
										{:else}
											<Check size={18} aria-hidden="true" />
											Sent · not seen yet
										{/if}
									</p>
								{/if}
								{#if message.seenBy.length > 0}
									<ul
										class="mt-2 flex flex-wrap items-center justify-end gap-1"
										aria-label={`Read up to here by ${message.seenBy.map((reader) => reader.label).join(', ')}`}
									>
										{#each message.seenBy as reader (reader.label)}
											<li title={`Seen by ${reader.label}`}>
												{#if reader.avatar.type === 'profile'}
													<ProfileAvatar
														displayName={reader.label}
														hasAvatar={reader.avatar.hasAvatar}
														imageVersion={reader.avatar.avatarVersion}
														imageSrc={profileImageUrl(reader.avatar.userId)}
														size="sm"
														class="size-6 text-sm"
													/>
												{:else if reader.avatar.type === 'codename'}
													<CodenameAvatar codename={reader.avatar.codename} size="sm" />
												{:else}
													<span
														class="grid size-6 place-items-center rounded-full bg-emerald-100 text-emerald-800"
													>
														<Gift size={12} aria-hidden="true" />
													</span>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}
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
						class="app-control"
						bind:value={draft}
						maxlength="2000"
						placeholder="Write a message…"
						disabled={isSending}
						onkeydown={handleComposerKeydown}></textarea>
					<div class="flex flex-wrap items-center gap-2 sm:gap-3">
						{@render leading?.()}
						<p class="app-hint hidden min-w-0 flex-1 text-sm text-stone-600 lg:block">
							Enter to send · Shift+Enter for a new line
						</p>
						<div class="ml-auto flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								onclick={() => (draft = '')}
								disabled={isSending || !draft}
							>
								<Eraser aria-hidden="true" />
								Clear
							</Button>
							<Button type="submit" disabled={isSending || !draft.trim()}>
								<Send aria-hidden="true" />
								{isSending ? 'Sending…' : 'Send'}
							</Button>
						</div>
					</div>
				</form>
			{:else}
				<div class="flex shrink-0 flex-wrap items-center gap-3 border-t border-stone-200 pt-3">
					{@render leading?.()}
					<p class="min-w-0 flex-1 text-sm text-stone-600">
						This event is complete. Messages are available to read but cannot be changed.
					</p>
				</div>
			{/if}
		{:else if !isLoading}
			<p class="m-auto p-6 text-center text-sm text-stone-600">This conversation is unavailable.</p>
			<div class="shrink-0 border-t border-stone-200 pt-3">{@render leading?.()}</div>
		{/if}
	</CardContent>
</Card>

{#if thread}
	<dialog
		bind:this={participantsDialog}
		class="app-dialog m-auto max-h-[92dvh] w-[min(95vw,26rem)] overflow-y-auto rounded-xl p-0 shadow-2xl backdrop:bg-black/60"
		aria-labelledby="participants-title"
		onclick={(event) => {
			if (event.target === participantsDialog) participantsDialog?.close();
		}}
	>
		<div class="space-y-4 p-5">
			<h2 id="participants-title" class="flex items-center gap-2 text-xl font-semibold">
				<Users aria-hidden="true" />
				Participants
			</h2>
			<ul class="space-y-2" aria-label="Conversation participants">
				{#each thread.participants as participant, index (`${participant.label}-${index}`)}
					<li
						class="flex items-center gap-3 rounded-xl bg-secondary p-2 text-base text-secondary-foreground"
					>
						{#if participant.avatar.type === 'profile'}
							<ProfileAvatar
								displayName={participant.label}
								hasAvatar={participant.avatar.hasAvatar}
								imageVersion={participant.avatar.avatarVersion}
								imageSrc={profileImageUrl(participant.avatar.userId)}
								size="sm"
								class="size-7 text-sm"
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
			<div class="flex justify-end">
				<Button type="button" onclick={() => participantsDialog?.close()}>
					<X aria-hidden="true" />
					Close
				</Button>
			</div>
		</div>
	</dialog>
{/if}
