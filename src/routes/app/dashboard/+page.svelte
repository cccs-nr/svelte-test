<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageProps } from './$types';
	import EventOverviewCard from '#lib/components/EventOverviewCard.svelte';
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
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">Organizer</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Dashboard</h1>
	</div>

	<EventOverviewCard
		event={data.event}
		stages={data.eventStages}
		currentStageIndex={data.currentStageIndex}
	/>

	<Card id="event-stats" class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle>Event statistics</CardTitle>
			<CardDescription
				>Live totals across the exchange; private conversations remain private.</CardDescription
			>
		</CardHeader>
		<CardContent>
			<dl class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
				<div class="rounded-xl bg-stone-50 p-3">
					<dt class="text-xs text-stone-500">Participants</dt>
					<dd class="mt-1 text-2xl font-semibold text-stone-950 tabular-nums">
						{data.stats.totalParticipants}
					</dd>
				</div>
				<div class="rounded-xl bg-stone-50 p-3">
					<dt class="text-xs text-stone-500">Active accounts</dt>
					<dd class="mt-1 text-2xl font-semibold text-stone-950 tabular-nums">
						{data.stats.activeAccounts}
					</dd>
				</div>
				<div class="rounded-xl bg-stone-50 p-3">
					<dt class="text-xs text-stone-500">Households</dt>
					<dd class="mt-1 text-2xl font-semibold text-stone-950 tabular-nums">
						{data.stats.householdCount}
					</dd>
				</div>
				<div class="rounded-xl bg-stone-50 p-3">
					<dt class="text-xs text-stone-500">Assignments finalized</dt>
					<dd class="mt-1 text-2xl font-semibold text-stone-950 tabular-nums">
						{data.stats.finalizedAssignmentCount}/{data.stats.assignmentCount}
					</dd>
				</div>
				<div class="rounded-xl bg-stone-50 p-3">
					<dt class="text-xs text-stone-500">Gift ideas</dt>
					<dd class="mt-1 text-2xl font-semibold text-stone-950 tabular-nums">
						{data.stats.wishlistIdeaCount}
					</dd>
				</div>
				<div class="rounded-xl bg-stone-50 p-3">
					<dt class="text-xs text-stone-500">Messages</dt>
					<dd class="mt-1 text-2xl font-semibold text-stone-950 tabular-nums">
						{data.stats.messageCount}
					</dd>
					<p class="mt-1 text-[0.65rem] text-stone-500">Count only</p>
				</div>
				<div class="rounded-xl bg-stone-50 p-3 sm:col-span-3 lg:col-span-6">
					<dt class="text-xs text-stone-500">Participants who marked a gift purchased</dt>
					<dd class="mt-1 text-xl font-semibold text-stone-950 tabular-nums">
						{data.stats.purchasedGiftCount}
					</dd>
				</div>
			</dl>
		</CardContent>
	</Card>

	<OrganizerParticipantsTable
		participants={data.participants}
		households={data.households.map(({ id, name }) => ({ id, name }))}
		currentUserId={data.currentUserId}
		assignmentsExist={data.assignmentsExist}
	/>

	<OrganizerHouseholdsCard
		households={data.households}
		participants={data.participants}
		assignmentsExist={data.assignmentsExist}
	/>
</section>
