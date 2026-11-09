<script lang="ts">
	import { onMount } from 'svelte';
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

	let { data }: PageProps = $props();

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
	<header>
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">Your exchange</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
			Welcome, {data.user.displayName}
		</h1>
		{#if !data.event}
			<p class="mt-3 max-w-2xl text-stone-600">
				{data.user.role === 'organizer'
					? 'Set up the event and invite participants to get started.'
					: 'Your organizer is getting the exchange ready. Check back soon.'}
			</p>
		{/if}
	</header>

	{#if data.event}
		<div class="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
			<Card class="border-stone-200 bg-white lg:col-span-2">
				<CardHeader>
					<CardTitle>{data.event.name}</CardTitle>
				</CardHeader>
				<CardContent class="grid gap-5 sm:grid-cols-3">
					<div>
						<p class="text-sm text-stone-500">Your draw</p>
						{#if data.participant?.recipientId && data.participant.recipientDisplayName}
							<a
								class="mt-1 inline-block font-medium text-emerald-800 underline-offset-4 hover:underline"
								href={resolve('/app/wishlists/[participantId]', {
									participantId: data.participant.recipientId
								})}
							>
								{data.participant.recipientDisplayName}
							</a>
						{:else if data.participant}
							<p class="mt-1 font-medium text-stone-900">Waiting for the draw</p>
						{:else}
							<p class="mt-1 font-medium text-stone-900">Participant access not enabled</p>
						{/if}
					</div>
					<div>
						<p class="text-sm text-stone-500">Exchange date</p>
						<p class="mt-1 font-medium text-stone-900">
							{formatDate(data.event.exchangeDate)}
							<span class="mt-1 block font-normal text-stone-600">
								({countdownLabel(data.event.exchangeDate)})
							</span>
						</p>
					</div>
					<div>
						<p class="text-sm text-stone-500">Gift budget</p>
						<p class="mt-1 font-medium text-stone-900">
							{formatEventBudget(data.event.giftBudgetCents, data.event.currency)}
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
		<WishlistDirectory currentUserId={data.user.id} />
	{/if}
</section>
