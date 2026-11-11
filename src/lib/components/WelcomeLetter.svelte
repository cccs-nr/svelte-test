<script lang="ts">
	import { House } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { formatEventBudget } from '#lib/models/event.js';
	import { welcomeGuide as guide, type WelcomeBlock } from '#lib/content/welcome.js';
	import { Button } from '#lib/components/ui/button/index.js';

	type EventSummary = {
		name: string;
		exchangeDate: string;
		giftBudgetCents: number;
		currency: string;
	};

	let { event }: { event: EventSummary | null } = $props();

	function formatDate(date: string): string {
		return new Intl.DateTimeFormat('en-CA', { dateStyle: 'full' }).format(
			new Date(`${date}T00:00:00`)
		);
	}

	// Splits **bold** markers into segments so the text can be rendered without raw HTML.
	function segments(text: string): { text: string; bold: boolean }[] {
		return text
			.split('**')
			.map((part, index) => ({ text: part, bold: index % 2 === 1 }))
			.filter((segment) => segment.text.length > 0);
	}
</script>

{#snippet rich(text: string)}
	{#each segments(text) as segment, index (index)}
		{#if segment.bold}<strong>{segment.text}</strong>{:else}{segment.text}{/if}
	{/each}
{/snippet}

{#snippet blocks(items: WelcomeBlock[])}
	{#each items as block, index (index)}
		{#if block.type === 'p'}
			<p>{@render rich(block.text)}</p>
		{:else}
			<ul class="list-disc space-y-1 pl-7">
				{#each block.items as item (item)}
					<li>{@render rich(item)}</li>
				{/each}
			</ul>
		{/if}
	{/each}
{/snippet}

<article
	class="app-surface mx-auto max-w-3xl space-y-8 rounded-3xl border-2 border-accent-red p-5 shadow-xl sm:p-10"
	aria-labelledby="welcome-letter-title"
>
	<header>
		<img
			src="{__APP_BASE_PATH__}/welcome-banner.jpg"
			alt="Santa and a reindeer peeking over a parchment sign that reads Secret Santa"
			width="1365"
			height="768"
			class="aspect-video w-full rounded-2xl object-cover shadow-md"
		/>
		<h1 id="welcome-letter-title" class="sr-only">{guide.title}</h1>
	</header>

	{#if event}
		<section
			class="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 text-base dark:bg-emerald-950/40"
			aria-label="Event details"
		>
			<h2 class="mb-2 text-2xl font-bold text-primary">{event.name}</h2>
			<ul class="space-y-1">
				<li><strong>When:</strong> {formatDate(event.exchangeDate)}</li>
				<li>
					<strong>Suggested gift price:</strong>
					{formatEventBudget(event.giftBudgetCents, event.currency)}
				</li>
			</ul>
		</section>
	{/if}

	<div class="space-y-4 text-base">
		{@render blocks(guide.intro)}
	</div>

	{#each guide.sections as section (section.title)}
		<section class="space-y-4 border-t-2 border-accent-red/30 pt-6 text-base">
			<h2 class="text-2xl leading-snug font-bold text-emerald-900">{section.title}</h2>
			{@render blocks(section.blocks)}
		</section>
	{/each}

	<div class="space-y-4 border-t-2 border-accent-red/30 pt-6 text-base font-semibold">
		{@render blocks(guide.outro)}
	</div>

	<footer class="flex justify-center border-t-2 border-accent-red/30 pt-6">
		<Button href={resolve('/app')} size="lg">
			<House aria-hidden="true" />
			Go to Home
		</Button>
	</footer>
</article>
