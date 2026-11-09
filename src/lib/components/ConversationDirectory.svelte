<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { Gift } from '@lucide/svelte';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import { trpc } from '#lib/trpc/client.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import CodenameAvatar from '#lib/components/CodenameAvatar.svelte';
	import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';

	type ConversationItem = Awaited<ReturnType<typeof trpc.conversations.list.query>>[number];
	type ConversationKind = ConversationItem['type'];

	let { compact = false }: { compact?: boolean } = $props();
	let conversations = $state<ConversationItem[]>([]);
	let search = $state('');
	let filter = $state<'all' | ConversationKind>('all');
	let isLoading = $state(true);
	let errorMessage = $state<string | null>(null);
	let loadSequence = 0;
	let isDisposed = false;
	let visibleConversations = $derived(
		conversations.filter((conversation) => {
			const query = search.trim().toLocaleLowerCase();
			const searchable = [
				conversation.title,
				conversation.wishlistOwner.displayName,
				conversation.lastMessagePreview ?? '',
				...conversation.participants.map((participant) => participant.label)
			]
				.join(' ')
				.toLocaleLowerCase();
			return (
				(filter === 'all' || conversation.type === filter) && (!query || searchable.includes(query))
			);
		})
	);
	let displayedConversations = $derived(
		compact ? visibleConversations.slice(0, 3) : visibleConversations
	);

	onMount(() => {
		isDisposed = false;
		const socket = getRealtimeSocket();
		const refresh = () => void loadConversations();
		socket.on('messages:changed', refresh);
		socket.on('connect', refresh);
		void loadConversations();
		return () => {
			isDisposed = true;
			socket.off('messages:changed', refresh);
			socket.off('connect', refresh);
		};
	});

	async function loadConversations(): Promise<void> {
		const sequence = ++loadSequence;
		isLoading = true;
		errorMessage = null;
		try {
			const result = await trpc.conversations.list.query();
			if (isDisposed || sequence !== loadSequence) return;
			conversations = result;
		} catch (error) {
			if (!isDisposed) {
				errorMessage =
					error instanceof TRPCClientError
						? error.message
						: 'Unable to load your conversations. Please try again.';
			}
		} finally {
			if (!isDisposed && sequence === loadSequence) isLoading = false;
		}
	}

	function formatTimestamp(value: string): string {
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(value)
		);
	}

	function profileImageUrl(conversation: ConversationItem, userId: string): string {
		return resolve('/api/conversation-avatar/[conversationId]/[participantId]', {
			conversationId: conversation.id,
			participantId: userId
		});
	}
</script>

