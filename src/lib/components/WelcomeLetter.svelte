<script lang="ts">
	import { formatEventBudget } from '#lib/models/event.js';

	type EventSummary = {
		name: string;
		exchangeDate: string;
		giftBudgetCents: number;
		currency: string;
	};

	let {
		displayName,
		event
	}: {
		displayName: string;
		event: EventSummary | null;
	} = $props();

	function formatDate(date: string): string {
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'full' }).format(
			new Date(`${date}T00:00:00`)
		);
	}

	const steps = [
		{
			title: 'Make your wishlist',
			text: 'Open “My Wishlist” and add a few things you would enjoy. You can add a link to the gift, a photo, and a short note.'
		},
		{
			title: 'Find out who you are buying for',
			text: 'After the organizer does the draw, open “Your Draw”. It shows the one person you are giving a gift to.'
		},
		{
			title: 'Pick a gift from their wishlist',
			text: 'Look through their wishlist and choose something they will love. Not sure? Send them a message with a question.'
		},
		{
			title: 'Keep it a secret',
			text: 'Messages use codenames, so you can ask questions without giving away who you are.'
		},
		{
			title: 'Bring your gift to the party',
			text: 'Press “Mark purchased” once you have your gift, then bring it along on the day.'
		}
	];
</script>

<article
	class="app-surface mx-auto max-w-3xl space-y-8 rounded-3xl border-2 border-rose-200 p-6 shadow-xl sm:p-10"
	aria-labelledby="welcome-letter-title"
>
	<header class="space-y-3 text-center">
		<p class="text-5xl" aria-hidden="true">🎄🎁🎅</p>
		<h1
			id="welcome-letter-title"
			class="text-3xl leading-tight font-bold tracking-tight text-emerald-900 sm:text-4xl"
		>
			Welcome to this year’s Secret Santa!!!
		</h1>
		{#if event}
			<p class="text-xl font-semibold text-rose-800">{event.name}</p>
		{/if}
	</header>

	<div class="space-y-5 text-xl leading-9">
		<p>Dear {displayName},</p>
		<p>
			We are so happy you are joining us! Secret Santa is a fun and friendly way to share a little
			holiday cheer. Everyone gives one gift and everyone gets one gift, and the best part is that
			nobody knows who their Secret Santa is until the big reveal.
		</p>
		<p>This page explains everything in simple steps. Take your time. There is no rush.</p>
	</div>

	{#if event}
		<section
			class="rounded-2xl bg-emerald-50 p-5 text-xl leading-9 dark:bg-emerald-950/40"
			aria-label="Event details"
		>
			<h2 class="mb-2 text-2xl font-bold text-emerald-900">The important details</h2>
			<ul class="space-y-1">
				<li><strong>When:</strong> {formatDate(event.exchangeDate)}</li>
				<li>
					<strong>Suggested gift price:</strong>
					{formatEventBudget(event.giftBudgetCents, event.currency)}
				</li>
			</ul>
			<p class="mt-3">
				The price is only a <strong>suggestion, not a limit</strong>. Spend whatever feels right for
				you. The thought is what counts!
			</p>
		</section>
	{/if}

	<section class="space-y-4">
		<h2 class="text-2xl font-bold text-emerald-900">How it works</h2>
		<ol class="space-y-4">
			{#each steps as step, index (step.title)}
				<li class="flex gap-4">
					<span
						class="grid size-11 shrink-0 place-items-center rounded-full bg-rose-700 text-xl font-bold text-white"
						aria-hidden="true"
					>
						{index + 1}
					</span>
					<div class="text-xl leading-8">
						<p class="font-bold">{step.title}</p>
						<p>{step.text}</p>
					</div>
				</li>
			{/each}
		</ol>
	</section>

	<section class="space-y-3 text-xl leading-9">
		<h2 class="text-2xl font-bold text-emerald-900">Good to know</h2>
		<ul class="list-disc space-y-2 pl-6">
			<li>Please do not tell anyone who you drew. It is more fun as a surprise!</li>
			<li>
				You can see the same instructions at any time. Just choose <strong>Help</strong> at the top of
				the page.
			</li>
			<li>
				If you feel stuck, ask your organizer. Nobody minds a question, and we are happy to help.
			</li>
		</ul>
	</section>

	<p class="text-xl leading-9">
		Happy gifting, and thank you for being part of the fun!
		<br />
		<span class="font-semibold text-rose-800">Your Secret Santa organizers 🎅</span>
	</p>
</article>
