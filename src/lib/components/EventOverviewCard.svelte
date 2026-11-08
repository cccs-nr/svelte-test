<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { TRPCClientError } from '@trpc/client';
	import { formatBudgetInput, formatEventBudget, type EventStatus } from '#lib/models/event.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { trpc } from '#lib/trpc/client.js';

	type EventSummary = {
		name: string;
		description: string;
		exchangeDate: string;
		giftBudgetCents: number;
		currency: string;
		instructions: string;
		status: EventStatus;
	};

	type Props = {
		event: EventSummary | null;
		stages: { value: EventStatus | 'revealed'; label: string }[];
		currentStageIndex: number;
		canComplete: boolean;
	};

	let { event, stages, currentStageIndex, canComplete }: Props = $props();
	let dialog = $state<HTMLDialogElement>();
	let name = $state('');
	let description = $state('');
	let exchangeDate = $state('');
	let giftBudget = $state('');
	let instructions = $state('');
	let status = $state<'setup' | 'open'>('setup');
	let isSaving = $state(false);
	let isCompleting = $state(false);
	let errorMessage = $state<string | null>(null);
	let progressPercent = $derived((currentStageIndex / Math.max(stages.length - 1, 1)) * 100);

	$effect(() => {
		name = event?.name ?? '';
		description = event?.description ?? '';
		exchangeDate = event?.exchangeDate ?? '';
		giftBudget = event ? formatBudgetInput(event.giftBudgetCents) : '';
		instructions = event?.instructions ?? '';
		status = event?.status === 'open' ? 'open' : 'setup';
	});

	$effect(() => {
		name = event?.name ?? '';
		description = event?.description ?? '';
		exchangeDate = event?.exchangeDate ?? '';
		giftBudget = event ? formatBudgetInput(event.giftBudgetCents) : '';
		instructions = event?.instructions ?? '';
		status = event?.status === 'open' ? 'open' : 'setup';
	});

	function formatDate(date: string): string {
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'long' }).format(
			new Date(`${date}T00:00:00`)
		);
	}

	function openDialog(): void {
		errorMessage = null;
		dialog?.showModal();
	}

	function closeDialog(): void {
		if (!isSaving) dialog?.close();
	}

	function handleDialogClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) closeDialog();
	}

	async function saveEvent(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSaving) return;

		isSaving = true;
		errorMessage = null;
		try {
			await trpc.event.save.mutate({
				name,
				description,
				exchangeDate,
				giftBudget,
				instructions,
				status
			});
			await invalidateAll();
			dialog?.close();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError ? error.message : 'Unable to save the event settings.';
		} finally {
			isSaving = false;
		}
	}

	async function completeEvent(): Promise<void> {
		if (!canComplete || isCompleting || event?.status === 'completed') return;
		if (
			!globalThis.confirm(
				'Complete this exchange? Participants will be able to read existing conversations but cannot send new family messages.'
			)
		) {
			return;
		}

		isCompleting = true;
		errorMessage = null;
		try {
			await trpc.event.complete.mutate({ confirm: true });
			await invalidateAll();
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to complete the event. Please try again.';
		} finally {
			isCompleting = false;
		}
	}
</script>