<section class="space-y-5" aria-labelledby="conversation-directory-title">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			{#if !compact}
				<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">
					Conversations
				</p>
			{/if}
			<h1
				id="conversation-directory-title"
				class={compact
					? 'text-xl font-semibold text-stone-950'
					: 'mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl'}
			>
				{compact ? 'Recent conversations' : 'Messages'}
			</h1>
			{#if !compact}
				<p class="mt-3 max-w-2xl text-stone-600">
					Every conversation is organized around a participant’s wishlist.
				</p>
			{/if}
		</div>
		{#if compact}
			<a
				class="text-sm font-medium text-emerald-800 underline-offset-4 hover:underline"
				href={resolve('/app/messages')}
			>
				View all messages
			</a>
		{/if}
	</div>

	{#if !compact}
		<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
			<div class="space-y-2">
				<label class="text-sm font-medium text-stone-800" for="conversation-search">
					Search conversations
				</label>
				<Input
					id="conversation-search"
					type="search"
					bind:value={search}
					placeholder="Wishlist owner or conversation"
				/>
			</div>
			<div class="space-y-2">
				<label class="text-sm font-medium text-stone-800" for="conversation-filter">
					Filter by type
				</label>
				<select
					id="conversation-filter"
					class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					bind:value={filter}
				>
					<option value="all">All conversations</option>
					<option value="wishlist_discussion">Talk to wishlist owner</option>
					<option value="gift_coordination">Private gift planning</option>
				</select>
			</div>
		</div>
	{/if}

	{#if errorMessage}
		<p
			class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
			role="alert"
		>
			{errorMessage}
		</p>
	{/if}

	{#if isLoading}
		<p class="text-sm text-stone-500" role="status">Loading your conversations…</p>
	{:else if displayedConversations.length === 0}
		<div class="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center">
			<p class="font-medium text-stone-900">
				{conversations.length === 0 ? 'No conversations yet' : 'No matching conversations'}
			</p>
			<p class="mt-1 text-sm text-stone-600">
				{conversations.length === 0
					? 'Conversations appear here after the draw is finalized or you start a wishlist conversation.'
					: 'Try a different search or conversation type.'}
			</p>
		</div>
	{:else}
		<ul class="space-y-3" aria-label="Your wishlist conversations">
			{#each displayedConversations as conversation (conversation.id)}
				<li>
					<article
						class="rounded-xl border border-stone-200 bg-white p-3 transition hover:border-emerald-300 hover:bg-emerald-50/40 sm:p-4"
					>
						<a
							class="flex min-w-0 items-start gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 sm:gap-4"
							href={resolve('/app/messages/[conversationId]', {
								conversationId: conversation.id
							})}
						>
							<ProfileAvatar
								displayName={conversation.wishlistOwner.displayName}
								hasAvatar={conversation.wishlistOwner.avatar.hasAvatar}
								imageVersion={conversation.wishlistOwner.avatar.avatarVersion}
								imageSrc={profileImageUrl(conversation, conversation.wishlistOwner.avatar.userId)}
								size="md"
							/>
							<div class="min-w-0 flex-1">
								<span class="flex flex-wrap items-center justify-between gap-2">
									<span class="font-semibold text-stone-950">{conversation.title}</span>
									{#if conversation.unreadCount > 0}
										<span
											class="rounded-full bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white"
										>
											{conversation.unreadCount} unread
										</span>
									{/if}
								</span>
								{#if conversation.lastMessagePreview}
									<span class="mt-1 block truncate text-sm text-stone-600">
										{conversation.lastMessageSenderLabel
											? `${conversation.lastMessageSenderLabel}: `
											: ''}
										{conversation.lastMessagePreview}
									</span>
								{/if}
								<ul class="mt-3 flex flex-wrap gap-1.5" aria-label="Conversation participants">
									{#each conversation.participants as participant, index (`${participant.label}-${index}`)}
										<li
											class="inline-flex items-center gap-1.5 rounded-full bg-stone-100 py-0.5 pr-2 pl-0.5 text-xs text-stone-700"
										>
											{#if participant.avatar.type === 'profile'}
												<ProfileAvatar
													displayName={participant.label}
													hasAvatar={participant.avatar.hasAvatar}
													imageVersion={participant.avatar.avatarVersion}
													imageSrc={profileImageUrl(conversation, participant.avatar.userId)}
													size="sm"
													class="size-6 text-[0.625rem]"
												/>
											{:else if participant.avatar.type === 'codename'}
												<CodenameAvatar codename={participant.avatar.codename} size="xs" />
											{:else}
												<span
													class="grid size-6 place-items-center rounded-full bg-emerald-100 text-emerald-800"
													aria-label="Secret Santa identity hidden"
												>
													<Gift size={12} aria-hidden="true" />
												</span>
											{/if}
											{participant.label}
										</li>
									{/each}
								</ul>
							</div>
						</a>
						<div class="mt-3 flex flex-wrap items-center justify-between gap-2">
							{#if conversation.lastMessageAt}
								<time class="text-xs text-stone-500" datetime={conversation.lastMessageAt}>
									{formatTimestamp(conversation.lastMessageAt)}
								</time>
							{/if}
							<a
								class="ml-auto text-sm font-medium text-emerald-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
								href={conversation.isWishlistOwner
									? resolve('/app/wishlist')
									: resolve('/app/wishlists/[participantId]', {
											participantId: conversation.wishlistOwner.userId
										})}
							>
								View wishlist
							</a>
						</div>
					</article>
				</li>
			{/each}
		</ul>
	{/if}
</section>
