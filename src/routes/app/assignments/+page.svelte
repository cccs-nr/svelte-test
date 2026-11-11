<script lang="ts">
	import { CircleCheck, RefreshCw, RotateCcw, Shuffle } from '@lucide/svelte';
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
	import AssignmentEditor from '#lib/components/AssignmentEditor.svelte';
	import PageGuide from '#lib/components/PageGuide.svelte';
	import PageSummary from '#lib/components/PageSummary.svelte';
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
			? 'Reset finalized assignments? This clears the recipient mapping. Wishlist conversations and message history remain.'
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
		<p class="app-page-kicker">Organizer</p>
		<div class="app-page-titlebar">
			<h1 class="app-page-title">Gift assignments</h1>
			<PageGuide pageId="assignments">
				<p>
					This is where you draw names for the Secret Santa. Nobody can see who they drew until you
					finalize the draw.
				</p>
				<ol>
					<li>
						Check that everyone has joined. The status below shows how many people are taking part.
					</li>
					<li>
						Press <strong>Generate assignments</strong>. Everyone gets one person to buy for, and
						people in the same household are never matched. You can regenerate as many times as you
						like before finalizing.
					</li>
					<li>
						Press <strong>Finalize draw</strong> when you are happy. People can then see their
						person under <strong>Your Draw</strong>, and the event is locked against changes to who
						takes part.
					</li>
					<li>
						Something wrong afterwards? Use <strong>Edit who buys for whom</strong> at the bottom to
						fix a match, or <strong>Reset assignments</strong> to start over.
					</li>
				</ol>
				<p>The full list of who buys for whom stays hidden unless you open the editor.</p>
			</PageGuide>
		</div>
		<PageSummary simple="Generate the draw, check it, then finalize it."
			>Check household constraints, generate a randomized draw, and finalize it when you’re ready.
			The full list of who buys for whom stays hidden unless you open the editor below.</PageSummary
		>
	</div>

	{#if errorMessage}
		<p class="app-alert app-alert--error" role="alert">
			{errorMessage}
		</p>
	{/if}
	{#if notice}
		<p class="app-notice" role="status">{notice}</p>
	{/if}

	<Card>
		<CardHeader>
			<CardTitle>Draw status</CardTitle>
			<CardDescription>
				Assignments are created for active participant accounts. A valid draw gives every
				participant one recipient and prevents same-household matches.
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if isLoading}
				<p class="text-sm text-stone-600">Checking event and participant readiness…</p>
			{:else if status}
				<dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div class="rounded-xl bg-stone-50 p-4">
						<dt class="text-sm text-stone-600">Event</dt>
						<dd class="mt-1 font-medium text-stone-950">
							{status.eventStatus ? status.eventStatus.replaceAll('_', ' ') : 'Not configured'}
						</dd>
					</div>
					<div class="rounded-xl bg-stone-50 p-4">
						<dt class="text-sm text-stone-600">Active participants</dt>
						<dd class="mt-1 font-medium text-stone-950">{status.participantCount}</dd>
					</div>
					<div class="rounded-xl bg-stone-50 p-4">
						<dt class="text-sm text-stone-600">Assignments</dt>
						<dd class="mt-1 font-medium text-stone-950">{status.assignmentCount}</dd>
					</div>
					<div class="rounded-xl bg-stone-50 p-4">
						<dt class="text-sm text-stone-600">Draw check</dt>
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
							class="font-medium text-emerald-800 underline underline-offset-4"
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
					<RefreshCw aria-hidden="true" />
					Refresh status
				</Button>
				<Button
					type="button"
					onclick={generateAssignments}
					disabled={!status?.canGenerate || isWorking || isLoading}
				>
					<Shuffle aria-hidden="true" />
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
					<CircleCheck aria-hidden="true" />
					Finalize draw
				</Button>
				{#if status?.assignmentCount}
					<Button
						type="button"
						onclick={resetAssignments}
						disabled={isWorking || isLoading}
						variant="destructive"
					>
						<RotateCcw aria-hidden="true" />
						Reset assignments
					</Button>
				{/if}
			</div>
		</CardContent>
	</Card>

	{#if status?.assignmentCount}
		<AssignmentEditor onChanged={refreshStatus} />
	{/if}
</section>
