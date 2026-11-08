<script lang="ts">
	import { TRPCClientError } from '@trpc/client';
	import type { PageProps } from './$types';
	import { formatBudgetInput, type EditableEventStatus } from '#lib/models/event.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { trpc } from '#lib/trpc/client.js';

	let { data }: PageProps = $props();
	let savedEvent = $state<typeof data.event>(null);
	let name = $state('');
	let description = $state('');
	let exchangeDate = $state('');
	let giftBudget = $state('');
	let instructions = $state('');
	let status = $state<EditableEventStatus>('setup');
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	$effect(() => {
		const currentEvent = data.event;
		savedEvent = currentEvent;
		name = currentEvent?.name ?? '';
		description = currentEvent?.description ?? '';
		exchangeDate = currentEvent?.exchangeDate ?? '';
		giftBudget = currentEvent ? formatBudgetInput(currentEvent.giftBudgetCents) : '';
		instructions = currentEvent?.instructions ?? '';
		status = currentEvent?.status === 'open' ? 'open' : 'setup';
	});

	async function saveSettings(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSaving) return;

		isSaving = true;
		errorMessage = null;
		successMessage = null;

		try {
			savedEvent = await trpc.event.save.mutate({
				name,
				description,
				exchangeDate,
				giftBudget,
				instructions,
				status
			});
			successMessage = 'Event settings saved.';
		} catch (error) {
			errorMessage =
				error instanceof TRPCClientError
					? error.message
					: 'Unable to save the event settings. Please try again.';
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Event settings | Secret Santa</title>
</svelte:head>

<section class="mx-auto max-w-3xl space-y-8">
	<div>
		<p class="text-sm font-medium tracking-[0.18em] text-emerald-800 uppercase">Organizer</p>
		<h1 class="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
			Event settings
		</h1>
		<p class="mt-3 text-stone-600">
			Configure the one family exchange. The gift budget is a guideline for gift ideas.
		</p>
	</div>

	<Card class="border-stone-200 bg-white">
		<CardHeader>
			<CardTitle>{savedEvent ? 'Update your exchange' : 'Set up your exchange'}</CardTitle>
			<CardDescription>
				The budget is stored as Canadian dollars. Participants can see these settings on their
				dashboard.
			</CardDescription>
		</CardHeader>
		<CardContent>
			<form class="space-y-6" onsubmit={saveSettings}>
				<div class="space-y-2">
					<label class="text-sm font-medium" for="event-name">Event name</label>
					<Input
						id="event-name"
						name="name"
						bind:value={name}
						maxlength={100}
						autocomplete="off"
						required
						disabled={isSaving}
					/>
				</div>

				<div class="space-y-2">
					<label class="text-sm font-medium" for="event-description">Description</label>
					<textarea
						id="event-description"
						name="description"
						bind:value={description}
						maxlength={2000}
						rows="3"
						disabled={isSaving}
						class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
					></textarea>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<div class="space-y-2">
						<label class="text-sm font-medium" for="exchange-date">Gift exchange date</label>
						<Input
							id="exchange-date"
							name="exchangeDate"
							type="date"
							bind:value={exchangeDate}
							required
							disabled={isSaving}
						/>
					</div>
					<div class="space-y-2">
						<label class="text-sm font-medium" for="gift-budget">Gift budget (CAD)</label>
						<Input
							id="gift-budget"
							name="giftBudget"
							type="text"
							inputmode="decimal"
							placeholder="50.00"
							bind:value={giftBudget}
							required
							disabled={isSaving}
						/>
						<p class="text-xs text-stone-500">Enter dollars with up to two decimal places.</p>
					</div>
				</div>

				<div class="space-y-2">
					<label class="text-sm font-medium" for="event-instructions">Optional instructions</label>
					<textarea
						id="event-instructions"
						name="instructions"
						bind:value={instructions}
						maxlength={5000}
						rows="4"
						disabled={isSaving}
						class="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
					></textarea>
				</div>

				<div class="space-y-2">
					<label class="text-sm font-medium" for="event-status">Event status</label>
					<select
						id="event-status"
						name="status"
						bind:value={status}
						disabled={isSaving}
						class="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<option value="setup">Setup</option>
						<option value="open">Open</option>
					</select>
					<p class="text-xs text-stone-500">
						Open makes the event ready for participants. Assignment and completion states are
						managed in later phases.
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
				{#if successMessage}
					<p class="text-sm text-emerald-800" role="status">{successMessage}</p>
				{/if}

				<Button type="submit" disabled={isSaving}>
					{isSaving ? 'Saving…' : savedEvent ? 'Save changes' : 'Create event'}
				</Button>
			</form>
		</CardContent>
	</Card>
</section>