<Card id="event" class="border-stone-200 bg-white">
	<CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4">
		<div class="min-w-0">
			<p class="text-xs font-medium tracking-[0.16em] text-emerald-800 uppercase">Event overview</p>
			<CardTitle class="mt-2">{event?.name ?? 'Your exchange is not set up yet'}</CardTitle>
			<CardDescription class="mt-1">
				{#if event}
					{event.description || 'A little surprise brings everyone closer.'}
				{:else}
					Add the event details, date, and gift budget to get started.
				{/if}
			</CardDescription>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if event?.status === 'assignments_generated' || event?.status === 'completed'}
				<Button
					type="button"
					variant={event.status === 'completed' ? 'outline' : 'destructive'}
					onclick={() => void completeEvent()}
					disabled={!canComplete || isCompleting || event.status === 'completed'}
				>
					{event.status === 'completed'
						? 'Event completed'
						: isCompleting
							? 'Completing…'
							: canComplete
								? 'Complete event'
								: 'Finalize assignments first'}
				</Button>
			{/if}
			<Button type="button" onclick={openDialog}>
				{event ? 'Edit event' : 'Set up event'}
			</Button>
		</div>
	</CardHeader>
	{#if errorMessage}
		<div class="px-6">
			<p
				class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
				role="alert"
			>
				{errorMessage}
			</p>
		</div>
	{/if}
	<CardContent class="space-y-5">
		{#if event}
			<dl class="grid gap-4 sm:grid-cols-3">
				<div>
					<dt class="text-xs font-medium text-stone-500">Status</dt>
					<dd class="mt-1 font-medium text-stone-950">
						{stages[currentStageIndex]?.label ?? 'Setup'}
					</dd>
				</div>
				<div>
					<dt class="text-xs font-medium text-stone-500">Exchange date</dt>
					<dd class="mt-1 font-medium text-stone-950">{formatDate(event.exchangeDate)}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium text-stone-500">Gift budget</dt>
					<dd class="mt-1 font-medium text-stone-950">
						{formatEventBudget(event.giftBudgetCents, event.currency)}
					</dd>
				</div>
			</dl>
			{#if event.instructions}
				<p class="text-sm whitespace-pre-wrap text-stone-600">{event.instructions}</p>
			{/if}
			{#if event.instructions}
				<p class="text-sm whitespace-pre-wrap text-stone-600">{event.instructions}</p>
			{/if}
		{/if}

		<div
			class="h-2.5 overflow-hidden rounded-full bg-stone-100"
			role="progressbar"
			aria-label="Event progress"
			aria-valuemin="0"
			aria-valuemax={stages.length - 1}
			aria-valuenow={currentStageIndex}
			aria-valuetext={stages[currentStageIndex]?.label ?? 'Setup'}
		>
			<div
				class="h-full rounded-full bg-emerald-700 transition-[width]"
				style={`width: ${progressPercent}%`}
			></div>
		</div>
		<ol class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			{#each stages as stage, index (stage.value)}
				<li
					class={`rounded-lg px-2.5 py-2 text-xs ${
						index === currentStageIndex
							? 'bg-emerald-100 font-semibold text-emerald-950'
							: index < currentStageIndex
								? 'bg-emerald-50 text-emerald-800'
								: 'bg-stone-50 text-stone-500'
					}`}
					aria-current={index === currentStageIndex ? 'step' : undefined}
				>
					<span class="block text-[0.65rem] uppercase">Step {index + 1}</span>
					<span class="mt-0.5 block">{stage.label}</span>
				</li>
			{/each}
		</ol>
	</CardContent>
</Card>

<dialog
	bind:this={dialog}
	class="m-auto max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto rounded-2xl bg-white text-stone-950 shadow-2xl backdrop:bg-black/60"
	aria-labelledby="event-dialog-title"
	onclick={handleDialogClick}
>
	<div class="p-5 sm:p-7">
		<div class="mb-6 flex items-start justify-between gap-4">
			<div>
				<h2 id="event-dialog-title" class="text-xl font-semibold">
					{event ? 'Edit event' : 'Set up event'}
				</h2>
				<p class="mt-1 text-sm text-stone-600">
					The budget is stored as Canadian dollars and is a gift guideline.
				</p>
			</div>
			<Button type="button" variant="outline" onclick={closeDialog} disabled={isSaving}>
				Close
			</Button>
		</div>

		{#if errorMessage}
			<p
				class="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
				role="alert"
			>
				{errorMessage}
			</p>
		{/if}

		<form class="grid gap-5 md:grid-cols-2" onsubmit={saveEvent}>
			<div class="space-y-2 md:col-span-2">
				<label class="text-sm font-medium" for="event-name">Event name</label>
				<Input id="event-name" bind:value={name} maxlength={100} required disabled={isSaving} />
			</div>
			<div class="space-y-2 md:col-span-2">
				<label class="text-sm font-medium" for="event-description">Description</label>
				<textarea
					id="event-description"
					bind:value={description}
					maxlength={2000}
					rows="3"
					disabled={isSaving}
					class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
				></textarea>
			</div>
			<div class="space-y-2">
				<label class="text-sm font-medium" for="event-date">Gift exchange date</label>
				<Input id="event-date" type="date" bind:value={exchangeDate} required disabled={isSaving} />
			</div>
			<div class="space-y-2">
				<label class="text-sm font-medium" for="event-budget">Gift budget (CAD)</label>
				<Input
					id="event-budget"
					type="text"
					inputmode="decimal"
					bind:value={giftBudget}
					placeholder="50.00"
					required
					disabled={isSaving}
				/>
			</div>
			<div class="space-y-2 md:col-span-2">
				<label class="text-sm font-medium" for="event-instructions">Instructions</label>
				<textarea
					id="event-instructions"
					bind:value={instructions}
					maxlength={5000}
					rows="3"
					disabled={isSaving}
					class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
				></textarea>
			</div>
			<div class="space-y-2">
				<label class="text-sm font-medium" for="event-status">Event status</label>
				<select
					id="event-status"
					bind:value={status}
					disabled={isSaving}
					class="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
				>
					<option value="setup">Setup</option>
					<option value="open">Open</option>
				</select>
			</div>
			<CardFooter class="flex justify-end gap-3 p-0 md:col-span-2">
				<Button type="button" variant="outline" onclick={closeDialog} disabled={isSaving}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSaving}>
					{isSaving ? 'Saving…' : event ? 'Save changes' : 'Create event'}
				</Button>
			</CardFooter>
		</form>
	</div>
</dialog>
