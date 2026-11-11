<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageProps } from './$types';
	import PageGuide from '#lib/components/PageGuide.svelte';
	import PageSummary from '#lib/components/PageSummary.svelte';
	import EventOverviewCard from '#lib/components/EventOverviewCard.svelte';
	import ConversationMigrationReviewCard from '#lib/components/ConversationMigrationReviewCard.svelte';
	import OrganizerFamilyCoordinationCard from '#lib/components/OrganizerFamilyCoordinationCard.svelte';
	import OrganizerHouseholdsCard from '#lib/components/OrganizerHouseholdsCard.svelte';
	import OrganizerParticipantsTable from '#lib/components/OrganizerParticipantsTable.svelte';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';

	let { data }: PageProps = $props();

	onMount(() => {
		const socket = getRealtimeSocket();
		const refreshDashboard = () => void invalidateAll();
		socket.on('dashboard:changed', refreshDashboard);
		socket.on('connect', refreshDashboard);
		return () => {
			socket.off('dashboard:changed', refreshDashboard);
			socket.off('connect', refreshDashboard);
		};
	});
</script>

<svelte:head>
	<title>Dashboard | Secret Santa</title>
</svelte:head>

<section class="space-y-6">
	<div>
		<p class="app-page-kicker">Organizer</p>
		<div class="app-page-titlebar">
			<h1 class="app-page-title mt-2">Dashboard</h1>
			<PageGuide pageId="dashboard">
				<p>This is the organizer’s control center. Work through it from top to bottom:</p>
				<ol>
					<li>
						<strong>Event overview:</strong> set the event name, date and suggested gift price, then open
						the event so people can take part.
					</li>
					<li>
						<strong>Accounts:</strong> see who has joined. Press <strong>Edit</strong> beside a name
						to change their name or account name, set a new password, deactivate or delete them.
						Press
						<strong>Create account</strong> to add someone yourself.
					</li>
					<li>
						<strong>Households:</strong> group people who live together so the draw never pairs them.
					</li>
					<li>
						When everyone has joined, go to <strong>Assignments</strong> to run the draw.
					</li>
				</ol>
				<p>Private messages are never shown here. Only totals and progress are.</p>
			</PageGuide>
		</div>
		<PageSummary simple="Set up the event, follow progress and manage accounts."
			>Set up the event, watch everyone’s progress and manage accounts and households. Private
			conversations are never shown here.</PageSummary
		>
	</div>

	<EventOverviewCard
		event={data.event}
		stages={data.eventStages}
		currentStageIndex={data.currentStageIndex}
		canComplete={data.assignmentsFinalized}
	/>
	<ConversationMigrationReviewCard items={data.conversationMigrationReviews} />

	<Card id="event-stats">
		<CardHeader>
			<CardTitle>Event statistics</CardTitle>
			<CardDescription
				>Aggregate progress only. Private conversations remain private.</CardDescription
			>
		</CardHeader>
		<CardContent class="grid gap-6 lg:grid-cols-3">
			<section aria-labelledby="people-stats-title">
				<h3 id="people-stats-title" class="mb-3 text-sm font-semibold text-foreground">
					People & draw
				</h3>
				<dl class="grid grid-cols-2 gap-3">
					<div class="app-surface-muted rounded-xl p-3">
						<dt class="text-sm text-muted-foreground">Participants</dt>
						<dd class="mt-1 text-2xl font-semibold text-foreground tabular-nums">
							{data.stats.totalParticipants}
						</dd>
					</div>
					<div class="app-surface-muted rounded-xl p-3">
						<dt class="text-sm text-muted-foreground">Active accounts</dt>
						<dd class="mt-1 text-2xl font-semibold text-foreground tabular-nums">
							{data.stats.activeAccounts}
						</dd>
					</div>
					<div class="app-surface-muted rounded-xl p-3">
						<dt class="text-sm text-muted-foreground">Households</dt>
						<dd class="mt-1 text-2xl font-semibold text-foreground tabular-nums">
							{data.stats.householdCount}
						</dd>
					</div>
					<div class="app-surface-muted rounded-xl p-3">
						<dt class="text-sm text-muted-foreground">Assignments finalized</dt>
						<dd class="mt-1 text-2xl font-semibold text-foreground tabular-nums">
							{data.stats.finalizedAssignmentCount}/{data.stats.assignmentCount}
						</dd>
					</div>
				</dl>
			</section>
			<section aria-labelledby="wishlist-stats-title">
				<h3 id="wishlist-stats-title" class="mb-3 text-sm font-semibold text-foreground">
					Wishlists & gifts
				</h3>
				<dl class="grid grid-cols-2 gap-3">
					<div class="app-surface-muted rounded-xl p-3">
						<dt class="text-sm text-muted-foreground">Gift ideas</dt>
						<dd class="mt-1 text-2xl font-semibold text-foreground tabular-nums">
							{data.stats.wishlistIdeaCount}
						</dd>
					</div>
					<div class="app-surface-muted rounded-xl p-3">
						<dt class="text-sm text-muted-foreground">Active reservations</dt>
						<dd class="mt-1 text-2xl font-semibold text-foreground tabular-nums">
							{data.stats.totalReservations}
						</dd>
					</div>
					<div class="app-surface-muted rounded-xl p-3">
						<dt class="text-sm text-muted-foreground">Purchased wishlist gifts</dt>
						<dd class="mt-1 text-2xl font-semibold text-foreground tabular-nums">
							{data.stats.purchasedReservationCount}
						</dd>
					</div>
					<div class="app-surface-muted rounded-xl p-3">
						<dt class="text-sm text-muted-foreground">Participants with purchases</dt>
						<dd class="mt-1 text-2xl font-semibold text-foreground tabular-nums">
							{data.stats.participantsWithCompletedPurchases}
						</dd>
					</div>
				</dl>
			</section>
			<section aria-labelledby="communication-stats-title">
				<h3 id="communication-stats-title" class="mb-3 text-sm font-semibold text-foreground">
					Messages & official gifts
				</h3>
				<dl class="grid grid-cols-2 gap-3">
					<div class="app-surface-muted rounded-xl p-3">
						<dt class="text-sm text-muted-foreground">Messages</dt>
						<dd class="mt-1 text-2xl font-semibold text-foreground tabular-nums">
							{data.stats.messageCount}
						</dd>
						<p class="mt-1 text-sm text-muted-foreground">Count only</p>
					</div>
					<div class="app-surface-muted rounded-xl p-3">
						<dt class="text-sm text-muted-foreground">Private gift-planning conversations</dt>
						<dd class="mt-1 text-2xl font-semibold text-foreground tabular-nums">
							{data.stats.coordinationConversationCount}
						</dd>
					</div>
					<div class="app-surface-muted col-span-2 rounded-xl p-3">
						<dt class="text-sm text-muted-foreground">Official Secret Santa gifts purchased</dt>
						<dd class="mt-1 text-2xl font-semibold text-foreground tabular-nums">
							{data.stats.purchasedGiftCount}
						</dd>
					</div>
				</dl>
			</section>
		</CardContent>
	</Card>

	<OrganizerFamilyCoordinationCard
		eventStatus={data.event?.status ?? null}
		revealedAt={data.event?.revealedAt ?? null}
	/>

	<OrganizerParticipantsTable
		participants={data.participants}
		households={data.households.map(({ id, name }) => ({ id, name }))}
		currentUserId={data.currentUserId}
		assignmentsExist={data.assignmentsExist}
		maxImageBytes={data.maxImageBytes}
	/>

	<OrganizerHouseholdsCard
		households={data.households}
		participants={data.participants}
		assignmentsExist={data.assignmentsExist}
	/>
</section>
