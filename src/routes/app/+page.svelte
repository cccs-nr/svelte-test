<script lang="ts">
	import { resolve } from '$app/paths';
	import { Gift, ShieldCheck } from '@lucide/svelte';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { daysUntilExchange, formatEventBudget, type EventStatus } from '#lib/models/event.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

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

	function formatExchangeDate(date: string): string {
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
	<title>Your exchange | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<div>
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">
			{data.event ? 'Your family exchange' : 'Welcome to Secret Santa'}
		</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
			Welcome, {data.user.displayName}
		</h1>
		{#if data.event}
			<p class="mt-3 max-w-2xl text-stone-600">{data.event.name} is taking shape.</p>
		{:else}
			<p class="mt-3 max-w-2xl text-stone-600">
				{data.user.role === 'organizer'
					? 'Set up the exchange, invite family members, and get everything ready in one place.'
					: 'Your organizer is getting the exchange ready. Check back soon.'}
			</p>
		{/if}
	</div>

	{#if data.event}
		<div class="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
			<Card class="border-stone-200 bg-white">
				<CardHeader>
					<div
						class="mb-2 grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"
					>
						<Gift size={20} aria-hidden="true" />
					</div>
					<CardTitle>{data.event.name}</CardTitle>
					<CardDescription>
						{data.event.description || 'A little surprise brings everyone closer.'}
					</CardDescription>
				</CardHeader>
				<CardContent class="grid gap-5 sm:grid-cols-2">
					<div>
						<p class="text-sm text-stone-500">Exchange date</p>
						<p class="mt-1 font-medium text-stone-900">
							{formatExchangeDate(data.event.exchangeDate)}
						</p>
						<p class="mt-1 text-sm text-emerald-800">
							{countdownLabel(data.event.exchangeDate)}
						</p>
					</div>
					<div>
						<p class="text-sm text-stone-500">Gift budget</p>
						<p class="mt-1 text-xl font-semibold text-stone-950">
							{formatEventBudget(data.event.giftBudgetCents, data.event.currency)}
						</p>
						<p class="mt-1 text-sm text-stone-500">A guideline for gift ideas</p>
					</div>
					<div>
						<p class="text-sm text-stone-500">Event status</p>
						<p class="mt-1 font-medium text-stone-900">{statusLabel(data.event.status)}</p>
					</div>
					{#if data.event.instructions}
						<div>
							<p class="text-sm text-stone-500">Instructions</p>
							<p class="mt-1 text-sm whitespace-pre-wrap text-stone-700">
								{data.event.instructions}
							</p>
						</div>
					{/if}
				</CardContent>
				{#if data.user.role === 'organizer'}
					<CardFooter>
						<a
							class="text-sm font-medium text-emerald-800 hover:underline"
							href={resolve('/app/event')}
						>
							Edit event settings
						</a>
					</CardFooter>
				{/if}
			</Card>

			<Card class="border-stone-200 bg-white">
				<CardHeader>
					<div class="mb-2 grid size-11 place-items-center rounded-2xl bg-rose-50 text-rose-800">
						<ShieldCheck size={20} aria-hidden="true" />
					</div>
					<CardTitle>Your account</CardTitle>
					<CardDescription>
						Signed in as {data.user.role === 'organizer' ? 'an organizer' : 'a participant'}.
					</CardDescription>
				</CardHeader>
				<CardContent class="space-y-2 text-sm text-stone-600">
					<p>Username: <span class="font-medium text-stone-900">{data.user.username}</span></p>
					<p>
						{#if data.user.role === 'organizer' && data.organizerStats}
							{data.organizerStats.totalParticipants} participants ·
							{data.organizerStats.activeAccounts} active accounts ·
							{data.organizerStats.householdCount} households
						{:else}
							Your account is ready for the exchange.
						{/if}
					</p>
				</CardContent>
			</Card>
		</div>
	{:else if data.user.role === 'organizer'}
		<Card class="border-stone-200 bg-white">
			<CardHeader>
				<CardTitle>Start with your event details</CardTitle>
				<CardDescription>
					Set the exchange date and CAD budget, then add participants and households.
				</CardDescription>
			</CardHeader>
			<CardContent class="text-sm text-stone-600">
				{#if data.organizerStats}
					{data.organizerStats.totalParticipants} participants ·
					{data.organizerStats.activeAccounts} active accounts ·
					{data.organizerStats.householdCount} households
				{/if}
			</CardContent>
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
					Your account is ready. The event name, date, and budget will appear here once your
					organizer saves them.
				</CardDescription>
			</CardHeader>
		</Card>
	{/if}
</section>
