<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import { daysUntilExchange, formatEventBudget, type EventStatus } from '#lib/models/event.js';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';

	let { data }: PageProps = $props();

	function openConversation(direction: 'asRecipient' | 'asGiver'): void {
		void goto(resolve('/app/wishlist'), {
			state: { wishlistTab: 'messages', wishlistMessageDirection: direction }
		});
	}

	onMount(() => {
		const socket = getRealtimeSocket();
		const refreshOverview = () => void invalidateAll();
		const liveEvents = [
			'connect',
			'messages:changed',
			'wishlist:changed',
			'recipient-wishlist:changed',
			'gift-status:changed'
		] as const;
		for (const event of liveEvents) socket.on(event, refreshOverview);
		return () => {
			for (const event of liveEvents) socket.off(event, refreshOverview);
		};
	});

	function statusLabel(status: EventStatus): string {
		switch (status) {
			case 'setup':
				return 'Setup';
			case 'open':
				return 'Open';
			case 'assignments_generated':
				return 'Assignments generated';
			case 'completed':
				return 'Completed';
		}
	}

	function formatDate(date: string): string {
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'long' }).format(
			new Date(`${date}T00:00:00`)
		);
	}

	function countdownLabel(date: string): string {
		const days = daysUntilExchange(date);
		if (days < 0) return 'The exchange date has passed.';
		if (days === 0) return 'The exchange is today!';
		return `${days} ${days === 1 ? 'day' : 'days'} until the exchange`;
	}

	function formatTimestamp(value: string): string {
		return new Intl.DateTimeFormat('en-CA', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}
</script>

<svelte:head>
	<title>Your exchange | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<div>
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">Your exchange</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
			Welcome, {data.user.displayName}
		</h1>
		{#if data.event}
			<p class="mt-3 max-w-2xl text-stone-600">
				{data.event.name} · {statusLabel(data.event.status)} · Exchange day
				{formatDate(data.event.exchangeDate)}
			</p>
		{:else}
			<p class="mt-3 max-w-2xl text-stone-600">
				{data.user.role === 'organizer'
					? 'Set up the event and invite participants to get started.'
					: 'Your organizer is getting the exchange ready. Check back soon.'}
			</p>
		{/if}
	</div>

	{#if data.event}
		<div class="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
			<Card class="border-stone-200 bg-white">
				<CardHeader>
					<CardTitle>{data.event.name}</CardTitle>
					<CardDescription>{countdownLabel(data.event.exchangeDate)}</CardDescription>
				</CardHeader>
				<CardContent class="grid gap-4 sm:grid-cols-2">
					<div>
						<p class="text-sm text-stone-500">Exchange date</p>
						<p class="mt-1 font-medium text-stone-900">{formatDate(data.event.exchangeDate)}</p>
					</div>
					<div>
						<p class="text-sm text-stone-500">Gift budget</p>
						<p class="mt-1 font-medium text-stone-900">
							{formatEventBudget(data.event.giftBudgetCents, data.event.currency)}
						</p>
					</div>
				</CardContent>
				{#if data.user.role === 'organizer'}
					<CardFooter class="flex flex-wrap gap-4">
						<a
							class="text-sm font-medium text-emerald-800 hover:underline"
							href={resolve('/app/event')}
						>
							Event settings
						</a>
						<a
							class="text-sm font-medium text-emerald-800 hover:underline"
							href={resolve('/app/dashboard')}
						>
							Dashboard
						</a>
					</CardFooter>
				{/if}
			</Card>

			{#if data.user.role === 'organizer'}
				<Card class="border-stone-200 bg-white">
					<CardHeader>
						<CardTitle>Organizer tools</CardTitle>
						<CardDescription>
							Review participation, gift ideas, messages, and the event’s progress.
						</CardDescription>
					</CardHeader>
					<CardFooter>
						<a
							class="text-sm font-medium text-emerald-800 hover:underline"
							href={resolve('/app/dashboard')}
						>
							Open dashboard
						</a>
					</CardFooter>
				</Card>
			{/if}
		</div>
	{:else if data.user.role === 'organizer'}
		<Card class="border-stone-200 bg-white">
			<CardHeader>
				<CardTitle>Start with your event details</CardTitle>
				<CardDescription>
					Set the exchange date and gift budget, then add participants and households.
				</CardDescription>
			</CardHeader>
			<CardFooter>
				<a
					class="text-sm font-medium text-emerald-800 hover:underline"
					href={resolve('/app/event')}
				>
					Configure event
				</a>
			</CardFooter>
		</Card>
	{:else}
		<Card class="border-stone-200 bg-white">
			<CardHeader>
				<CardTitle>The exchange is being prepared</CardTitle>
				<CardDescription>
					Your account is ready. Event details will appear here after the organizer saves them.
				</CardDescription>
			</CardHeader>
		</Card>
	{/if}

	{#if data.participant}
		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<Card class="border-stone-200 bg-white">
				<CardHeader class="pb-2">
					<CardDescription>Your wishlist</CardDescription>
					<CardTitle class="text-2xl">{data.participant.myWishlistCount}</CardTitle>
				</CardHeader>
				<CardFooter>
					<a
						class="text-sm font-medium text-emerald-800 hover:underline"
						href={resolve('/app/wishlist')}
					>
						Edit wishlist
					</a>
				</CardFooter>
			</Card>
			<Card class="border-stone-200 bg-white">
				<CardHeader class="pb-2">
					<CardDescription>Ideas for your recipient</CardDescription>
					<CardTitle class="text-2xl">{data.participant.recipientWishlistCount}</CardTitle>
				</CardHeader>
				<CardFooter>
					<a
						class="text-sm font-medium text-emerald-800 hover:underline"
						href={resolve('/app/gift')}
					>
						View gift ideas
					</a>
				</CardFooter>
			</Card>
			<Card class="border-stone-200 bg-white">
				<CardHeader class="pb-2">
					<CardDescription>Unread messages</CardDescription>
					<CardTitle class="text-2xl">{data.participant.unreadMessageCount}</CardTitle>
				</CardHeader>
				<CardFooter>
					<div class="flex flex-wrap gap-4">
						<button
							type="button"
							class="text-sm font-medium text-emerald-800 hover:underline"
							onclick={() => openConversation('asRecipient')}
						>
							Message my Secret Santa
						</button>
						<button
							type="button"
							class="text-sm font-medium text-emerald-800 hover:underline"
							onclick={() => openConversation('asGiver')}
						>
							Message my recipient
						</button>
					</div>
				</CardFooter>
			</Card>
			<Card class="border-stone-200 bg-white">
				<CardHeader class="pb-2">
					<CardDescription>Gift status</CardDescription>
					<CardTitle class="text-xl">
						{data.participant.recipientDisplayName
							? data.participant.giftPurchasedAt
								? 'Purchased'
								: 'In progress'
							: 'Waiting for draw'}
					</CardTitle>
				</CardHeader>
				<CardFooter>
					<a
						class="text-sm font-medium text-emerald-800 hover:underline"
						href={resolve('/app/gift')}
					>
						Update gift status
					</a>
				</CardFooter>
			</Card>
		</div>

		{#if data.participant.recipientGiftPurchasedAt}
			<p
				class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
				role="status"
			>
				Your Secret Santa marked your gift as purchased on {formatTimestamp(
					data.participant.recipientGiftPurchasedAt
				)}.
			</p>
		{/if}

		<div class="grid gap-6 lg:grid-cols-2">
			<Card class="border-stone-200 bg-white">
				<CardHeader>
					<CardTitle>Recent messages</CardTitle>
					<CardDescription>Your latest notes from both sides of the exchange.</CardDescription>
				</CardHeader>
				<CardContent>
					{#if data.participant.recentMessages.length === 0}
						<p class="text-sm text-stone-600">
							Messages will appear here after the draw is finalized and a conversation starts.
						</p>
					{:else}
						<ul class="space-y-4">
							{#each data.participant.recentMessages as message (message.id)}
								<li class="rounded-xl border border-stone-200 p-3">
									<div class="flex flex-wrap justify-between gap-2 text-xs text-stone-500">
										<p>
											<span class="font-medium text-stone-800">{message.senderLabel}</span>
											· {message.threadLabel}
										</p>
										<time datetime={message.sentAt}>{formatTimestamp(message.sentAt)}</time>
									</div>
									<p class="mt-2 text-sm whitespace-pre-wrap text-stone-700">{message.content}</p>
								</li>
							{/each}
						</ul>
					{/if}
				</CardContent>
				<CardFooter>
					<div class="flex flex-wrap gap-4">
						<button
							type="button"
							class="text-sm font-medium text-emerald-800 hover:underline"
							onclick={() => openConversation('asRecipient')}
						>
							Open Secret Santa conversation
						</button>
						<button
							type="button"
							class="text-sm font-medium text-emerald-800 hover:underline"
							onclick={() => openConversation('asGiver')}
						>
							Open recipient conversation
						</button>
					</div>
				</CardFooter>
			</Card>

			<Card class="border-stone-200 bg-white">
				<CardHeader>
					<CardTitle>
						{data.participant.recipientDisplayName
							? `Recent ideas for ${data.participant.recipientDisplayName}`
							: 'Recent gift ideas'}
					</CardTitle>
					<CardDescription>
						{data.participant.recipientDisplayName
							? 'A quick look at your recipient’s latest wishlist updates.'
							: 'Your recipient’s wishlist will appear after the draw is finalized.'}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{#if data.participant.recipientRecentIdeas.length === 0}
						<p class="text-sm text-stone-600">No recipient ideas to show yet.</p>
					{:else}
						<ul class="space-y-3">
							{#each data.participant.recipientRecentIdeas as idea (idea.id)}
								<li
									class="flex items-start justify-between gap-3 rounded-xl border border-stone-200 p-3"
								>
									<p class="font-medium text-stone-900">{idea.title}</p>
									<time class="shrink-0 text-xs text-stone-500" datetime={idea.updatedAt}>
										{formatTimestamp(idea.updatedAt)}
									</time>
								</li>
							{/each}
						</ul>
					{/if}
				</CardContent>
				<CardFooter>
					<a
						class="text-sm font-medium text-emerald-800 hover:underline"
						href={resolve('/app/gift')}
					>
						See all gift ideas
					</a>
				</CardFooter>
			</Card>
		</div>

		<Card class="border-stone-200 bg-white">
			<CardHeader>
				<CardTitle>Your latest wishlist ideas</CardTitle>
				<CardDescription>Keep your own list helpful and up to date.</CardDescription>
			</CardHeader>
			<CardContent>
				{#if data.participant.myRecentIdeas.length === 0}
					<p class="text-sm text-stone-600">You haven’t added a gift idea yet.</p>
				{:else}
					<ul class="flex flex-wrap gap-3">
						{#each data.participant.myRecentIdeas as idea (idea.id)}
							<li class="rounded-xl border border-stone-200 px-3 py-2">
								<p class="font-medium text-stone-900">{idea.title}</p>
								<time class="text-xs text-stone-500" datetime={idea.updatedAt}>
									Updated {formatTimestamp(idea.updatedAt)}
								</time>
							</li>
						{/each}
					</ul>
				{/if}
			</CardContent>
		</Card>
	{/if}
</section>
