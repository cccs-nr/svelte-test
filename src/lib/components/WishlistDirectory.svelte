<script lang="ts">
	import PageSummary from '#lib/components/PageSummary.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import { trpc } from '#lib/trpc/client.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';

	type FamilyMember = Awaited<ReturnType<typeof trpc.wishlists.familyDirectory.query>>[number];
	type Props = { currentUserId: string };

	let { currentUserId }: Props = $props();
	let members = $state<FamilyMember[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state<string | null>(null);

	onMount(() => {
		const socket = getRealtimeSocket();
		const refresh = () => void loadMembers();
		socket.on('family-wishlist:changed', refresh);
		socket.on('messages:changed', refresh);
		socket.on('connect', refresh);
		void loadMembers();
		return () => {
			socket.off('family-wishlist:changed', refresh);
			socket.off('messages:changed', refresh);
			socket.off('connect', refresh);
		};
	});

	async function loadMembers(): Promise<void> {
		isLoading = true;
		errorMessage = null;
		try {
			members = await trpc.wishlists.familyDirectory.query({ search: '' });
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load the participant directory. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	function formatTimestamp(value: string | null): string {
		if (!value) return 'Not updated yet';
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(new Date(value));
	}

	function profileImageUrl(participantId: string): string {
		return resolve('/api/participant-avatar/[participantId]', { participantId });
	}
</script>

<section class="space-y-4" aria-labelledby="wishlist-directory-title">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h2 id="wishlist-directory-title" class="text-xl font-semibold text-stone-950">Wishlists</h2>
			<PageSummary>Browse gift ideas from everyone.</PageSummary>
			<p class="app-hint mt-1 text-sm text-stone-600">
				Browse gift ideas from participants. Reservation and purchase details remain private to gift
				buyers.
			</p>
		</div>
		<Button
			type="button"
			variant="outline"
			size="sm"
			onclick={() => void loadMembers()}
			disabled={isLoading}
		>
			Refresh
		</Button>
	</div>

	{#if errorMessage}
		<p class="app-alert app-alert--error" role="alert">
			{errorMessage}
		</p>
	{/if}

	{#if isLoading}
		<p class="text-sm text-stone-600" role="status">Loading participants…</p>
	{:else if members.length === 0}
		<p class="rounded-xl border border-dashed border-stone-300 p-5 text-sm text-stone-600">
			No participants are available yet.
		</p>
	{:else}
		<ul class="space-y-3 lg:hidden" aria-label="Participant wishlists">
			{#each members as member (member.id)}
				<li class="app-surface rounded-xl border border-border p-3">
					<div class="flex items-center gap-3">
						<ProfileAvatar
							displayName={member.displayName}
							hasAvatar={member.hasAvatar}
							imageVersion={member.avatarVersion}
							imageSrc={profileImageUrl(member.id)}
							size="sm"
							class="size-10 text-sm"
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold text-foreground">
								{member.displayName}{member.id === currentUserId ? ' (you)' : ''}
							</p>
							<p class="mt-0.5 text-sm text-muted-foreground">
								{member.giftIdeaCount}
								{member.giftIdeaCount === 1 ? 'idea' : 'ideas'} ·
								{formatTimestamp(member.wishlistUpdatedAt)}
							</p>
						</div>
						<Button
							variant="outline"
							href={member.id === currentUserId
								? resolve('/app/wishlist')
								: resolve('/app/wishlists/[participantId]', {
										participantId: member.id
									})}
						>
							{member.id === currentUserId ? 'Your Wishlist' : 'View'}
						</Button>
					</div>
					{#if member.conversations.length > 0}
						<ul
							class="mt-3 flex flex-wrap gap-2 border-t border-border pt-3"
							aria-label="Conversations"
						>
							{#each member.conversations as conversation (conversation.id)}
								<li>
									<a
										class="inline-flex min-h-9 items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
										href={resolve('/app/messages/[conversationId]', {
											conversationId: conversation.id
										})}
									>
										{conversation.type === 'wishlist_discussion'
											? `Talk to ${member.displayName}`
											: 'Plan gifts privately'}
										{#if conversation.unreadCount > 0}
											<span
												class="app-status app-status--unread"
												aria-label={`${conversation.unreadCount} new messages`}
											>
												{conversation.unreadCount}
											</span>
										{/if}
									</a>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
							No conversations yet
						</p>
					{/if}
				</li>
			{/each}
		</ul>

		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="app-surface app-table-scroll hidden overflow-x-auto rounded-xl border border-border lg:block"
			role="region"
			aria-label="Participant wishlists table"
			tabindex="0"
		>
			<table class="w-full min-w-[820px] border-collapse text-left text-sm">
				<thead>
					<tr class="border-b border-stone-200 bg-stone-50 text-sm text-stone-600">
						<th scope="col" class="px-4 py-3 font-medium">Participant</th>
						<th scope="col" class="px-4 py-3 font-medium">Gift ideas</th>
						<th scope="col" class="px-4 py-3 font-medium">Wishlist updated</th>
						<th scope="col" class="px-4 py-3 font-medium">Conversations</th>
						<th scope="col" class="px-4 py-3 font-medium">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each members as member (member.id)}
						<tr class="border-b border-stone-100 last:border-0">
							<th scope="row" class="px-4 py-3 font-normal">
								<div class="flex items-center gap-3">
									<ProfileAvatar
										displayName={member.displayName}
										hasAvatar={member.hasAvatar}
										imageVersion={member.avatarVersion}
										imageSrc={profileImageUrl(member.id)}
										size="sm"
										class="size-8 text-sm"
									/>
									<p class="font-medium text-stone-950">
										{member.displayName}{member.id === currentUserId ? ' (you)' : ''}
									</p>
								</div>
							</th>
							<td class="px-4 py-3 text-stone-700">
								{member.giftIdeaCount}
								{member.giftIdeaCount === 1 ? 'idea' : 'ideas'}
							</td>
							<td class="px-4 py-3 text-stone-700">
								{formatTimestamp(member.wishlistUpdatedAt)}
							</td>
							<td class="px-4 py-3">
								{#if member.conversations.length === 0}
									<span class="text-stone-600">No conversations yet</span>
								{:else}
									<ul class="space-y-1">
										{#each member.conversations as conversation (conversation.id)}
											<li class="flex items-center gap-2">
												<a
													class="font-medium text-emerald-800 underline underline-offset-4"
													href={resolve('/app/messages/[conversationId]', {
														conversationId: conversation.id
													})}
												>
													{conversation.type === 'wishlist_discussion'
														? `Talk to ${member.displayName}`
														: 'Plan gifts privately'}
												</a>
												{#if conversation.unreadCount > 0}
													<span
														class="app-status app-status--unread"
														aria-label={`${conversation.unreadCount} new messages`}
													>
														{conversation.unreadCount} new
													</span>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}
							</td>
							<td class="px-4 py-3">
								<Button
									variant="outline"
									href={member.id === currentUserId
										? resolve('/app/wishlist')
										: resolve('/app/wishlists/[participantId]', {
												participantId: member.id
											})}
								>
									{member.id === currentUserId ? 'Your Wishlist' : 'View Wishlist'}
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
