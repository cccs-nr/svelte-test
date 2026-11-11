<script lang="ts">
	import { onMount } from 'svelte';
	import { Clock, Mail } from '@lucide/svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import { daysUntilExchange, formatEventBudget } from '#lib/models/event.js';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import WishlistDirectory from '#lib/components/WishlistDirectory.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import HouseholdMembersCard from '#lib/components/HouseholdMembersCard.svelte';
	import PageGuide from '#lib/components/PageGuide.svelte';
	import ProfileAvatar from '#lib/components/ProfileAvatar.svelte';

	let { data }: PageProps = $props();
	let lastSignIn = $state<string | null>(null);

	// Formatted after mount so the server's time zone is never shown to the visitor.
	onMount(() => {
		if (!data.previousLoginAt) return;
		lastSignIn = new Intl.DateTimeFormat('en-CA', { dateStyle: 'full', timeStyle: 'short' }).format(
			new Date(data.previousLoginAt)
		);
	});

	onMount(() => {
		const socket = getRealtimeSocket();
		const refreshSummary = () => void invalidateAll();
		const liveEvents = ['connect', 'event:changed', 'gift-status:changed'] as const;
		for (const event of liveEvents) socket.on(event, refreshSummary);
		return () => {
			for (const event of liveEvents) socket.off(event, refreshSummary);
		};
	});

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
</script>

