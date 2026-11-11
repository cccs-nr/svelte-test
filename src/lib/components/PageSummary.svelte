<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		simple,
		children
	}: {
		/** One short sentence, shown when Page guidance is Simple. */
		simple: string;
		/** The fuller description, shown when Page guidance is Detailed. */
		children?: Snippet;
	} = $props();
</script>

{#if children}
	<p class="app-page-text app-description">{@render children()}</p>
{/if}
<p class="app-page-simple app-page-text">{simple}</p>
