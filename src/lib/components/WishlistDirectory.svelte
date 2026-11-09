<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { UserRound } from '@lucide/svelte';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import { trpc } from '#lib/trpc/client.js';
	import { Button } from '#lib/components/ui/button/index.js';

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
		socket.on('connect', refresh);
		void loadMembers();
		return () => {
			socket.off('family-wishlist:changed', refresh);
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
</script>

<section class="space-y-4" aria-labelledby="wishlist-directory-title">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h2 id="wishlist-directory-title" class="text-xl font-semibold text-stone-950">
				Family wishlists
			</h2>
			<p class="mt-1 text-sm text-stone-600">
				Browse gift ideas from your family. Reservation and purchase details remain private to gift
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
		<p
			class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
			role="alert"
		>
			{errorMessage}
		</p>
	{/if}

	{#if isLoading}
		<p class="text-sm text-stone-500" role="status">Loading participants…</p>
	{:else if members.length === 0}
		<p class="rounded-xl border border-dashed border-stone-300 p-5 text-sm text-stone-600">
			No participants are available yet.
		</p>
	{:else}
		<div class="overflow-x-auto rounded-xl border border-stone-200 bg-white">
			<table class="w-full min-w-[640px] border-collapse text-left text-sm">
				<thead>
					<tr class="border-b border-stone-200 bg-stone-50 text-xs text-stone-600">
						<th scope="col" class="px-4 py-3 font-medium">Participant</th>
						<th scope="col" class="px-4 py-3 font-medium">Gift ideas</th>
						<th scope="col" class="px-4 py-3 font-medium">Wishlist updated</th>
						<th scope="col" class="px-4 py-3 font-medium">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each members as member (member.id)}
						<tr class="border-b border-stone-100 last:border-0">
							<th scope="row" class="px-4 py-3 font-normal">
								<div class="flex items-center gap-3">
									<span
										class="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800"
										aria-hidden="true"
									>
										<UserRound size={16} />
									</span>
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
								<a
									class="font-medium text-emerald-800 underline-offset-4 hover:underline"
									href={member.id === currentUserId
										? resolve('/app/wishlist')
										: resolve('/app/wishlists/[participantId]', {
												participantId: member.id
											})}
								>
									{member.id === currentUserId ? 'Your Wishlist' : 'View Wishlist'}
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
