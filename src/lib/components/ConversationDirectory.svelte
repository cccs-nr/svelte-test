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

	type SecretSantaThreads = Awaited<ReturnType<typeof trpc.conversations.list.query>>;
	type ConversationKind = 'secret-santa' | 'wishlist-discussion' | 'gift-coordination';
	type ConversationItem = {
		id: string;
		kind: ConversationKind;
		title: string;
		subtitle: string;
		preview: string;
		previewSender: string | null;
		lastMessageAt: string | null;
		unreadCount: number;
		avatar:
			| { type: 'codename'; codename: string }
			| { type: 'profile'; displayName: string; hasAvatar: boolean; avatarVersion: number }
			| { type: 'secret' };
	};
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
			return (
				(filter === 'all' || conversation.kind === filter) &&
				(!query ||
					`${conversation.title} ${conversation.subtitle} ${conversation.preview}`
						.toLocaleLowerCase()
						.includes(query))
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
		socket.on('family-messages:changed', refresh);
		socket.on('connect', refresh);
		void loadConversations();
		return () => {
			isDisposed = true;
			socket.off('messages:changed', refresh);
			socket.off('family-messages:changed', refresh);
			socket.off('connect', refresh);
		};
	});

	async function loadConversations(): Promise<void> {
		const sequence = ++loadSequence;
		isLoading = true;
		errorMessage = null;
		try {
			const [secretSantaThreads, giftConversations] = await Promise.all([
				trpc.conversations.list.query(),
				trpc.giftConversations.list.query()
			]);
			if (isDisposed || sequence !== loadSequence) return;
			conversations = [
				...getSecretSantaItems(secretSantaThreads),
				...giftConversations.map((conversation) => ({
					id: conversation.id,
					kind:
						conversation.type === 'recipient_visible'
							? ('wishlist-discussion' as const)
							: ('gift-coordination' as const),
					title:
						conversation.type === 'recipient_visible' ? 'Wishlist Discussion' : 'Gift Coordination',
					subtitle: conversation.recipientLabel,
					preview: conversation.lastMessagePreview ?? 'No messages yet.',
					previewSender: conversation.lastMessageSenderLabel,
					lastMessageAt: conversation.lastMessageAt,
					unreadCount: conversation.unreadCount,
					avatar: conversation.recipientCodename
						? { type: 'codename' as const, codename: conversation.recipientCodename }
						: {
								type: 'profile' as const,
								displayName: conversation.recipientLabel,
								hasAvatar: false,
								avatarVersion: 0
							}
				}))
			].sort(
				(left, right) =>
					(right.lastMessageAt ? Date.parse(right.lastMessageAt) : 0) -
					(left.lastMessageAt ? Date.parse(left.lastMessageAt) : 0)
			);
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

	function getSecretSantaItems(threads: SecretSantaThreads): ConversationItem[] {
		const items: ConversationItem[] = [];
		const giverThread = threads.asGiver;
		if (giverThread && (giverThread.hasConversation || giverThread.canSend)) {
			const lastMessage = giverThread.messages.at(-1);
			items.push({
				id: 'secret-santa-asGiver',
				kind: 'secret-santa',
				title: `Your Assigned Recipient: ${giverThread.recipientDisplayName}`,
				subtitle: 'Secret Santa',
				preview: lastMessage?.content ?? 'No messages yet.',
				previewSender: lastMessage?.senderLabel ?? null,
				lastMessageAt: lastMessage?.sentAt ?? null,
				unreadCount: giverThread.unreadCount,
				avatar: {
					type: 'profile',
					displayName: giverThread.recipientDisplayName,
					hasAvatar: giverThread.recipientHasAvatar,
					avatarVersion: giverThread.recipientAvatarVersion
				}
			});
		}

		const recipientThread = threads.asRecipient;
		if (recipientThread && (recipientThread.hasConversation || recipientThread.canSend)) {
			const lastMessage = recipientThread.messages.at(-1);
			items.push({
				id: 'secret-santa-asRecipient',
				kind: 'secret-santa',
				title: 'Your Secret Santa',
				subtitle: 'Secret Santa',
				preview: lastMessage?.content ?? 'No messages yet.',
				previewSender: lastMessage?.senderLabel ?? null,
				lastMessageAt: lastMessage?.sentAt ?? null,
				unreadCount: recipientThread.unreadCount,
				avatar: { type: 'secret' }
			});
		}
		return items;
	}

	function formatTimestamp(value: string | null): string {
		if (!value) return 'No activity yet';
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(value)
		);
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
					Open your private Secret Santa exchange, a Wishlist Discussion, or Gift Coordination.
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
					placeholder="Conversation or participant"
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
					<option value="secret-santa">Secret Santa</option>
					<option value="wishlist-discussion">Wishlist Discussion</option>
					<option value="gift-coordination">Gift Coordination</option>
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
					? 'Conversations will appear here when the draw is finalized or you open a family discussion.'
					: 'Try a different search or conversation type.'}
			</p>
		</div>
	{:else}
		<ul class="space-y-3" aria-label="Your conversations">
			{#each displayedConversations as conversation (conversation.id)}
				<li>
					<a
						class="flex items-start gap-4 rounded-xl border border-stone-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
						href={resolve('/app/messages/[conversationId]', {
							conversationId: conversation.id
						})}
					>
						{#if conversation.avatar.type === 'codename'}
							<CodenameAvatar codename={conversation.avatar.codename} size="md" />
						{:else if conversation.avatar.type === 'profile'}
							<ProfileAvatar
								displayName={conversation.avatar.displayName}
								hasAvatar={conversation.avatar.hasAvatar}
								imageVersion={conversation.avatar.avatarVersion}
								size="md"
							/>
						{:else}
							<span
								class="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800"
								aria-label="Secret Santa identity hidden"
							>
								<Gift size={20} aria-hidden="true" />
							</span>
						{/if}
						<span class="min-w-0 flex-1">
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
							<span class="mt-1 block text-sm text-stone-600">{conversation.subtitle}</span>
							<span class="mt-2 block truncate text-sm text-stone-700">
								{conversation.previewSender ? `${conversation.previewSender}: ` : ''}
								{conversation.preview}
							</span>
							<time
								class="mt-2 block text-xs text-stone-500"
								datetime={conversation.lastMessageAt ?? undefined}
							>
								{formatTimestamp(conversation.lastMessageAt)}
							</time>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