<svelte:head>
	<title>Home | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<p class="app-page-kicker">Your exchange</p>
			<h1 class="app-page-title">
				Welcome, {data.user.displayName}
			</h1>
			{#if !data.event}
				<p class="app-page-description">
					{data.user.role === 'organizer'
						? 'Set up the event and invite participants to get started.'
						: 'Your organizer is getting the exchange ready. Check back soon.'}
				</p>
			{/if}
		</div>
	</header>

	<PageGuide
		title="How Secret Santa works"
		simple="Add gift ideas to My Wishlist. After the draw, open Your Draw. Prices are only suggestions."
	>
		<p>
			<strong>The goal:</strong> everyone gives one gift and receives one gift. You will be given one
			person to buy a gift for, and it is a secret until the party.
		</p>
		<ol>
			{#if data.user.isParticipating}
				<li>
					Open <strong>My Wishlist</strong> at the top and add a few gift ideas you would like.
				</li>
				<li>
					When the organizer finishes the draw, open <strong>Your Draw</strong> to see who you are buying
					for.
				</li>
				<li>Choose a gift from their wishlist. Use <strong>Messages</strong> to ask questions.</li>
			{/if}
			{#if data.user.role === 'organizer'}
				<li>
					Use <strong>Dashboard</strong> and <strong>Assignments</strong> at the top to set up the event
					and run the draw.
				</li>
			{/if}
			<li>Need a reminder? Press <strong>Welcome</strong> at the top any time.</li>
		</ol>
		<p>The gift price is only a suggestion, not a limit.</p>
	</PageGuide>

	<section
		class="app-surface grid gap-4 rounded-2xl border-2 p-5 sm:grid-cols-2"
		aria-label="Your activity"
	>
		<div class="flex items-start gap-3">
			<Clock size={26} class="mt-0.5 shrink-0" aria-hidden="true" />
			<div>
				<p class="text-base text-muted-foreground">Your last sign-in</p>
				<p class="text-lg font-semibold">
					{data.previousLoginAt ? (lastSignIn ?? '…') : 'This is your first visit. Welcome!'}
				</p>
			</div>
		</div>
		{#if data.user.isParticipating}
			<div class="flex items-start gap-3">
				<Mail size={26} class="mt-0.5 shrink-0" aria-hidden="true" />
				<div>
					<p class="text-base text-muted-foreground">Messages waiting for you</p>
					{#if data.badgeCounts.messages > 0}
						<p class="text-lg font-semibold">
							{data.badgeCounts.messages}
							{data.badgeCounts.messages === 1 ? 'new message' : 'new messages'}
							<Button variant="default" href={resolve('/app/messages')}>Read now</Button>
						</p>
					{:else}
						<p class="text-lg font-semibold">No new messages</p>
					{/if}
				</div>
			</div>
		{/if}
	</section>

	{#if data.event}
		<div class="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
			<Card class="lg:col-span-2">
				<CardHeader>
					<CardTitle>{data.event.name}</CardTitle>
				</CardHeader>
				<CardContent class="grid gap-5 sm:grid-cols-3">
					<div>
						<p class="text-base text-stone-600">Your draw</p>
						{#if data.participant?.recipientId && data.participant.recipientDisplayName}
							<a
								class="mt-1 inline-flex max-w-full items-center gap-2 font-medium text-emerald-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
								href={resolve('/app/wishlists/[participantId]', {
									participantId: data.participant.recipientId
								})}
							>
								<ProfileAvatar
									displayName={data.participant.recipientDisplayName}
									hasAvatar={data.participant.recipientHasAvatar}
									imageVersion={data.participant.recipientAvatarVersion}
									imageSrc={resolve('/api/participant-avatar/[participantId]', {
										participantId: data.participant.recipientId
									})}
									size="sm"
									class="size-8 text-sm"
								/>
								<span class="truncate">{data.participant.recipientDisplayName}</span>
							</a>
						{:else if data.participant}
							<p class="mt-1 font-medium text-stone-900">Waiting for the draw</p>
						{:else}
							<p class="mt-1 font-medium text-stone-900">Participant access not enabled</p>
						{/if}
					</div>
					<div>
						<p class="text-base text-stone-600">Exchange date</p>
						<p class="mt-1 font-medium text-stone-900">
							{formatDate(data.event.exchangeDate)}
							<span class="mt-1 block font-normal text-stone-600">
								({countdownLabel(data.event.exchangeDate)})
							</span>
						</p>
					</div>
					<div>
						<p class="text-base text-stone-600">Suggested gift price</p>
						<p class="mt-1 font-medium text-stone-900">
							{formatEventBudget(data.event.giftBudgetCents, data.event.currency)}
							<span class="mt-1 block font-normal text-stone-600">
								(a suggestion, not a limit)
							</span>
						</p>
						{#if data.participant}
							<p class="mt-1 text-sm text-stone-600">
								({data.participant.recipientId
									? data.participant.giftPurchasedAt
										? 'Purchased'
										: 'In progress'
									: 'Waiting for draw'})
							</p>
						{/if}
					</div>
				</CardContent>
				{#if data.user.role === 'organizer'}
					<CardFooter class="flex flex-wrap gap-4">
						<Button variant="outline" href={resolve('/app/event')}>Event settings</Button>
						<Button variant="outline" href={resolve('/app/dashboard')}>Dashboard</Button>
					</CardFooter>
				{/if}
			</Card>

			{#if data.user.role === 'organizer'}
				<Card>
					<CardHeader>
						<CardTitle>Organizer tools</CardTitle>
						<CardDescription>
							Review participation, gift ideas, messages, and the event’s progress.
						</CardDescription>
					</CardHeader>
					<CardFooter>
						<Button variant="outline" href={resolve('/app/dashboard')}>Open dashboard</Button>
					</CardFooter>
				</Card>
			{/if}
		</div>
	{:else if data.user.role === 'organizer'}
		<Card>
			<CardHeader>
				<CardTitle>Start with your event details</CardTitle>
				<CardDescription>
					Set the exchange date and gift budget, then add participants and households.
				</CardDescription>
			</CardHeader>
			<CardFooter>
				<Button variant="outline" href={resolve('/app/event')}>Configure event</Button>
			</CardFooter>
		</Card>
	{:else}
		<Card>
			<CardHeader>
				<CardTitle>The exchange is being prepared</CardTitle>
				<CardDescription>
					Your account is ready. Event details will appear here after the organizer saves them.
				</CardDescription>
			</CardHeader>
		</Card>
	{/if}

	{#if data.user.isParticipating && !data.isManagingOther && data.members.length > 0}
		<HouseholdMembersCard
			members={data.members}
			activeId={data.user.id}
			accountId={data.account.id}
		/>
	{/if}

	{#if data.participant}
		<WishlistDirectory currentUserId={data.user.id} />
	{/if}
</section>
