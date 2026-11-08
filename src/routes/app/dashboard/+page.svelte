<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import { getRealtimeSocket } from '#lib/realtime/client.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';

	let { data }: PageProps = $props();

	const progressPercent = $derived(
		(data.currentStageIndex / Math.max(data.eventStages.length - 1, 1)) * 100
	);

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

	function formatDate(date: string): string {
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'long' }).format(
			new Date(`${date}T00:00:00`)
		);
	}
</script>

<svelte:head>
	<title>Dashboard | Secret Santa</title>
</svelte:head>

<section class="space-y-8">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">Organizer</p>
			<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
				Dashboard
			</h1>
			<p class="mt-3 max-w-2xl text-stone-600">
				Monitor participation and event activity without revealing who is assigned to whom.
			</p>
		</div>
		<a
			class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
			href={resolve('/app/event')}
		>
			Event settings
		</a>
	</div>

	<Card class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle>{data.event?.name ?? 'Event progress'}</CardTitle>
			<CardDescription>
				{#if data.event}
					Exchange day: {formatDate(data.event.exchangeDate)}
				{:else}
					Create the event before it can move through these stages.
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-5">
			<div
				class="h-3 overflow-hidden rounded-full bg-stone-100"
				role="progressbar"
				aria-label="Event progress"
				aria-valuemin="0"
				aria-valuemax={data.eventStages.length - 1}
				aria-valuenow={data.currentStageIndex}
				aria-valuetext={data.eventStages[data.currentStageIndex]?.label ?? 'Setup'}
			>
				<div
					class="h-full rounded-full bg-emerald-700 transition-[width]"
					style={`width: ${progressPercent}%`}
				></div>
			</div>
			<ol class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{#each data.eventStages as stage, index (stage.value)}
					<li
						class={`rounded-xl border px-3 py-3 text-sm ${
							index === data.currentStageIndex
								? 'border-emerald-700 bg-emerald-50 font-semibold text-emerald-950'
								: index < data.currentStageIndex
									? 'border-emerald-200 bg-white text-emerald-800'
									: 'border-stone-200 bg-white text-stone-500'
						}`}
						aria-current={index === data.currentStageIndex ? 'step' : undefined}
					>
						<span class="block text-xs tracking-wide uppercase">Step {index + 1}</span>
						<span class="mt-1 block">{stage.label}</span>
					</li>
				{/each}
			</ol>
		</CardContent>
	</Card>

	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
		<Card class="border-stone-200 bg-white">
			<CardHeader class="pb-2">
				<CardDescription>Accounts</CardDescription>
				<CardTitle class="text-2xl">{data.stats.accountCount}</CardTitle>
			</CardHeader>
			<CardContent class="text-sm text-stone-600">
				{data.stats.activeParticipants} active participants
			</CardContent>
		</Card>
		<Card class="border-stone-200 bg-white">
			<CardHeader class="pb-2">
				<CardDescription>Gift ideas</CardDescription>
				<CardTitle class="text-2xl">{data.stats.wishlistIdeaCount}</CardTitle>
			</CardHeader>
			<CardContent class="text-sm text-stone-600">Across all participant wishlists</CardContent>
		</Card>
		<Card class="border-stone-200 bg-white">
			<CardHeader class="pb-2">
				<CardDescription>Messages</CardDescription>
				<CardTitle class="text-2xl">{data.stats.messageCount}</CardTitle>
			</CardHeader>
			<CardContent class="text-sm text-stone-600"
				>Message count only; contents stay private</CardContent
			>
		</Card>
		<Card class="border-stone-200 bg-white">
			<CardHeader class="pb-2">
				<CardDescription>Assignments finalized</CardDescription>
				<CardTitle class="text-2xl">{data.stats.finalizedAssignmentCount}</CardTitle>
			</CardHeader>
			<CardContent class="text-sm text-stone-600">No recipient pairings are shown</CardContent>
		</Card>
		<Card class="border-stone-200 bg-white">
			<CardHeader class="pb-2">
				<CardDescription>Gifts marked purchased</CardDescription>
				<CardTitle class="text-2xl">{data.stats.purchasedGiftCount}</CardTitle>
			</CardHeader>
			<CardContent class="text-sm text-stone-600">
				Participants can update this status from Gift.
			</CardContent>
		</Card>
	</div>

	<Card class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle>Participants and accounts</CardTitle>
			<CardDescription>
				Each row shows activity for that account. The assignment column never displays a recipient.
			</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="-mx-2 overflow-x-auto px-2">
				<table class="w-full min-w-[900px] border-collapse text-left text-sm">
					<thead>
						<tr class="border-b border-stone-200 text-xs tracking-wide text-stone-500 uppercase">
							<th class="px-3 py-3 font-medium">Account</th>
							<th class="px-3 py-3 font-medium">Role / event status</th>
							<th class="px-3 py-3 font-medium">Household</th>
							<th class="px-3 py-3 text-right font-medium">Gift ideas</th>
							<th class="px-3 py-3 text-right font-medium">Messages</th>
							<th class="px-3 py-3 font-medium">Assignment</th>
							<th class="px-3 py-3 font-medium">Gift status</th>
						</tr>
					</thead>
					<tbody>
						{#each data.participants as participant (participant.id)}
							<tr class="border-b border-stone-100 last:border-0">
								<th scope="row" class="px-3 py-4 font-medium text-stone-950">
									<span class="block">{participant.displayName}</span>
									<span class="mt-1 block text-xs font-normal text-stone-500">
										@{participant.username}
									</span>
								</th>
								<td class="px-3 py-4 text-stone-700">
									<span class="block capitalize">{participant.role}</span>
									<span class="mt-1 block text-xs text-stone-500">{participant.eventStatus}</span>
								</td>
								<td class="px-3 py-4 text-stone-700">{participant.householdName ?? '—'}</td>
								<td class="px-3 py-4 text-right text-stone-700 tabular-nums">
									{participant.wishlistCount}
								</td>
								<td class="px-3 py-4 text-right text-stone-700 tabular-nums">
									{participant.messageCount}
								</td>
								<td class="px-3 py-4 text-stone-700">
									{#if !participant.isParticipating}
										Not in draw
									{:else if participant.assignmentFinalized}
										Finalized
									{:else}
										Pending
									{/if}
								</td>
								<td class="px-3 py-4 text-stone-700">
									{#if !participant.isParticipating}
										—
									{:else if participant.giftPurchased}
										Purchased
									{:else}
										Not marked
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</CardContent>
	</Card>
</section>
