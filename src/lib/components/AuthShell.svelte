<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { Gift } from '@lucide/svelte';
	import AccessibilityMenu from '#lib/components/AccessibilityMenu.svelte';

	let {
		title,
		intro,
		simple,
		children
	}: {
		title: string;
		/** Extra explanation under the title; hidden on phones to keep the page on one screen. */
		intro?: string;
		/** One short sentence shown when Page guidance is Simple. */
		simple?: string;
		children: Snippet;
	} = $props();
</script>

<main
	class="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-100 via-stone-50 to-rose-50 px-4 py-4 text-stone-900 sm:py-8"
>
	<div class="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3 sm:gap-6">
		<div class="flex items-center justify-between gap-4">
			<a
				class="inline-flex items-center gap-3 font-semibold tracking-tight text-stone-950"
				href={resolve('/')}
				aria-label="Secret Santa home"
			>
				<span class="grid size-10 place-items-center rounded-lg bg-accent-red text-white">
					<Gift size={22} aria-hidden="true" />
				</span>
				<span class="text-xl max-[420px]:sr-only">Secret Santa</span>
			</a>
			<AccessibilityMenu />
		</div>

		<div class="space-y-2 text-center sm:space-y-3">
			<h1
				class="text-2xl leading-tight font-bold tracking-tight text-stone-950 min-[400px]:text-3xl sm:text-4xl"
			>
				{title}
			</h1>
			{#if simple}
				<p class="app-page-simple mx-auto">{simple}</p>
			{/if}
			{#if intro}
				<p class="app-description hidden text-base text-stone-700 sm:block">{intro}</p>
			{/if}
		</div>

		{@render children()}
	</div>
</main>
