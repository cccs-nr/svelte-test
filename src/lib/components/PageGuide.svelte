<script lang="ts">
	import { Lightbulb } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let {
		title = 'How this page works',
		children
	}: {
		title?: string;
		children: Snippet;
	} = $props();
</script>

<aside class="app-guide" aria-label={title}>
	<span class="app-guide__icon" aria-hidden="true">
		<Lightbulb size={26} />
	</span>
	<div class="space-y-1">
		<p class="app-guide__title">{title}</p>
		<div class="app-guide__body space-y-2">
			{@render children()}
		</div>
	</div>
</aside>
