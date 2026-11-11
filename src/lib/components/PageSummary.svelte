<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!-- One short sentence under the page title; shown only when Page guidance is Simple. -->
<p class="app-page-simple">{@render children()}</p>
