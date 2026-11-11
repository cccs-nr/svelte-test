<script lang="ts">
	import { onMount } from 'svelte';
	import { Gift, LayoutDashboard, Mail, Plus, Settings } from '@lucide/svelte';
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
	import PageSummary from '#lib/components/PageSummary.svelte';
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
	<header>
		<div>
			<p class="app-page-kicker">Your exchange</p>
			<div class="app-page-titlebar">
				<h1 class="app-page-title">
					Welcome, {data.user.displayName}
				</h1>
				<PageGuide pageId="home" title="How Secret Santa works">
					<p>
						<strong>The goal:</strong> everyone gives one gift and receives one gift. You are given one
						person to buy a gift for, and it stays a secret until the party.
					</p>
					<p>
						<strong>This Home page</strong> is your starting point. It shows when you last signed in,
						whether messages are waiting, the event date and suggested gift price, who you drew once the
						draw is done, and everyone’s wishlists.
					</p>
					<ol>
						{#if data.user.isParticipating}
							<li>
								Open <strong>My Wishlist</strong> in the <strong>Menu</strong> (top right) and add a few
								gift ideas you would like.
							</li>
							<li>
								When the organizer finishes the draw, open <strong>Your Draw</strong> to see who you are
								buying for and their wishlist.
							</li>
							<li>
								Choose a gift and press <strong>Reserve</strong> so nobody else buys it. You do not have
								to pick from the list.
							</li>
							<li>
								Use <strong>Messages</strong> to ask questions. Your codename keeps your identity secret.
							</li>
						{/if}
						{#if data.user.role === 'organizer'}
							<li>
								Use <strong>Dashboard</strong> and <strong>Assignments</strong> in the
								<strong>Menu</strong> to set up the event and run the draw.
							</li>
						{/if}
						<li>
							Need a reminder? Open <strong>Menu</strong> and choose <strong>Welcome</strong> for the
							full explanation.
						</li>
					</ol>
					{#if data.user.isParticipating}
						<p>
							<strong>Household:</strong> if you also look after someone else’s gift list, add them in
							the Household section below. This is optional, and they can simply create their own account
							instead.
						</p>
					{/if}
					<p>The gift price is only a suggestion, not a limit.</p>
				</PageGuide>
			</div>
			<PageSummary simple="See your draw, messages and the event details at a glance."
				>Your starting point: see when you last signed in, whether messages are waiting, the event
				details, who you drew once the draw is done, and everyone’s wishlists.</PageSummary
			>
			{#if !data.event}
				<p class="app-page-status">
					{data.user.role === 'organizer'
						? 'Set up the event and invite participants to get started.'
						: 'Your organizer is getting the exchange ready. Check back soon.'}
				</p>
			{/if}
		</div>
	</header>

	<Card>
		<CardHeader>
			<CardTitle>{data.event?.name ?? 'Your exchange'}</CardTitle>
		</CardHeader>
		<CardContent>
			<dl class="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-lg">
				{#if data.event}
					<dt class="font-semibold">When</dt>
					<dd class="min-w-0">
						{formatDate(data.event.exchangeDate)}
						<span class="text-muted-foreground">({countdownLabel(data.event.exchangeDate)})</span>
					</dd>
					<dt class="font-semibold">Gift price</dt>
					<dd class="min-w-0">
						{formatEventBudget(data.event.giftBudgetCents, data.event.currency)}
						<span class="text-muted-foreground">(a suggestion, not a limit)</span>
					</dd>
				{/if}
				{#if data.participant}
					<dt class="font-semibold">Your draw</dt>
					<dd class="min-w-0">
						{#if data.participant.recipientId && data.participant.recipientDisplayName}
							<a
								class="inline-flex max-w-full items-center gap-2 align-middle font-medium text-primary underline underline-offset-4"
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
							<span class="text-muted-foreground">
								({data.participant.giftPurchasedAt ? 'gift purchased' : 'gift in progress'})
							</span>
						{:else}
							Waiting for the draw
						{/if}
					</dd>
				{:else if data.event}
					<dt class="font-semibold">Your draw</dt>
					<dd class="min-w-0">Participant access not enabled</dd>
				{/if}
				<dt class="font-semibold">Last sign-in</dt>
				<dd class="min-w-0">
					{data.previousLoginAt ? (lastSignIn ?? '…') : 'This is your first visit. Welcome!'}
				</dd>
				{#if data.user.isParticipating}
					<dt class="font-semibold">Messages</dt>
					<dd class="min-w-0">
						{#if data.badgeCounts.messages > 0}
							{data.badgeCounts.messages}
							{data.badgeCounts.messages === 1 ? 'new message' : 'new messages'} waiting
						{:else}
							No new messages
						{/if}
					</dd>
				{/if}
			</dl>
		</CardContent>
		{#if data.user.isParticipating || data.user.role === 'organizer'}
			<CardFooter class="flex flex-wrap gap-3">
				{#if data.user.isParticipating}
					<Button href={resolve('/app/wishlist')}>
						<Plus aria-hidden="true" />
						Add gift to your wishlist
					</Button>
					{#if data.participant?.recipientId && data.participant.recipientDisplayName}
						<Button
							variant="outline"
							href={resolve('/app/wishlists/[participantId]', {
								participantId: data.participant.recipientId
							})}
						>
							<Gift aria-hidden="true" />
							View {data.participant.recipientDisplayName}’s wishlist
						</Button>
					{/if}
					{#if data.badgeCounts.messages > 0}
						<Button variant="outline" href={resolve('/app/messages')}>
							<Mail aria-hidden="true" />
							Read messages
						</Button>
					{/if}
				{/if}
				{#if data.user.role === 'organizer'}
					<Button variant="outline" href={resolve('/app/event')}>
						<Settings aria-hidden="true" />Event settings</Button
					>
					<Button variant="outline" href={resolve('/app/dashboard')}>
						<LayoutDashboard aria-hidden="true" />Dashboard</Button
					>
				{/if}
			</CardFooter>
		{/if}
	</Card>

	{#if !data.event && data.user.role === 'organizer'}
		<Card>
			<CardHeader>
				<CardTitle>Start with your event details</CardTitle>
				<CardDescription>
					Set the exchange date and gift budget, then add participants and households.
				</CardDescription>
			</CardHeader>
			<CardFooter>
				<Button variant="outline" href={resolve('/app/event')}>
					<Settings aria-hidden="true" />Configure event</Button
				>
			</CardFooter>
		</Card>
	{:else if !data.event}
		<Card>
			<CardHeader>
				<CardTitle>The exchange is being prepared</CardTitle>
				<CardDescription essential>
					Your account is ready. Event details will appear here after the organizer saves them.
				</CardDescription>
			</CardHeader>
		</Card>
	{/if}

	{#if data.user.isParticipating && data.members.length > 0}
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
