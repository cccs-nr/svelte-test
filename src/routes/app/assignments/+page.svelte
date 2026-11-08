<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { TRPCClientError } from '@trpc/client';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { trpc } from '#lib/trpc/client.js';

	type AssignmentStatus = Awaited<ReturnType<typeof trpc.assignments.status.query>>;

	let status = $state<AssignmentStatus | null>(null);
	let isLoading = $state(true);
	let isWorking = $state(false);
	let errorMessage = $state<string | null>(null);
	let notice = $state<string | null>(null);

	onMount(() => {
		void refreshStatus();
	});

	async function refreshStatus(): Promise<void> {
		isLoading = true;
		errorMessage = null;
		status = null;

		try {
			status = await trpc.assignments.status.query();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to load assignment status. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	async function generateAssignments(): Promise<void> {
		if (isWorking || !status?.canGenerate) return;
		if (
			status.assignmentCount > 0 &&
			!globalThis.confirm('Regenerate the draw? This replaces the current draft recipient mapping.')
		) {
			return;
		}

		isWorking = true;
		errorMessage = null;
		notice = null;

		try {
			const result = await trpc.assignments.generate.mutate();
			notice = `Generated ${result.assignmentCount} assignments. Recipient details remain hidden until finalization.`;
			await refreshStatus();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to generate assignments. Please try again.';
		} finally {
			isWorking = false;
		}
	}

	async function finalizeAssignments(): Promise<void> {
		if (isWorking) return;
		if (
			!globalThis.confirm(
				'Finalize this draw? Participants will be able to see only their own recipient.'
			)
		) {
			return;
		}

		isWorking = true;
		errorMessage = null;
		notice = null;

		try {
			const result = await trpc.assignments.finalize.mutate();
			notice = `Finalized ${result.assignmentCount} assignments.`;
			await refreshStatus();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to finalize assignments. Please try again.';
		} finally {
			isWorking = false;
		}
	}

	async function resetAssignments(): Promise<void> {
		if (!status || status.assignmentCount === 0 || isWorking) return;

		const prompt = status.finalized
			? 'Reset finalized assignments? This clears the recipient mapping and permanently deletes related private conversations.'
			: 'Remove the current draft assignments?';
		if (!globalThis.confirm(prompt)) return;

		isWorking = true;
		errorMessage = null;
		notice = null;

		try {
			const result = await trpc.assignments.reset.mutate({ confirm: true });
			notice = `Reset ${result.removedCount} assignments.`;
			await refreshStatus();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to reset assignments. Please try again.';
		} finally {
			isWorking = false;
		}
	}
</script>

<svelte:head>
	<title>Gift assignments | Secret Santa</title>
</svelte:head>

<section class="mx-auto max-w-4xl space-y-8">
	<div>
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">Organizer</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
			Gift assignments
		</h1>
		<p class="mt-3 max-w-2xl text-stone-600">
			Check household constraints, generate a randomized draw, and finalize it when you’re ready.
			The complete mapping is never shown here.
		</p>
	</div>

	{#if errorMessage}
		<p
			class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
			role="alert"
		>
			{errorMessage}
		</p>
	{/if}
	{#if notice}
		<p class="text-sm text-emerald-800" role="status">{notice}</p>
	{/if}

	<Card class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle>Draw status</CardTitle>
			<CardDescription>
				Assignments are created for active participant accounts. A valid draw gives every
				participant one recipient and prevents same-household matches.
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if isLoading}
				<p class="text-sm text-stone-500">Checking event and participant readiness…</p>
			{:else if status}
				<dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div class="rounded-xl bg-stone-50 p-4">
						<dt class="text-sm text-stone-500">Event</dt>
						<dd class="mt-1 font-medium text-stone-950">
							{status.eventStatus ? status.eventStatus.replaceAll('_', ' ') : 'Not configured'}
						</dd>
					</div>
					<div class="rounded-xl bg-stone-50 p-4">
						<dt class="text-sm text-stone-500">Active participants</dt>
						<dd class="mt-1 font-medium text-stone-950">{status.participantCount}</dd>
					</div>
					<div class="rounded-xl bg-stone-50 p-4">
						<dt class="text-sm text-stone-500">Assignments</dt>
						<dd class="mt-1 font-medium text-stone-950">{status.assignmentCount}</dd>
					</div>
					<div class="rounded-xl bg-stone-50 p-4">
						<dt class="text-sm text-stone-500">Draw check</dt>
						<dd class="mt-1 font-medium text-stone-950">
							{#if status.finalized}
								Finalized
							{:else if status.hasFinalizedAssignments}
								Partial finalization
							{:else if status.valid}
								Valid draft
							{:else if status.feasible}
								A valid draw is possible
							{:else}
								Needs attention
							{/if}
						</dd>
					</div>
				</dl>

				{#if !status.eventStatus}
					<p class="mt-5 text-sm text-stone-600">
						Configure the event before generating assignments.
						<a
							class="font-medium text-emerald-800 underline-offset-4 hover:underline"
							href={resolve('/app/event')}
						>
							Event settings
						</a>
					</p>
				{:else if status.eventStatus === 'setup'}
					<p class="mt-5 text-sm text-stone-600">Open the event before generating assignments.</p>
				{:else if status.hasFinalizedAssignments && !status.finalized}
					<p class="mt-5 text-sm text-rose-700">
						This draw is only partially finalized. Reset assignments before generating or finalizing
						another draw.
					</p>
				{:else if !status.feasible}
					<p class="mt-5 text-sm text-rose-700">
						{status.validationMessage ??
							'No complete assignment satisfies the current household restrictions. Update participants or households and try again.'}
					</p>
				{:else if status.validationMessage}
					<p class="mt-5 text-sm text-rose-700">{status.validationMessage}</p>
				{/if}
			{/if}

			<div class="mt-6 flex flex-wrap gap-3">
				<Button
					type="button"
					onclick={refreshStatus}
					disabled={isLoading || isWorking}
					variant="outline"
				>
					Refresh status
				</Button>
				<Button
					type="button"
					onclick={generateAssignments}
					disabled={!status?.canGenerate || isWorking || isLoading}
				>
					{isWorking
						? 'Working…'
						: status?.assignmentCount
							? 'Regenerate draft'
							: 'Generate assignments'}
				</Button>
				<Button
					type="button"
					onclick={finalizeAssignments}
					disabled={!status?.canFinalize || isWorking || isLoading}
					variant="secondary"
				>
					Finalize draw
				</Button>
				{#if status?.assignmentCount}
					<Button
						type="button"
						onclick={resetAssignments}
						disabled={isWorking || isLoading}
						variant="destructive"
					>
						Reset assignments
					</Button>
				{/if}
			</div>
		</CardContent>
	</Card>
</section>
