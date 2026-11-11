<script lang="ts">
	import { onMount } from 'svelte';
	import { Lightbulb } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let {
		title = 'How this page works',
		simple,
		children
	}: {
		title?: string;
		/** One short sentence shown when page guidance is set to Simple. */
		simple: string;
		children: Snippet;
	} = $props();

	let isOpen = $state(true);

	// On phones the guide starts folded so the page content is not pushed off screen.
	onMount(() => {
		isOpen = window.matchMedia('(min-width: 768px)').matches;
	});
</script>

<details class="app-guide" bind:open={isOpen}>
	<summary class="app-guide__summary">
		<span class="app-guide__icon" aria-hidden="true">
			<Lightbulb size={26} />
		</span>
		<span class="app-guide__title">{title}</span>
		<span class="app-guide__hint">{isOpen ? 'Hide' : 'Show'}</span>
	</summary>
	<div class="app-guide__body app-guide__detailed space-y-2">
		{@render children()}
	</div>
	<p class="app-guide__body app-guide__simple">{simple}</p>
</details>
